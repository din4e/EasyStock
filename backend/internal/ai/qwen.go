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

// QwenProvider implements the Provider interface for Alibaba's Qwen (通义千问)
type QwenProvider struct {
	apiKey      string
	baseURL     string
	model       string
	maxTokens   int
	temperature float64
}

// NewQwenProvider creates a new Qwen provider
func NewQwenProvider(cfg *config.AIConfig) *QwenProvider {
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = "https://dashscope.aliyuncs.com/api/v1"
	}

	model := cfg.Model
	if model == "" || model == "gpt-4o" {
		model = "qwen-vl-max"
	}

	return &QwenProvider{
		apiKey:      cfg.APIKey,
		baseURL:     baseURL,
		model:       model,
		maxTokens:   cfg.MaxTokens,
		temperature: cfg.Temperature,
	}
}

func (p *QwenProvider) GetName() string {
	return "qwen"
}

func (p *QwenProvider) IsAvailable() bool {
	return p.apiKey != ""
}

func (p *QwenProvider) RecognizeFromImage(ctx context.Context, imageData []byte, recType RecognitionType) (*RecognitionResult, error) {
	if !p.IsAvailable() {
		return nil, fmt.Errorf("Qwen provider not configured: missing API key")
	}

	prompt := GetPrompt(recType)

	dataURL := fmt.Sprintf("data:image/jpeg;base64,%s", encodeBase64(imageData))

	// Build the request for Qwen VL API
	reqBody := map[string]interface{}{
		"model": p.model,
		"input": map[string]interface{}{
			"messages": []map[string]interface{}{
				{
					"role": "user",
					"content": []map[string]interface{}{
						{"type": "text", "text": prompt},
						{"type": "image_url", "image_url": map[string]string{"url": dataURL}},
					},
				},
			},
		},
		"parameters": map[string]interface{}{
			"max_tokens":   p.maxTokens,
			"temperature":  p.temperature,
			"result_format": "message",
		},
	}

	// Make the API call
	respBody, err := makeQwenRequest(ctx, p.baseURL+"/services/aigc/multimodal-generation/generation", p.apiKey, reqBody)
	if err != nil {
		return nil, fmt.Errorf("Qwen API request failed: %w", err)
	}

	// Parse response
	var resp struct {
		Output struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		} `json:"output"`
	}

	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse Qwen response: %w", err)
	}

	if len(resp.Output.Choices) == 0 {
		return nil, fmt.Errorf("no response from Qwen")
	}

	content := resp.Output.Choices[0].Message.Content

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

func (p *QwenProvider) RecognizeFromPDF(ctx context.Context, pdfData []byte) (*RecognitionResult, error) {
	if !p.IsAvailable() {
		return nil, fmt.Errorf("Qwen provider not configured: missing API key")
	}

	// For Qwen, PDF support might be limited, so we use text-based approach
	// In production, you'd want to extract text from PDF first

	prompt := PromptPDF + "\n\n以下是PDF文档的内容（已转换为文本）："

	// Note: This is a simplified approach. In production, use a PDF parser.
	reqBody := map[string]interface{}{
		"model": "qwen-max",
		"input": map[string]interface{}{
			"messages": []map[string]interface{}{
				{
					"role":    "user",
					"content": prompt,
				},
			},
		},
		"parameters": map[string]interface{}{
			"max_tokens":    p.maxTokens,
			"temperature":   p.temperature,
			"result_format": "message",
		},
	}

	respBody, err := makeQwenRequest(ctx, p.baseURL+"/services/aigc/text-generation/generation", p.apiKey, reqBody)
	if err != nil {
		return nil, fmt.Errorf("Qwen API request failed: %w", err)
	}

	var resp struct {
		Output struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		} `json:"output"`
	}

	if err := json.Unmarshal(respBody, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse Qwen response: %w", err)
	}

	if len(resp.Output.Choices) == 0 {
		return nil, fmt.Errorf("no response from Qwen")
	}

	content := resp.Output.Choices[0].Message.Content
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

// makeQwenRequest makes an HTTP request with Qwen-specific headers
func makeQwenRequest(ctx context.Context, url, apiKey string, payload interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

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
