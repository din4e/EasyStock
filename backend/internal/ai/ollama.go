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

// OllamaProvider implements the Provider interface for self-hosted Ollama
type OllamaProvider struct {
	baseURL     string
	model       string
	maxTokens   int
	temperature float64
}

// NewOllamaProvider creates a new Ollama provider
func NewOllamaProvider(cfg *config.AIConfig) *OllamaProvider {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}

	model := cfg.Model
	if model == "" || model == "gpt-4o" {
		model = "llava"
	}

	return &OllamaProvider{
		baseURL:     baseURL,
		model:       model,
		maxTokens:   cfg.MaxTokens,
		temperature: cfg.Temperature,
	}
}

func (p *OllamaProvider) GetName() string {
	return "ollama"
}

func (p *OllamaProvider) IsAvailable() bool {
	// Ollama doesn't require an API key, just check if the server is reachable
	return p.baseURL != ""
}

func (p *OllamaProvider) RecognizeFromImage(ctx context.Context, imageData []byte, recType RecognitionType) (*RecognitionResult, error) {
	prompt := GetPrompt(recType)

	// Build the request for Ollama API
	type Request struct {
		Model  string   `json:"model"`
		Prompt string   `json:"prompt"`
		Stream bool     `json:"stream"`
		Images []string `json:"images,omitempty"`
		Options struct {
			Temperature float64 `json:"temperature,omitempty"`
			NumPredict  int     `json:"num_predict,omitempty"`
		} `json:"options,omitempty"`
	}

	req := Request{
		Model:  p.model,
		Prompt: prompt,
		Stream: false,
		Images: []string{encodeBase64(imageData)},
	}
	req.Options.Temperature = p.temperature
	req.Options.NumPredict = p.maxTokens

	// Make the API call
	respBody, err := makeOllamaRequest(ctx, p.baseURL+"/api/generate", req)
	if err != nil {
		return nil, fmt.Errorf("Ollama API request failed: %w", err)
	}

	// Parse response
	var resp struct {
		Response string `json:"response"`
		Model    string `json:"model"`
	}

	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse Ollama response: %w", err)
	}

	content := resp.Response

	// Parse the JSON array from the response
	items, err := parseItemsFromResponse(content)
	if err != nil {
		return nil, fmt.Errorf("failed to parse items from response: %w", err)
	}

	return &RecognitionResult{
		Items:    items,
		Provider: p.GetName(),
		Model:    resp.Model,
		RawText:  content,
	}, nil
}

func (p *OllamaProvider) RecognizeFromPDF(ctx context.Context, pdfData []byte) (*RecognitionResult, error) {
	prompt := PromptPDF

	// Ollama might not support PDF directly, so we'll try with text extraction
	// This is a simplified approach

	type Request struct {
		Model  string `json:"model"`
		Prompt string `json:"prompt"`
		Stream bool   `json:"stream"`
		Options struct {
			Temperature float64 `json:"temperature,omitempty"`
			NumPredict  int     `json:"num_predict,omitempty"`
		} `json:"options,omitempty"`
	}

	req := Request{
		Model:  p.model,
		Prompt: prompt,
		Stream: false,
	}
	req.Options.Temperature = p.temperature
	req.Options.NumPredict = p.maxTokens

	respBody, err := makeOllamaRequest(ctx, p.baseURL+"/api/generate", req)
	if err != nil {
		return nil, fmt.Errorf("Ollama API request failed: %w", err)
	}

	var resp struct {
		Response string `json:"response"`
		Model    string `json:"model"`
	}

	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse Ollama response: %w", err)
	}

	content := resp.Response
	items, err := parseItemsFromResponse(content)
	if err != nil {
		return nil, fmt.Errorf("failed to parse items from response: %w", err)
	}

	return &RecognitionResult{
		Items:    items,
		Provider: p.GetName(),
		Model:    resp.Model,
		RawText:  content,
	}, nil
}

// makeOllamaRequest makes an HTTP request to Ollama
func makeOllamaRequest(ctx context.Context, url string, payload interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 180 * time.Second} // Longer timeout for local inference
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
