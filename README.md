# www.dockerstats.com

This hobby and research project scraps the Docker Hub API and keeps track of Docker Image Pulls over time. One such example is
[library/nginx](https://www.dockerstats.com/hubs/docker/library/nginx).

![Dockerstats website screenshot](.github/banner.png)

## Limitations

Docker Hub stores image pulls as an int32 which causes several images to report incorrect pull statistics.
An issue has already been filed for this: [hub-feedbak#203](https://github.com/docker/hub-feedback/issues/2003)
