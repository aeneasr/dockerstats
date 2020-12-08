package cmd

import (
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/gobuffalo/packr"
	"github.com/gorilla/mux"
	"github.com/jmoiron/sqlx"
	"github.com/rs/cors"

	"github.com/ory/x/flagx"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/urfave/negroni"

	"github.com/ory/graceful"
	"github.com/ory/herodot"
	"github.com/ory/x/logrusx"

	negronilogrus "github.com/meatballhat/negroni-logrus"

	"github.com/aeneasr/dockerstats/api"
	"github.com/aeneasr/dockerstats/scrap"
)

func connect(l logrus.FieldLogger) *sqlx.DB {
	dsn := os.Getenv("DSN")
	if dsn == "" {
		l.Fatalf("DSN is empty.")
	}

	db, err := sqlx.Open("pgx", dsn)
	if err != nil {
		l.WithError(err).Fatal("Unable to connect to database.")
	}

	db.DB.SetConnMaxIdleTime(time.Minute)
	db.DB.SetMaxIdleConns(2)
	db.DB.SetMaxOpenConns(20)
	db.DB.SetConnMaxLifetime(0)

	if err := db.Ping(); err != nil {
		l.WithError(err).Fatal("Unable to connect to database.")
	}

	return db
}

var serveCmd = &cobra.Command{
	Use: "serve",
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
		writer := herodot.NewJSONWriter(log)
		router := mux.NewRouter()
		api.NewHandler(ri, writer).Handle(router)

		mw := negroni.New()
		mw.Use(negronilogrus.NewMiddleware())
		mw.UseHandler(router)

		box := packr.NewBox("../web/build")
		list := make([]string, len(box.List()))
		for k, f := range box.List() {
			list[k] = "/" + strings.Replace(f, "\\", "/", -1)
		}

		static := http.FileServer(box)
		var sh http.HandlerFunc = func(w http.ResponseWriter, r *http.Request) {
			for _, f := range list {
				if r.URL.Path == f {
					static.ServeHTTP(w, r)
					return
				}
			}

			r.URL.Path = "/"
			static.ServeHTTP(w, r)
		}
		router.NotFoundHandler = sh
		c := cors.New(cors.Options{
			AllowedHeaders:[]string{"*"},
			AllowedOrigins: []string{
				"http://dockerstats.com",
				"http://www.dockerstats.com",
				"https://dockerstats.com",
				"https://www.dockerstats.com",
				"https://statsd.ory.sh",
				"https://dockerstats.io",
				"https://www.dockerstats.io",
				"http://localhost:3000",
				"http://127.0.0.1:3000",
				"http://localhost:3001",
				"http://127.0.0.1:3001",
			},
		})
		addr := fmt.Sprintf("%s:%d", viper.GetString("host"), viper.GetInt("port"))
		server := graceful.WithDefaults(&http.Server{
			Addr:    addr,
			Handler: c.Handler(mw),
		})

		log.Infof("Listening on: %s", addr)
		if err := graceful.Graceful(server.ListenAndServe, server.Shutdown); err != nil {
			log.WithError(err).Fatalf("Unable to listen on: %s", addr)
		}
	},
}

func init() {
	rootCmd.AddCommand(serveCmd)

	serveCmd.Flags().IntP("task-count", "n", 3, "Number of concurrent snapshot tasks")

	serveCmd.Flags().Int("snapshot-interval", 1, "Run the snapshot task every X days")
	serveCmd.Flags().Duration("discovery-interval", time.Hour*24*5, "Run the discovery task every interval")
	serveCmd.Flags().Duration("discovery-delay", time.Second*30, "Number of concurrent snapshot tasks")
	serveCmd.Flags().Int("discovery-page-size", 500, "Number of elements to traverse during discovery")
	serveCmd.Flags().Duration("snapshot-delay", time.Second*30, "Number of concurrent snapshot tasks")
}
