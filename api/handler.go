package api

import (
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/pkg/errors"

	"github.com/ory/herodot"

	"github.com/aeneasr/dockerstats/scrap"
)

type Handler struct {
	s *scrap.Scraper
	w herodot.Writer
}

func NewHandler(s *scrap.Scraper, w herodot.Writer) *Handler {
	return &Handler{s: s, w: w}
}

func (h *Handler) Handle(r *mux.Router) {
	r.HandleFunc("/snapshots/repositories", h.query)
	r.HandleFunc("/discovery/repositories", h.images)
	r.HandleFunc("/stats", h.stats)
}

func (h *Handler) query(w http.ResponseWriter, r *http.Request) {
	org := r.URL.Query().Get("org")
	repo := r.URL.Query().Get("repo")

	if org == "" {
		org = "library"
	}
	if repo == "" {
		h.w.WriteErrorCode(w, r, http.StatusBadRequest, errors.Errorf("query parameter repo is empty"))
		return
	}

	history, err := h.s.FindSnapshots(fmt.Sprintf("%s/%s", org, repo))
	if err != nil {
		h.w.WriteError(w, r, err)
		return
	}

	if history == nil {
		history = scrap.RepositorySnapshots{}
	}

	h.w.Write(w, r, history)
}

func (h *Handler) images(w http.ResponseWriter, r *http.Request) {
	images, err := h.s.ListRepositorySlugs(r.Context())
	if err != nil {
		h.w.WriteError(w, r, err)
		return
	}

	h.w.Write(w, r, images)
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	h.w.Write(w, r, h.s.Stats(r.Context()))
}
