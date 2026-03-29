package ai

import (
	"context"
	"encoding/json"
	"fmt"

	"easystock/internal/config"
)

// OpenAIProvider implements the Provider interface for OpenAI
type OpenAIProvider struct {
	apiKey      string
	baseURL     string
	model       string
	maxTokens   int
	temperature float64
}

// NewOpenAIProvider creates a new OpenAI provider
func NewOpenAIProvider(cfg *config.AIConfig) *OpenAIProvider {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}

	return &OpenAIProvider{
		apiKey:      cfg.APIKey,
		baseURL:     baseURL,
		model:       cfg.Model,
		maxTokens:   cfg.MaxTokens,
		temperature: cfg.Temperature,
	}
}

func (p *OpenAIProvider) GetName() string {
	return "openai"
}

func (p *OpenAIProvider) IsAvailable() bool {
	return p.apiKey != ""
}

func (p *OpenAIProvider) RecognizeFromImage(ctx context.Context, imageData []byte, recType RecognitionType) (*RecognitionResult, error) {
	if !p.IsAvailable() {
		return nil, fmt.Errorf("OpenAI provider not configured: missing API key")
	}

	prompt := GetPrompt(recType)

	// Build the request for OpenAI Vision API
	type ImageURL struct {
		URL string `json:"url"`
	}

	type Content struct {
		Type     string    `json:"type"`
		Text     string    `json:"text,omitempty"`
		ImageURL *ImageURL `json:"image_url,omitempty"`
	}

	type Message struct {
		Role    string    `json:"role"`
		Content []Content `json:"content"`
	}

	type Request struct {
		Model       string    `json:"model"`
		Messages    []Message `json:"messages"`
		MaxTokens   int       `json:"max_tokens"`
		Temperature float64   `json:"temperature"`
	}

	// Convert image to base64 data URL with correct media type
	mediaType := detectMediaType(imageData)
	dataURL := fmt.Sprintf("data:%s;base64,%s", mediaType, encodeBase64(imageData))

	req := Request{
		Model: p.model,
		Messages: []Message{
			{
				Role: "user",
				Content: []Content{
					{Type: "text", Text: prompt},
					{Type: "image_url", ImageURL: &ImageURL{URL: dataURL}},
				},
			},
		},
		MaxTokens:   p.maxTokens,
		Temperature: p.temperature,
	}

	// Make the API call
	respBody, err := makeHTTPRequest(ctx, p.baseURL+"/chat/completions", p.apiKey, req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API request failed: %w", err)
	}

	// Parse response
	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse OpenAI response: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}

	content := resp.Choices[0].Message.Content

	// Parse the JSON array from the response
	items, err := parseItemsFromResponse(content)
	if err != nil {
		return nil, fmt.Errorf("failed to parse items from response: %w", err)
	}

	return &RecognitionResult{
		Items:    items,
		Provider: p.GetName(),
		Model:    p.model,
		RawText:  content,
	}, nil
}

func (p *OpenAIProvider) RecognizeFromPDF(ctx context.Context, pdfData []byte) (*RecognitionResult, error) {
	if !p.IsAvailable() {
		return nil, fmt.Errorf("OpenAI provider not configured: missing API key")
	}

	// For PDF, we'll use the text content approach
	// In a production system, you'd want to extract text from PDF first
	// or use a PDF-to-image conversion

	// For now, we'll encode PDF as base64 and send it
	// Note: GPT-4o can handle PDFs directly in some cases
	prompt := PromptPDF

	type Content struct {
		Type string `json:"type"`
		Text string `json:"text,omitempty"`
		URL  string `json:"url,omitempty"`
	}

	type Message struct {
		Role    string    `json:"role"`
		Content []Content `json:"content"`
	}

	type Request struct {
		Model       string    `json:"model"`
		Messages    []Message `json:"messages"`
		MaxTokens   int       `json:"max_tokens"`
		Temperature float64   `json:"temperature"`
	}

	dataURL := fmt.Sprintf("data:application/pdf;base64,%s", encodeBase64(pdfData))

	req := Request{
		Model: p.model,
		Messages: []Message{
			{
				Role: "user",
				Content: []Content{
					{Type: "text", Text: prompt},
					{Type: "image_url", URL: dataURL},
				},
			},
		},
		MaxTokens:   p.maxTokens,
		Temperature: p.temperature,
	}

	respBody, err := makeHTTPRequest(ctx, p.baseURL+"/chat/completions", p.apiKey, req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI API request failed: %w", err)
	}

	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse OpenAI response: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response from OpenAI")
	}

	content := resp.Choices[0].Message.Content
	items, err := parseItemsFromResponse(content)
	if err != nil {
		return nil, fmt.Errorf("failed to parse items from response: %w", err)
	}

	return &RecognitionResult{
		Items:    items,
		Provider: p.GetName(),
		Model:    p.model,
		RawText:  content,
	}, nil
}
