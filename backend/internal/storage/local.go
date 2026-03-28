package storage

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"

	"easystock/internal/config"
)

// LocalStorage implements Storage interface for local filesystem
type LocalStorage struct {
	basePath   string
	baseURL    string
	maxSize    int64
	allowTypes []string
}

// NewLocalStorage creates a new local storage instance
func NewLocalStorage(cfg *config.StorageConfig) (*LocalStorage, error) {
	// Ensure the base path exists
	if err := os.MkdirAll(cfg.LocalPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage directory: %w", err)
	}

	return &LocalStorage{
		basePath:   cfg.LocalPath,
		baseURL:    "/uploads",
		maxSize:    cfg.MaxSize,
		allowTypes: cfg.AllowedTypes,
	}, nil
}

// Save stores a file on the local filesystem
func (s *LocalStorage) Save(name string, data io.Reader) (*FileInfo, error) {
	// Generate unique ID
	id := uuid.New().String()

	// Get file extension
	ext := filepath.Ext(name)
	if ext == "" {
		ext = ".bin"
	}

	// Create filename with ID
	filename := id + ext

	// Create year/month subdirectories for organization
	subdir := ""
	fullPath := filepath.Join(s.basePath, subdir, filename)

	// Ensure subdirectory exists
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return nil, fmt.Errorf("failed to create subdirectory: %w", err)
	}

	// Create the file
	file, err := os.Create(fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create file: %w", err)
	}
	defer file.Close()

	// Copy data to file with size limit
	limitedReader := io.LimitReader(data, s.maxSize+1)
	size, err := io.Copy(file, limitedReader)
	if err != nil {
		os.Remove(fullPath)
		return nil, fmt.Errorf("failed to write file: %w", err)
	}

	// Check if file exceeded size limit
	if size > s.maxSize {
		os.Remove(fullPath)
		return nil, fmt.Errorf("file size exceeds maximum allowed (%d bytes)", s.maxSize)
	}

	// Detect MIME type
	mimeType := detectMimeType(ext)

	return &FileInfo{
		ID:       id,
		Name:     name,
		Path:     fullPath,
		URL:      s.GetURL(id + ext),
		Size:     size,
		MimeType: mimeType,
	}, nil
}

// Get retrieves a file by its ID (with extension)
func (s *LocalStorage) Get(id string) ([]byte, error) {
	// Sanitize id - remove any path traversal attempts
	id = filepath.Clean(id)
	if id == "." || id == ".." || strings.HasPrefix(id, "/") || strings.Contains(id, "..") {
		return nil, fmt.Errorf("invalid file id: %s", id)
	}

	// Find the file (id might include extension)
	path := filepath.Join(s.basePath, id)

	// Check if file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// Try to find file without knowing exact extension
		matches, _ := filepath.Glob(filepath.Join(s.basePath, id+".*"))
		if len(matches) > 0 {
			path = matches[0]
		} else {
			return nil, fmt.Errorf("file not found: %s", id)
		}
	}

	// Ensure path is within basePath (prevent path traversal)
	absBase, _ := filepath.Abs(s.basePath)
	absPath, _ := filepath.Abs(path)
	if !strings.HasPrefix(absPath, absBase) {
		return nil, fmt.Errorf("access denied: path outside storage directory")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	return data, nil
}

// Delete removes a file by its ID
func (s *LocalStorage) Delete(id string) error {
	// Sanitize id - remove any path traversal attempts
	id = filepath.Clean(id)
	if id == "." || id == ".." || strings.HasPrefix(id, "/") || strings.Contains(id, "..") {
		return fmt.Errorf("invalid file id: %s", id)
	}

	path := filepath.Join(s.basePath, id)

	// Check if file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		// Try to find file without knowing exact extension
		matches, _ := filepath.Glob(filepath.Join(s.basePath, id+".*"))
		if len(matches) > 0 {
			path = matches[0]
		} else {
			return fmt.Errorf("file not found: %s", id)
		}
	}

	// Ensure path is within basePath (prevent path traversal)
	absBase, _ := filepath.Abs(s.basePath)
	absPath, _ := filepath.Abs(path)
	if !strings.HasPrefix(absPath, absBase) {
		return fmt.Errorf("access denied: path outside storage directory")
	}

	if err := os.Remove(path); err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}

// GetURL returns the public URL for a file
func (s *LocalStorage) GetURL(id string) string {
	return fmt.Sprintf("%s/%s", s.baseURL, id)
}

// Exists checks if a file exists
func (s *LocalStorage) Exists(id string) bool {
	path := filepath.Join(s.basePath, id)
	if _, err := os.Stat(path); err == nil {
		return true
	}
	// Try with any extension
	matches, _ := filepath.Glob(filepath.Join(s.basePath, id+".*"))
	return len(matches) > 0
}

// detectMimeType returns MIME type based on file extension
func detectMimeType(ext string) string {
	ext = strings.ToLower(ext)
	mimeTypes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".pdf":  "application/pdf",
		".xls":  "application/vnd.ms-excel",
		".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".csv":  "text/csv",
		".txt":  "text/plain",
	}

	if mt, ok := mimeTypes[ext]; ok {
		return mt
	}
	return "application/octet-stream"
}

// GetBasePath returns the base storage path
func (s *LocalStorage) GetBasePath() string {
	return s.basePath
}
