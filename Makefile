.PHONE: db
db:
		docker kill dockerstats_test_database_postgres || true
		docker run --rm --name dockerstats_test_database_postgres -p 5534:5432 -e POSTGRES_PASSWORD=secret -d postgres:9.6

.PHONY: dev
dev:
		cd web; npm run build
		sql-migrate up
		DSN=postgres://postgres:secret@127.0.0.1:5534/postgres?sslmode=disable go run main.go serve

.PHONY: prod-migrate
prod-migrate:
		sql-migrate up -env production

.PHONY: format
format:
		goreturns -w -i -local github.com/ory $$(listx .)

.PHONE: run
run:
		sql-migrate up
		cd web; npm run build
		packr
		go install .
		packr clean
		nohup dockerstats > ~/dockerstats.log 2>&1 &

.PHONY: build
build:
		cd web; npm run build
		packr
		GO111MODULE=on GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o dist/dockerstats .
		packr clean
		GO111MODULE=on GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o dist/sql-migrate github.com/rubenv/sql-migrate/sql-migrate
		upx -2 -o dist/dockerstats dockerstats

.PHONY: deploy
deploy:
		gcloud builds submit --tag gcr.io/ory-web/dockerstats --timeout 60m
		gcloud run deploy --image gcr.io/ory-web/dockerstats --platform managed --region us-east1 --allow-unauthenticated dockerstats
