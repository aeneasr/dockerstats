package scrap

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/pkg/errors"

	"github.com/ory/x/sqlxx"
)

type RepositorySnapshots []*RepositorySnapshot

var (
	snapshotInsertColumns, snapshotInsertArguments = sqlxx.NamedInsertArguments(new(RepositorySnapshot), "id")
	// snapshotUpdateStatements                       = sqlxx.NamedUpdateArguments(new(RepositorySnapshot))

	repositoryInsertColumns, repositoryInsertArguments = sqlxx.NamedInsertArguments(new(Repository), "id")
	// repositoryUpdateStatements                         = sqlxx.NamedUpdateArguments(new(Repository))
)

var zeroDate = time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC)

func (i *Scraper) dbCountHealthyRepos(ctx context.Context) (int64, error) {
	var count int64
	if err := i.db.GetContext(ctx, &count, "SELECT COUNT(id) FROM repositories WHERE error_code=0"); err != nil {
		return 0, err
	}
	return count, nil
}

func (i *Scraper) dbCountSnapshotQueue(ctx context.Context) (int64, error) {
	var count int64
	_, interval := i.scrapEvery(time.Now())
	if err := i.db.GetContext(ctx, &count, fmt.Sprintf("SELECT COUNT(id) FROM repositories WHERE last_scrapped_at < now() - interval '%s' AND error_code=0", interval)); err != nil {
		return 0, errors.WithStack(err)
	}
	return count, nil
}

func (i *Scraper) dbCountTotalRepos(ctx context.Context) (int64, error) {
	var count int64
	if err := i.db.GetContext(ctx, &count, "SELECT COUNT(id) FROM repositories"); err != nil {
		return 0, err
	}
	return count, nil
}

func (i *Scraper) dbCountSnapshots(ctx context.Context) (int64, error) {
	var count int64
	if err := i.db.GetContext(ctx, &count, "SELECT COUNT(id) FROM repository_snapshots"); err != nil {
		return 0, err
	}
	return count, nil
}

func (i *Scraper) dbListSnapshots(ctx context.Context, slug string, source string) (RepositorySnapshots, error) {
	var repository int
	if err := i.db.GetContext(ctx, &repository, i.db.Rebind("SELECT id FROM repositories WHERE slug=?"), slug); err == sql.ErrNoRows {
		return RepositorySnapshots{}, i.dbDiscoveryBatch(ctx, source, []string{slug})
	} else if err != nil {
		return nil, errors.WithStack(err)
	}

	var repositories RepositorySnapshots
	if err := i.db.SelectContext(ctx, &repositories, i.db.Rebind("SELECT * FROM repository_snapshots WHERE repository_id=? ORDER BY fetched_at ASC"), repository); err == sql.ErrNoRows {
		return RepositorySnapshots{}, nil
	} else if err != nil {
		return nil, errors.WithStack(err)
	}

	return repositories, nil
}

func (i *Scraper) dbSnapshotAdd(ctx context.Context, slug string, r *RepositorySnapshot) error {
	tx, err := i.db.BeginTxx(ctx, nil)
	if err != nil {
		return errors.WithStack(err)
	}
	defer tx.Rollback()

	var repository int
	query := i.db.Rebind("SELECT id FROM repositories WHERE slug=?")
	if err := tx.GetContext(ctx, &repository, query, slug); err != nil {
		return errors.Wrapf(err, "unable to execute query: %s", query)
	}

	r.Timestamp = time.Now().UTC()
	r.RepositoryID = repository

	query = fmt.Sprintf("INSERT INTO repository_snapshots (%s) VALUES (%s)",
		snapshotInsertColumns,
		snapshotInsertArguments,
	)
	if _, err := tx.NamedExecContext(
		ctx,
		query,
		r,
	); err != nil {
		return errors.Wrapf(err, "unable to execute query: %s", query)
	}

	date, _ := i.scrapEvery(time.Now().UTC())
	query = i.db.Rebind("UPDATE repositories SET last_scrapped_at=? WHERE id=?")
	if _, err := tx.ExecContext(
		ctx,
		query,
		date,
		repository,
	); err != nil {
		return errors.Wrapf(err, "unable to execute query: %s", query)
	}

	if err := tx.Commit(); err != nil {
		return errors.WithStack(err)
	}

	return nil
}

func (i *Scraper) dbDiscoveryList(ctx context.Context) ([]string, error) {
	var slugs []string
	if err := i.db.SelectContext(ctx, &slugs, "SELECT slug FROM repositories WHERE error_code=0"); err != nil {
		return nil, errors.WithStack(err)
	}

	return slugs, nil
}

func (i *Scraper) dbDiscoveryFetchNext(ctx context.Context) ([]string, error) {
	var slugs []string
	_, interval := i.scrapEvery(time.Now())
	if err := i.db.SelectContext(ctx, &slugs, fmt.Sprintf("SELECT slug FROM repositories WHERE last_scrapped_at < now() - interval '%s' AND error_code=0 ORDER BY last_scrapped_at, id ASC LIMIT 500", interval)); err != nil {
		return nil, errors.WithStack(err)
	}

	return slugs, nil
}

func (i *Scraper) dbHasDiscovered(ctx context.Context, slug string) (found bool, err error) {
	var id int
	query := i.db.Rebind("SELECT id FROM repositories WHERE slug=?")
	if err := i.db.SelectContext(ctx, &id, query, slug); err == sql.ErrNoRows {
		return false, nil
	} else if err != nil {
		return false, errors.WithStack(err)
	}

	return true, nil
}

func (i *Scraper) dbDiscoveryMarkError(ctx context.Context, slug string, code int) error {
	query := i.db.Rebind("UPDATE repositories SET error_code=?, error_at=? WHERE slug=?")
	_, err := i.db.ExecContext(
		ctx,
		query,
		code,
		time.Now().UTC(),
		slug,
	)

	return errors.Wrapf(err, "unable to execute query: %s", query)
}

func (i *Scraper) dbDiscoveryBatch(ctx context.Context, source string, slugs []string) error {
	tx, err := i.db.BeginTxx(ctx, nil)
	if err != nil {
		return errors.WithStack(err)
	}
	defer tx.Rollback()

	for _, slug := range slugs {
		i.l.Debugf(`Discovered a new repository from source "%s": %s`, source, slug)
		if _, err := tx.NamedExecContext(
			ctx,
			fmt.Sprintf(
				"INSERT INTO repositories (%s) VALUES (%s) ON CONFLICT DO NOTHING",
				repositoryInsertColumns,
				repositoryInsertArguments,
			), &Repository{
				Source:       source,
				Slug:         slug,
				DiscoveredAt: time.Now().UTC(),
				ErrorAt:      zeroDate,
				ErrorCode:    0,
			}); err != nil {
			return errors.WithStack(err)
		}
		i.l.Debugf(`Persisted discovery from source "%s": %s`, source, slug)
	}

	i.l.Debugf(`Committing discovery from source: %s`, source)
	if err := tx.Commit(); err != nil {
		return errors.WithStack(err)
	}

	i.l.Debugf(`Discovery from source committed: %s`, source)
	return nil
}
