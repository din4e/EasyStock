package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"easystock/internal/config"
)

// AnthropicProvider implements the Provider interface for Anthropic Claude
type AnthropicProvider struct {
	apiKey      string
	baseURL     string
	model       string
	maxTokens   int
	temperature float64
}

// NewAnthropicProvider creates a new Anthropic provider
func NewAnthropicProvider(cfg *config.AIConfig) *AnthropicProvider {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://api.anthropic.com/v1"
	}

	model := cfg.Model
	if model == "" || model == "gpt-4o" {
		model = "claude-3-5-sonnet-20241022"
	}

	return &AnthropicProvider{
		apiKey:      cfg.APIKey,
		baseURL:     baseURL,
		model:       model,
		maxTokens:   cfg.MaxTokens,
		temperature: cfg.Temperature,
	}
}

func (p *AnthropicProvider) GetName() string {
	return "anthropic"
}

func (p *AnthropicProvider) IsAvailable() bool {
	return p.apiKey != ""
}

func (p *AnthropicProvider) RecognizeFromImage(ctx context.Context, imageData []byte, recType RecognitionType) (*RecognitionResult, error) {
	if !p.IsAvailable() {
		return nil, fmt.Errorf("Anthropic provider not configured: missing API key")
	}

	prompt := GetPrompt(recType)

	// Build the request for Anthropic Messages API
	type ImageSource struct {
		Type      string `json:"type"`
		MediaType string `json:"media_type"`
		Data      string `json:"data"`
	}

	type Content struct {
		Type   string       `json:"type"`
		Text   string       `json:"text,omitempty"`
		Source *ImageSource `json:"source,omitempty"`
	}

	type AnthropicMessage struct {
		Role    string    `json:"role"`
		Content []Content `json:"content"`
	}

	type Request struct {
		Model       string             `json:"model"`
		MaxTokens   int                `json:"max_tokens"`
		Messages    []AnthropicMessage `json:"messages"`
		Temperature float64            `json:"temperature,omitempty"`
	}

	// Detect media type from image data
	mediaType := detectMediaType(imageData)

	req := Request{
		Model:     p.model,
		MaxTokens: p.maxTokens,
		Messages: []AnthropicMessage{
			{
				Role: "user",
				Content: []Content{
					{
						Type: "image",
						Source: &ImageSource{
							Type:      "base64",
							MediaType: mediaType,
							Data:      encodeBase64(imageData),
						},
					},
					{Type: "text", Text: prompt},
				},
			},
		},
		Temperature: p.temperature,
	}

	// Make the API call
	respBody, err := makeAnthropicRequest(ctx, p.baseURL+"/messages", p.apiKey, req)
	if err != nil {
		return nil, fmt.Errorf("Anthropic API request failed: %w", err)
	}

	// Parse response
	var resp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}

	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse Anthropic response: %w", err)
	}

	if len(resp.Content) == 0 {
		return nil, fmt.Errorf("no response from Anthropic")
	}

	content := resp.Content[0].Text

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

func (p *AnthropicProvider) RecognizeFromPDF(ctx context.Context, pdfData []byte) (*RecognitionResult, error) {
	if !p.IsAvailable() {
		return nil, fmt.Errorf("Anthropic provider not configured: missing API key")
	}

	prompt := PromptPDF

	type Content struct {
		Type   string `json:"type"`
		Text   string `json:"text,omitempty"`
		Source *struct {
			Type      string `json:"type"`
			MediaType string `json:"media_type"`
			Data      string `json:"data"`
		} `json:"source,omitempty"`
	}

	type AnthropicMessage struct {
		Role    string    `json:"role"`
		Content []Content `json:"content"`
	}

	type Request struct {
		Model       string             `json:"model"`
		MaxTokens   int                `json:"max_tokens"`
		Messages    []AnthropicMessage `json:"messages"`
		Temperature float64            `json:"temperature,omitempty"`
	}

	req := Request{
		Model:     p.model,
		MaxTokens: p.maxTokens,
		Messages: []AnthropicMessage{
			{
				Role: "user",
				Content: []Content{
					{
						Type: "document",
						Source: &struct {
							Type      string `json:"type"`
							MediaType string `json:"media_type"`
							Data      string `json:"data"`
						}{
							Type:      "base64",
							MediaType: "application/pdf",
							Data:      encodeBase64(pdfData),
						},
					},
					{Type: "text", Text: prompt},
				},
			},
		},
		Temperature: p.temperature,
	}

	respBody, err := makeAnthropicRequest(ctx, p.baseURL+"/messages", p.apiKey, req)
	if err != nil {
		return nil, fmt.Errorf("Anthropic API request failed: %w", err)
	}

	var resp struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}

	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse Anthropic response: %w", err)
	}

	if len(resp.Content) == 0 {
		return nil, fmt.Errorf("no response from Anthropic")
	}

	content := resp.Content[0].Text
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

// makeAnthropicRequest makes an HTTP request with Anthropic-specific headers
func makeAnthropicRequest(ctx context.Context, url, apiKey string, payload interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	return body, nil
}
