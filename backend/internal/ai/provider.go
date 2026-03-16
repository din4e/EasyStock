package ai

import (
	"context"
)

// RecognitionType defines the type of AI recognition
type RecognitionType string

const (
	RecognitionTypeProduct RecognitionType = "product" // Product photo recognition
	RecognitionTypeReceipt RecognitionType = "receipt" // Receipt/invoice OCR
	RecognitionTypeBarcode RecognitionType = "barcode" // Barcode scanning
)

// RecognizedItem represents a single recognized item from AI
type RecognizedItem struct {
	Name        string  `json:"name"`
	Barcode     string  `json:"barcode,omitempty"`
	Quantity    int     `json:"quantity,omitempty"`
	Unit        string  `json:"unit,omitempty"`
	Price       float64 `json:"price,omitempty"`
	Cost        float64 `json:"cost,omitempty"`
	ExpiredAt   string  `json:"expired_at,omitempty"`
	Description string  `json:"description,omitempty"`
	Category    string  `json:"category,omitempty"`
	Brand       string  `json:"brand,omitempty"`
	Confidence  float64 `json:"confidence"`
}

// RecognitionResult is the complete result from AI recognition
type RecognitionResult struct {
	Items    []RecognizedItem `json:"items"`
	Provider string           `json:"provider"`
	Model    string           `json:"model"`
	RawText  string           `json:"raw_text,omitempty"`
}

// Provider defines the interface for AI providers
type Provider interface {
	// RecognizeFromImage recognizes items from an image (product photo, receipt, etc.)
	RecognizeFromImage(ctx context.Context, imageData []byte, recType RecognitionType) (*RecognitionResult, error)

	// RecognizeFromPDF recognizes items from a PDF document
	RecognizeFromPDF(ctx context.Context, pdfData []byte) (*RecognitionResult, error)

	// GetName returns the provider name
	GetName() string

	// IsAvailable checks if the provider is properly configured
	IsAvailable() bool
}
