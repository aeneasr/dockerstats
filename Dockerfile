FROM node:14.6-alpine AS node-builder

WORKDIR /app

COPY web/package.json .
COPY web/package-lock.json .

RUN npm ci

COPY web .

RUN npm run build

FROM golang:1.14-alpine AS golang-builder

RUN apk -U --no-cache add build-base git

WORKDIR /go/src/github.com/aeneasr/dockerstats

ADD go.mod go.mod
ADD go.sum go.sum

RUN go mod download
RUN GO111MODULE=on go install github.com/gobuffalo/packr/packr

ADD . .

COPY --from=node-builder /app/build web/build
RUN packr
RUN CGO_ENABLED=0 go build -a -o /usr/bin/dockerstats

FROM alpine:3.11

COPY --from=golang-builder /usr/bin/dockerstats /usr/bin/dockerstats

ENTRYPOINT ["dockerstats"]
CMD ["serve","--task-count=2","--snapshot-interval=2"]
