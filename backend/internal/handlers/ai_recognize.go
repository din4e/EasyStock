package handlers

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"time"

	"easystock/internal/ai"
	"easystock/internal/config"
	"easystock/internal/middleware"
	"easystock/internal/models"
	"easystock/internal/storage"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AIRecognizeHandler handles AI recognition operations
type AIRecognizeHandler struct {
	provider ai.Provider
	storage  storage.Storage
	db       *gorm.DB
	config   *config.AIConfig
}

// NewAIRecognizeHandler creates a new AI recognition handler
func NewAIRecognizeHandler(provider ai.Provider, storage storage.Storage, db *gorm.DB, cfg *config.AIConfig) *AIRecognizeHandler {
	return &AIRecognizeHandler{
		provider: provider,
		storage:  storage,
		db:       db,
		config:   cfg,
	}
}

// RecognizeRequest represents the recognition request
type RecognizeRequest struct {
	Type string `form:"type"` // product, receipt, barcode
}

// RecognizeResponse represents the recognition response
type RecognizeResponse struct {
	Items    []ai.RecognizedItem `json:"items"`
	Provider string              `json:"provider"`
	Model    string              `json:"model"`
	FileURL  string              `json:"file_url,omitempty"`
}

// Recognize handles file upload and AI recognition
// POST /api/v1/ai/recognize
func (h *AIRecognizeHandler) Recognize(c *gin.Context) {
	// Check if AI is configured
	if h.provider == nil || !h.provider.IsAvailable() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "AI recognition is not configured",
			"hint":  "Please set AI_API_KEY environment variable",
		})
		return
	}

	// Get recognition type
	recType := c.DefaultPostForm("type", "product")
	var recognitionType ai.RecognitionType
	switch recType {
	case "receipt":
		recognitionType = ai.RecognitionTypeReceipt
	case "barcode":
		recognitionType = ai.RecognitionTypeBarcode
	default:
		recognitionType = ai.RecognitionTypeProduct
	}

	// Get uploaded file
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Validate file size
	const maxFileSize = 10 * 1024 * 1024 // 10MB
	if header.Size > maxFileSize {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "File too large, max 10MB"})
		return
	}

	// Read file content
	fileData := make([]byte, header.Size)
	if _, err := file.Read(fileData); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// Save the file for reference (使用已读取的 fileData，避免重复读取已消耗的 body)
	fileInfo, err := h.storage.Save(header.Filename, io.NopCloser(bytes.NewBuffer(fileData)))
	if err == nil && fileInfo != nil {
		defer h.storage.Delete(fileInfo.ID)
	}

	// Resize large images to reduce API costs and latency
	if contentType := header.Header.Get("Content-Type"); contentType != "application/pdf" {
		fileData = ai.ResizeImageIfNeeded(fileData, 1536)
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Perform recognition based on file type
	contentType := header.Header.Get("Content-Type")
	var result *ai.RecognitionResult

	if contentType == "application/pdf" {
		result, err = h.provider.RecognizeFromPDF(ctx, fileData)
	} else {
		result, err = h.provider.RecognizeFromImage(ctx, fileData, recognitionType)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "AI recognition failed: " + err.Error(),
		})
		return
	}

	response := RecognizeResponse{
		Items:    result.Items,
		Provider: result.Provider,
		Model:    result.Model,
	}

	if fileInfo != nil {
		response.FileURL = fileInfo.URL
	}

	c.JSON(http.StatusOK, response)
}

// BatchCreateItems creates multiple items from recognition result
// POST /api/v1/items/batch
func (h *AIRecognizeHandler) BatchCreateItems(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)

	var req struct {
		Items []struct {
			Name        string  `json:"name" binding:"required"`
			Barcode     string  `json:"barcode"`
			Quantity    int     `json:"quantity"`
			Unit        string  `json:"unit"`
			Price       float64 `json:"price"`
			Cost        float64 `json:"cost"`
			ExpiredAt   *string `json:"expired_at"`
			Description string  `json:"description"`
			CategoryID  *uint   `json:"category_id"`
			LocationID  *uint   `json:"location_id"`
		} `json:"items" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var createdItems []models.Item
	var errors []string

	for i, itemReq := range req.Items {
		item := models.Item{
			Name:        itemReq.Name,
			Barcode:     itemReq.Barcode,
			Quantity:    itemReq.Quantity,
			Unit:        itemReq.Unit,
			Price:       itemReq.Price,
			Cost:        itemReq.Cost,
			Description: itemReq.Description,
			CategoryID:  itemReq.CategoryID,
			LocationID:  itemReq.LocationID,
			UserID:      userID,
			TenantID:    tenantID,
		}

		// Parse expired_at if provided
		if itemReq.ExpiredAt != nil && *itemReq.ExpiredAt != "" {
			t, err := time.Parse("2006-01-02", *itemReq.ExpiredAt)
			if err == nil {
				item.ExpiredAt = &t
			}
		}

		if err := h.db.Create(&item).Error; err != nil {
			errors = append(errors, "Item "+string(rune(i+1))+": "+err.Error())
			continue
		}

		// Load relations
		h.db.Preload("Category").Preload("Location").First(&item, item.ID)
		createdItems = append(createdItems, item)
	}

	c.JSON(http.StatusCreated, gin.H{
		"items":      createdItems,
		"created":    len(createdItems),
		"failed":     len(errors),
		"errors":     errors,
	})
}

// GetAIStatus returns the current AI configuration status
// GET /api/v1/ai/status
func (h *AIRecognizeHandler) GetAIStatus(c *gin.Context) {
	status := gin.H{
		"configured": h.provider != nil && h.provider.IsAvailable(),
		"provider":   "",
		"model":      "",
	}

	if h.provider != nil {
		status["provider"] = h.provider.GetName()
		status["model"] = h.config.Model
		status["available"] = h.provider.IsAvailable()
	}

	c.JSON(http.StatusOK, status)
}

// GetProviders returns available AI providers
// GET /api/v1/ai/providers
func (h *AIRecognizeHandler) GetProviders(c *gin.Context) {
	providers := ai.GetSupportedProviders()
	result := make([]gin.H, len(providers))

	for i, p := range providers {
		info := ai.GetProviderInfo(p)
		result[i] = gin.H{
			"id":          p,
			"name":        info["name"],
			"description": info["description"],
			"models":      info["models"],
		}
	}

	c.JSON(http.StatusOK, gin.H{"providers": result})
}
