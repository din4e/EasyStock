package ai

import (
	"fmt"

	"easystock/internal/config"
)

// NewProvider creates a new AI provider based on configuration
func NewProvider(cfg *config.AIConfig) (Provider, error) {
	if cfg.APIKey == "" && cfg.Provider != "ollama" {
		return nil, fmt.Errorf("AI API key is required for provider: %s", cfg.Provider)
	}

	switch cfg.Provider {
	case "openai":
		return NewOpenAIProvider(cfg), nil
	case "anthropic":
		return NewAnthropicProvider(cfg), nil
	case "qwen":
		return NewQwenProvider(cfg), nil
	case "ollama":
		return NewOllamaProvider(cfg), nil
	default:
		return nil, fmt.Errorf("unsupported AI provider: %s", cfg.Provider)
	}
}

// GetSupportedProviders returns a list of supported AI providers
func GetSupportedProviders() []string {
	return []string{"openai", "anthropic", "qwen", "ollama"}
}

// GetProviderInfo returns information about a specific provider
func GetProviderInfo(provider string) map[string]interface{} {
	infos := map[string]map[string]interface{}{
		"openai": {
			"name":        "OpenAI",
			"description": "GPT-4 Vision API for image recognition",
			"models":      []string{"gpt-4o", "gpt-4o-mini", "gpt-4-turbo"},
			"requires":    []string{"api_key"},
			"supports":    []string{"image", "pdf"},
		},
		"anthropic": {
			"name":        "Anthropic",
			"description": "Claude 3.5 Sonnet for image recognition",
			"models":      []string{"claude-3-5-sonnet-20241022", "claude-3-opus-20240229"},
			"requires":    []string{"api_key"},
			"supports":    []string{"image", "pdf"},
		},
		"qwen": {
			"name":        "Qwen (通义千问)",
			"description": "Alibaba's Qwen Vision Language model",
			"models":      []string{"qwen-vl-max", "qwen-vl-plus"},
			"requires":    []string{"api_key"},
			"supports":    []string{"image"},
		},
		"ollama": {
			"name":        "Ollama",
			"description": "Self-hosted vision models (llava, bakllava, etc.)",
			"models":      []string{"llava", "bakllava", "moondream"},
			"requires":    []string{"base_url"},
			"supports":    []string{"image"},
		},
	}

	if info, ok := infos[provider]; ok {
		return info
	}
	return nil
}
