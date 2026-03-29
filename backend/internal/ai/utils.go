package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// encodeBase64 encodes bytes to base64 string
func encodeBase64(data []byte) string {
	return base64.StdEncoding.EncodeToString(data)
}

// detectMediaType detects the MIME type from image data
func detectMediaType(data []byte) string {
	if len(data) < 4 {
		return "image/jpeg"
	}

	// Check magic numbers
	switch {
	case data[0] == 0xFF && data[1] == 0xD8:
		return "image/jpeg"
	case data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47:
		return "image/png"
	case data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46:
		return "image/gif"
	case data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46:
		return "image/webp"
	default:
		return "image/jpeg"
	}
}

// makeHTTPRequest makes an HTTP request with Bearer token authentication
func makeHTTPRequest(ctx context.Context, url, apiKey string, payload interface{}) ([]byte, error) {
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

	client := &http.Client{Timeout: 60 * time.Second}
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

// parseItemsFromResponse extracts JSON array from AI response
func parseItemsFromResponse(content string) ([]RecognizedItem, error) {
	// Try to find JSON array in the response
	// Sometimes AI adds markdown code blocks or extra text

	// First, try to extract JSON from code blocks
	jsonPattern := regexp.MustCompile("```(?:json)?\\s*([\\s\\S]*?)```")
	matches := jsonPattern.FindStringSubmatch(content)
	if len(matches) > 1 {
		content = strings.TrimSpace(matches[1])
	}

	// Find array pattern
	arrayStart := strings.Index(content, "[")
	arrayEnd := strings.LastIndex(content, "]")

	if arrayStart == -1 || arrayEnd == -1 || arrayEnd < arrayStart {
		return nil, fmt.Errorf("no JSON array found in response")
	}

	jsonArray := content[arrayStart : arrayEnd+1]

	var items []RecognizedItem
	if err := json.Unmarshal([]byte(jsonArray), &items); err != nil {
		return nil, fmt.Errorf("failed to parse JSON array: %w", err)
	}

	// Validate and clean up items
	var validItems []RecognizedItem
	for _, item := range items {
		if item.Name != "" {
			// Ensure confidence is within bounds
			if item.Confidence < 0 {
				item.Confidence = 0
			} else if item.Confidence > 1 {
				item.Confidence = 1
			}
			validItems = append(validItems, item)
		}
	}

	if len(validItems) == 0 {
		return nil, fmt.Errorf("no valid items found in response")
	}

	return validItems, nil
}

// resizeImageIfNeeded resizes images that exceed maxDim pixels on any side.
// Returns the original data if resizing is not needed or fails.
// Only handles JPEG and PNG; other formats are returned as-is.
func ResizeImageIfNeeded(data []byte, maxDim int) []byte {
	if len(data) < 4 {
		return data
	}

	// Only resize JPEG and PNG
	mediaType := detectMediaType(data)
	if mediaType != "image/jpeg" && mediaType != "image/png" {
		return data
	}

	// Decode image config to check dimensions without full decode
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return data // Can't decode, return original
	}

	// Check if resize is needed
	if config.Width <= maxDim && config.Height <= maxDim {
		return data
	}

	// Full decode
	img, err := decodeImage(data, mediaType)
	if err != nil {
		return data
	}

	// Calculate new dimensions
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w > maxDim {
		h = h * maxDim / w
		w = maxDim
	}
	if h > maxDim {
		w = w * maxDim / h
		h = maxDim
	}

	// Resize using simple nearest-neighbor (good enough for AI vision input)
	resized := resizeNearest(img, w, h)

	// Encode as JPEG
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: 85}); err != nil {
		return data
	}

	return buf.Bytes()
}

// decodeImage decodes an image from bytes based on media type
func decodeImage(data []byte, mediaType string) (image.Image, error) {
	reader := bytes.NewReader(data)
	switch mediaType {
	case "image/png":
		return png.Decode(reader)
	default:
		return jpeg.Decode(reader)
	}
}

// resizeNearest performs nearest-neighbor resizing
func resizeNearest(img image.Image, w, h int) image.Image {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	srcBounds := img.Bounds()
	sx := float64(srcBounds.Dx()) / float64(w)
	sy := float64(srcBounds.Dy()) / float64(h)

	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			srcX := int(float64(x) * sx)
			srcY := int(float64(y) * sy)
			dst.Set(x, y, img.At(srcBounds.Min.X+srcX, srcBounds.Min.Y+srcY))
		}
	}
	return dst
}
