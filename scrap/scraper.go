package scrap

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"
	"go.uber.org/atomic"

	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"

	"github.com/ory/x/httpx"
)

type Scraper struct {
	sync.RWMutex

	c  *http.Client
	db *sqlx.DB

	blacklist         map[string]bool
	l                 logrus.FieldLogger
	pageSize          int
	taskCount         int
	discoverEvery     time.Duration
	delay             time.Duration
	scrapRefreshQueue time.Duration
	updateEvery       string
	scrapEvery        func(time.Time) (time.Time, string)
	queue             chan string

	snapshotsCompleted atomic.Uint64
	reposDiscovered    atomic.Uint64
}

func NewScraper(
	tasks int,
	l logrus.FieldLogger,
	db *sqlx.DB,
	discoverEvery time.Duration,
	delay time.Duration,
	scrapRefreshQueue time.Duration,
	pageSize int,
	daysRefresh int,
) *Scraper {
	if tasks < 1 {
		tasks = 1
	}

	return &Scraper{
		l:  l,
		db: db,

		// defaults
		queue:             make(chan string, tasks),
		taskCount:         tasks,
		pageSize:          pageSize,
		discoverEvery:     discoverEvery,
		delay:             delay,
		scrapRefreshQueue: scrapRefreshQueue,
		scrapEvery: func(i time.Time) (time.Time, string) {
			return time.Date(i.Year(), i.Month(), i.Day(), 0, 0, 0, 0, i.Location()), fmt.Sprintf("%d days", daysRefresh)
			// return time.Date(i.Year(), i.Month(), i.Day(), i.Hour(), 0, 0, 0, i.Location()), "1 hour"
			// return time.Date(i.Year(), i.Month(), i.Day(), i.Hour(), i.Minute(), 0, 0, i.Location()), "1 minute"
			// return time.Date(i.Year(), i.Month(), i.Day(), i.Hour(), i.Minute(), i.Second(), 0, i.Location()), "1 second"
		},
		c: &http.Client{
			Timeout:   time.Second * 30,
			Transport: httpx.NewDefaultResilientRoundTripper(time.Second*10, time.Second*30),
		},
	}
}

type Stats struct {
	TotalRepositories         int64 `json:"discovered_repositories_total"`
	RepositoriesWithoutErrors int64 `json:"discovered_repositories_without_errors"`
	RepositoriesWithErrors    int64 `json:"discovered_repositories_with_errors"`

	TotalSnapshotsCompleted int64 `json:"snapshots_completed_total"`
	SnapShotQueue           int64 `json:"snapshot_queue"`

	SnapshotsCompleted      uint64 `json:"proc_snapshots_completed"`
	DiscoveriesCompleted    uint64 `json:"proc_discoveries_completed"`
	SnapshotQueueLength     int    `json:"proc_snapshot_queue_length"`
	SnapshotRefreshInterval string `json:"snapshot_refresh_interval"`
}

func (i *Scraper) Stats(c context.Context) *Stats {
	hr, err := i.dbCountHealthyRepos(c)
	if err != nil {
		i.l.WithError(err).WithField("stack", fmt.Sprintf("%+v", err)).Errorf("Unable to count elements")
	}
	sq, err := i.dbCountSnapshotQueue(c)
	if err != nil {
		i.l.WithError(err).WithField("stack", fmt.Sprintf("%+v", err)).Errorf("Unable to count elements")
	}
	tr, err := i.dbCountTotalRepos(c)
	if err != nil {
		i.l.WithError(err).WithField("stack", fmt.Sprintf("%+v", err)).Errorf("Unable to count elements")
	}
	cs, err := i.dbCountSnapshots(c)
	if err != nil {
		i.l.WithError(err).WithField("stack", fmt.Sprintf("%+v", err)).Errorf("Unable to count elements")
	}
	_, interval := i.scrapEvery(time.Now())
	return &Stats{
		TotalRepositories:         tr,
		RepositoriesWithoutErrors: hr,
		RepositoriesWithErrors:    tr - hr,

		TotalSnapshotsCompleted: cs,
		SnapShotQueue:           sq,

		DiscoveriesCompleted:    i.reposDiscovered.Load(),
		SnapshotsCompleted:      i.snapshotsCompleted.Load(),
		SnapshotRefreshInterval: interval,
		SnapshotQueueLength:     len(i.queue),
	}
}

func (i *Scraper) FindSnapshots(slug string) (RepositorySnapshots, error) {
	return i.dbListSnapshots(context.Background(), slug, "search")
}

func (i *Scraper) ListRepositorySlugs(ctx context.Context) ([]string, error) {
	return i.dbDiscoveryList(ctx)
}

func (i *Scraper) Scrap() {
	for t := 0; t < i.taskCount; t++ {
		go i.watchSnapshotQueue(i.queue)
	}

	i.discoverNextSnapshotRefresh(i.queue)
}

func (i *Scraper) watchSnapshotQueue(queue chan string) {
	for slug := range queue {
		if err := i.fetchSnapshot(slug); err != nil {
			i.l.WithError(err).WithField("stack", fmt.Sprintf("%+v", err)).Errorf("Unable to scrap repository")
		}
	}
}

func (i *Scraper) snapshotQueuePop(slug string) {
	i.Lock()
	i.Unlock()
	delete(i.blacklist, slug)

}

func (i *Scraper) snapshotQueuePush(slug string, queue chan string) {
	i.RLock()
	_, isInQueue := i.blacklist[slug]
	i.RUnlock()

	if !isInQueue {
		i.Lock()
		i.blacklist[slug] = true
		i.Unlock()
		queue <- slug
	}
}

func (i *Scraper) discoverNextSnapshotRefresh(queue chan string) {
	defer close(queue)
	for {
		is, err := i.dbDiscoveryFetchNext(context.Background())
		if err != nil {
			i.l.WithError(err).Error("Unable to iterate over repositories")
		}

		for _, i := range is {
			queue <- i
		}

		time.Sleep(i.scrapRefreshQueue)
	}
}

func (i *Scraper) fetchSnapshot(slug string) error {
	defer i.snapshotQueuePop(slug)
	defer i.snapshotsCompleted.Add(1)

	uri := "https://hub.docker.com/v2/repositories/" + strings.TrimSpace(
		strings.Trim(
			slug, "\n",
		),
	) + "/"

	i.l.Debugf(`Fetching repository data for "%s" from: %s`, slug, uri)
	res, err := i.c.Get(uri)
	if err != nil {
		return errors.Wrapf(err, "repository: %s", slug)
	}
	defer res.Body.Close()

	if err := checkStatus(res, http.StatusOK); err != nil {
		if err := i.dbDiscoveryMarkError(context.Background(), slug, res.StatusCode); err != nil {
			return errors.Wrapf(err, "repository: %s", slug)
		}
		return errors.Wrapf(err, "repository: %s", slug)
	}

	var dr RepositorySnapshot
	if err := json.NewDecoder(res.Body).Decode(&dr); err != nil {
		return errors.Wrapf(err, "repository: %s", slug)
	}

	if err := i.dbSnapshotAdd(context.Background(), slug, &dr); err != nil {
		return errors.Wrapf(err, "repository: %s", slug)
	}

	i.l.Debugf("Repository data stored successfully for: %s", slug)

	return nil
}

func (i *Scraper) Discover() {
	uris := []string{
		fmt.Sprintf("https://hub.docker.com/api/content/v1/products/search?q=&type=image&page_size=%d", i.pageSize),
		fmt.Sprintf("https://hub.docker.com/api/content/v1/products/search?sort=updated_at&order=desc&type=image&page_size=%d", i.pageSize),
	}

	for {
		for _, uri := range uris {
			i.l.Debugf("Discovering repositories from: %s", uri)
			if err := i.discover(uri); err != nil {
				i.l.WithError(err).Errorf("An error occurred during repository discovery.")
			}
			i.l.Debugf("Discovery finished for: %s", uri)
		}
		i.l.Debugf("Discovery finished for all sources, going to sleep for %.2fm", i.discoverEvery)
		time.Sleep(i.discoverEvery)
	}
}

func (i *Scraper) discover(next string) error {
	for len(next) > 0 {
		i.l.Debugf("Discovering next uri: %s", next)
		result, err := i.fetchDiscovery(next)
		if err != nil {
			return errors.Wrapf(err, `discover: "%s"`, next)
		}

		slugs := make([]string, len(result.Summaries))
		for k, r := range result.Summaries {
			slugs[k] = r.Slug
		}

		i.l.Debugf("Updating repository index based on uri result: %s", next)
		if err := i.dbDiscoveryBatch(context.Background(), "discovery", slugs); err != nil {
			return errors.Wrapf(err, `discover: "%s"`, next)
		}
		i.l.Debugf("Repository index update done!")

		next = result.Next
		i.l.Debugf("Going to sleep for %.2fs before discovering next uri: %s", i.delay.Seconds(), next)
		time.Sleep(i.delay)
	}

	return nil
}

func (i *Scraper) fetchDiscovery(uri string) (*discoveryResult, error) {
	defer i.reposDiscovered.Add(1)

	req, err := http.NewRequest("GET", uri, nil)
	if err != nil {
		return nil, errors.Wrapf(err, "discovery: %s", uri)
	}
	req.Header.Set("Search-Version", "v3")

	res, err := i.c.Do(req)
	if err != nil {
		return nil, errors.WithStack(err)
	}
	defer res.Body.Close()
	if err := checkStatus(res, http.StatusOK); err != nil {
		return nil, errors.Wrapf(err, "discovery: %s", uri)
	}

	var s discoveryResult
	if err := json.NewDecoder(res.Body).Decode(&s); err != nil {
		return nil, errors.Wrapf(err, "discovery: %s", uri)
	}

	for k, repo := range s.Summaries {
		if !strings.Contains(repo.Slug, "/") {
			s.Summaries[k].Slug = strings.TrimSpace(
				strings.Trim(
					"library/"+repo.Slug, "\n",
				),
			)
		}
	}

	return &s, nil
}

func checkStatus(res *http.Response, expected int) error {
	if res.StatusCode != expected {
		body, _ := ioutil.ReadAll(res.Body)
		return errors.Errorf("http: expected status code %d but got %d with body: %s", expected, res.StatusCode, body)
	}
	return nil
}

func nowb() []byte {
	return []byte(time.Now().UTC().Format(time.RFC3339))
}
