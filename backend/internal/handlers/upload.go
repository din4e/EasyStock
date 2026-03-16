package handlers

import (
	"net/http"
	"path/filepath"
	"strings"

	"easystock/internal/config"
	"easystock/internal/storage"

	"github.com/gin-gonic/gin"
)

// UploadHandler handles file upload operations
type UploadHandler struct {
	storage storage.Storage
	config  *config.StorageConfig
}

// NewUploadHandler creates a new upload handler
func NewUploadHandler(storage storage.Storage, cfg *config.StorageConfig) *UploadHandler {
	return &UploadHandler{
		storage: storage,
		config:  cfg,
	}
}

// Upload handles single file upload
// POST /api/v1/upload
func (h *UploadHandler) Upload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > h.config.MaxSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "File size exceeds maximum allowed",
			"max_size": h.config.MaxSize,
		})
		return
	}

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	if !h.isAllowedType(contentType) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "File type not allowed",
			"allowed_types": h.config.AllowedTypes,
		})
		return
	}

	// Save the file
	info, err := h.storage.Save(header.Filename, file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":       info.ID,
		"name":     info.Name,
		"url":      info.URL,
		"size":     info.Size,
		"mime_type": info.MimeType,
	})
}

// UploadMultiple handles multiple file uploads
// POST /api/v1/upload/multiple
func (h *UploadHandler) UploadMultiple(c *gin.Context) {
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid multipart form"})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files provided"})
		return
	}

	var results []gin.H
	var errors []string

	for _, fileHeader := range files {
		// Validate file size
		if fileHeader.Size > h.config.MaxSize {
			errors = append(errors, fileHeader.Filename+": file too large")
			continue
		}

		// Validate file type
		contentType := fileHeader.Header.Get("Content-Type")
		if !h.isAllowedType(contentType) {
			errors = append(errors, fileHeader.Filename+": file type not allowed")
			continue
		}

		file, err := fileHeader.Open()
		if err != nil {
			errors = append(errors, fileHeader.Filename+": failed to open file")
			continue
		}

		info, err := h.storage.Save(fileHeader.Filename, file)
		file.Close()

		if err != nil {
			errors = append(errors, fileHeader.Filename+": "+err.Error())
			continue
		}

		results = append(results, gin.H{
			"id":        info.ID,
			"name":      info.Name,
			"url":       info.URL,
			"size":      info.Size,
			"mime_type": info.MimeType,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"files":  results,
		"errors": errors,
		"total":  len(files),
		"success": len(results),
	})
}

// GetFile serves a file by ID
// GET /api/v1/upload/:id
func (h *UploadHandler) GetFile(c *gin.Context) {
	id := c.Param("id")

	data, err := h.storage.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Detect content type from extension
	ext := filepath.Ext(id)
	contentType := "application/octet-stream"
	if ct := detectContentType(ext); ct != "" {
		contentType = ct
	}

	c.Data(http.StatusOK, contentType, data)
}

// DeleteFile deletes a file by ID
// DELETE /api/v1/upload/:id
func (h *UploadHandler) DeleteFile(c *gin.Context) {
	id := c.Param("id")

	if err := h.storage.Delete(id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "File deleted"})
}

// isAllowedType checks if the content type is allowed
func (h *UploadHandler) isAllowedType(contentType string) bool {
	if len(h.config.AllowedTypes) == 0 {
		return true
	}

	for _, allowed := range h.config.AllowedTypes {
		if strings.HasPrefix(contentType, allowed) || contentType == allowed {
			return true
		}
	}
	return false
}

// detectContentType returns content type from extension
func detectContentType(ext string) string {
	ext = strings.ToLower(ext)
	types := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".pdf":  "application/pdf",
	}
	if t, ok := types[ext]; ok {
		return t
	}
	return ""
}
