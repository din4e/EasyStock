package storage

import (
	"io"
)

// FileInfo contains information about a stored file
type FileInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Path     string `json:"path"`
	URL      string `json:"url"`
	Size     int64  `json:"size"`
	MimeType string `json:"mime_type"`
}

// Storage defines the interface for file storage backends
type Storage interface {
	// Save stores a file and returns its info
	Save(name string, data io.Reader) (*FileInfo, error)

	// Get retrieves a file by its ID
	Get(id string) ([]byte, error)

	// Delete removes a file by its ID
	Delete(id string) error

	// GetURL returns the public URL for a file
	GetURL(id string) string

	// Exists checks if a file exists
	Exists(id string) bool
}
