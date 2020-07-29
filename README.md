# www.dockerstats.com

This projects scraps the Docker Hub API and keeps track of Docker Image Pulls over time. Docker Hub stores
image pulls as an int32 which causes several images to report incorrect pull statistics. One such example is
[library/nginx](https://www.dockerstats.com/hubs/docker/library/nginx).
