package scrap

import "time"

type discoveryResult struct {
	Next      string                   `json:"next"`
	Previous  string                   `json:"previous"`
	Count     int                      `json:"count"`
	Summaries []discoverySummaryResult `json:"summaries"`
}

type discoverySummaryResult struct {
	Slug string `json:"slug"`
}

type Repository struct {
	ID             int       `json:"-" db:"id"`
	Slug           string    `json:"slug" db:"slug"`
	LastScrappedAt time.Time `json:"last_scrapped_at" db:"last_scrapped_at"`
	DiscoveredAt   time.Time `json:"discovered_at" db:"discovered_at"`
	Source         string    `json:"source" db:"source"`
	ErrorCode      int       `json:"-" db:"error_code"`
	ErrorAt        time.Time `json:"-" db:"error_at"`
}

type RepositorySnapshot struct {
	ID           int       `json:"-" db:"id"`
	RepositoryID int       `json:"-" db:"repository_id"`
	Stars        int64     `json:"star_count" db:"stars"`
	Pulls        int64     `json:"pull_count" db:"pulls"`
	Timestamp    time.Time `json:"timestamp" db:"fetched_at"`
}
