package main

import (
	"cloud.google.com/go/profiler"
	"github.com/aeneasr/dockerstats/cmd"
	"log"
)

func main() {
	cfg := profiler.Config{
		Service:        "dockerstats",
		ServiceVersion: "0.0.0",
		MutexProfiling: true,
	}

	if err := profiler.Start(cfg); err != nil {
		log.Printf("Unable to start profiler: %s", err)
	}

	cmd.Execute()
}
