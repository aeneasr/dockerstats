package cmd

import (
	"github.com/aeneasr/dockerstats/scrap"
	"github.com/ory/x/flagx"
	"github.com/ory/x/logrusx"
	"runtime"
	"sync"
	"time"

	"github.com/spf13/cobra"
)

// scrapCmd represents the scrap command
var scrapCmd = &cobra.Command{
	Use:   "scrap",
	Short: "Scraps the Docker Hub APIs",
	Run: func(cmd *cobra.Command, args []string) {
		log := logrusx.New()

		log.Infoln("Connecting to database")
		db := connect(log)

		log.
			WithField("cpu", runtime.NumCPU()).
			WithField("cgo_call", runtime.NumCgoCall()).
			WithField("goroutines", runtime.NumGoroutine()).
			WithField("goos", runtime.GOOS).
			Infof("Collected system data")

		ri := scrap.NewScraper(
			flagx.MustGetInt(cmd, "task-count"),
			log,
			db,
			flagx.MustGetDuration(cmd, "discovery-interval"),
			flagx.MustGetDuration(cmd, "discovery-delay"),
			flagx.MustGetDuration(cmd, "snapshot-delay"),
			flagx.MustGetInt(cmd, "discovery-page-size"),
			flagx.MustGetInt(cmd, "snapshot-interval"),
		)

		var wg sync.WaitGroup
		wg.Add(2)
		log.Infoln("Starting scrapers")
		go ri.Discover()
		go ri.Scrap()

		wg.Wait()
	},
}

func init() {
	rootCmd.AddCommand(scrapCmd)

	scrapCmd.Flags().IntP("task-count", "n", 3, "Number of concurrent snapshot tasks")

	scrapCmd.Flags().Int("snapshot-interval", 1, "Run the snapshot task every X days")
	scrapCmd.Flags().Duration("discovery-interval", time.Hour*24*5, "Run the discovery task every interval")
	scrapCmd.Flags().Duration("discovery-delay", time.Second*30, "Number of concurrent snapshot tasks")
	scrapCmd.Flags().Int("discovery-page-size", 500, "Number of elements to traverse during discovery")
	scrapCmd.Flags().Duration("snapshot-delay", time.Second*30, "Number of concurrent snapshot tasks")
}
