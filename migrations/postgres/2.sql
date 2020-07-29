-- +migrate Up
ALTER TABLE repository_snapshots DROP COLUMN username;
ALTER TABLE repository_snapshots DROP COLUMN name;
ALTER TABLE repository_snapshots DROP COLUMN namespace;
ALTER TABLE repository_snapshots DROP COLUMN last_updated;

CREATE INDEX repository_snapshots_repository_id_idx ON repository_snapshots (repository_id);

-- +migrate Down
