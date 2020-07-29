-- +migrate Up
CREATE TYPE source AS ENUM ('search', 'discovery');

CREATE TABLE repositories
(
    id               SERIAL PRIMARY KEY,
    slug             VARCHAR(255) NOT NULL,
    discovered_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    source           source       NOT NULL,
    last_scrapped_at TIMESTAMP    NOT NULL,
    error_code       smallint     NOT NULL DEFAULT 0,
    error_at         TIMESTAMP    NOT NULL,
    UNIQUE (slug)
);

CREATE TABLE repository_snapshots
(
    id            SERIAL PRIMARY KEY,
    repository_id INT       NOT NULL REFERENCES repositories (id) ON DELETE CASCADE,
    fetched_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    pulls         INT       NOT NULL DEFAULT 0,
    stars         INT       NOT NULL DEFAULT 0,
    username      TEXT      NOT NULL DEFAULT '',
    name          TEXT      NOT NULL DEFAULT '',
    namespace     TEXT      NOT NULL DEFAULT '',
    last_updated  timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX repositories_snapshots_fetched_at_idx ON repository_snapshots (fetched_at);
CREATE INDEX repositories_scrapping_status_idx ON repositories (last_scrapped_at);
CREATE INDEX repositories_error_code_idx ON repositories (error_code);

-- +migrate Down
-- SQL section 'Down' is executed when this migration is rolled back
DROP TABLE repository_snapshots;
DROP TABLE repositories;
