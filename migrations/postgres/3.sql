-- +migrate Up

CREATE INDEX repositories_scrapping_order_index_idx ON repositories (last_scrapped_at, id);

-- +migrate Down

DROP INDEX repositories_scrapping_order_index_idx;
