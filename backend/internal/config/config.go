package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Server     ServerConfig
	Database   DatabaseConfig
	JWT        JWTConfig
	AI         AIConfig
	Storage    StorageConfig
	Deployment DeploymentConfig
	SaaS       SaaSConfig
}

type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	Type     string // sqlite, postgres, mysql
}

type JWTConfig struct {
	Secret     string
	ExpireHour int
}

type AIConfig struct {
	Provider    string  // openai, anthropic, qwen, ollama
	APIKey      string
	BaseURL     string  // Custom endpoint for self-hosted or proxy
	Model       string  // gpt-4o, claude-3-5-sonnet, qwen-vl-max, etc.
	MaxTokens   int
	Temperature float64
}

type StorageConfig struct {
	Type         string   // local, s3
	LocalPath    string   // Local storage path
	MaxSize      int64    // Max file size in bytes
	AllowedTypes []string // Allowed MIME types
}

// DeploymentConfig 部署模式配置
type DeploymentConfig struct {
	Mode string // "local" 本地部署, "saas" SaaS模式
}

// SaaSConfig SaaS 模式专用配置
type SaaSConfig struct {
	Enabled           bool   // 是否启用 SaaS 功能
	AlipayAppID       string // 支付宝应用ID
	AlipayPrivateKey  string // 支付宝应用私钥
	AlipayPublicKey   string // 支付宝公钥
	WechatAppID       string // 微信公众号/小程序 AppID
	WechatMchID       string // 微信支付商户号
	WechatAPIKey      string // 微信支付 API 密钥
	WechatCertPath    string // 微信支付证书路径
	TrialDays         int    // 试用期天数
	MaxMembersFree    int    // 免费版最大成员数
	MaxMembersPro     int    // 专业版最大成员数
	MaxStorageFree    int64  // 免费版存储限制 (bytes)
	MaxStoragePro     int64  // 专业版存储限制 (bytes)
}

func Load() *Config {
	deploymentMode := getEnv("DEPLOYMENT_MODE", "local")
	isSaaS := deploymentMode == "saas"

	return &Config{
		Server: ServerConfig{
			Port:         getEnv("SERVER_PORT", "8080"),
			ReadTimeout:  getDurationEnv("SERVER_READ_TIMEOUT", 30*time.Second),
			WriteTimeout: getDurationEnv("SERVER_WRITE_TIMEOUT", 30*time.Second),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getIntEnv("DB_PORT", 5432),
			User:     getEnv("DB_USER", "easystock"),
			Password: getEnv("DB_PASSWORD", "easystock"),
			DBName:   getEnv("DB_NAME", "easystock"),
			Type:     getEnv("DB_TYPE", "sqlite"),
		},
		JWT: JWTConfig{
			Secret:     getEnv("JWT_SECRET", "easystock-secret-key"),
			ExpireHour: getIntEnv("JWT_EXPIRE_HOUR", 24),
		},
		AI: AIConfig{
			Provider:    getEnv("AI_PROVIDER", "openai"),
			APIKey:      getEnv("AI_API_KEY", ""),
			BaseURL:     getEnv("AI_BASE_URL", ""),
			Model:       getEnv("AI_MODEL", "gpt-4o"),
			MaxTokens:   getIntEnv("AI_MAX_TOKENS", 4096),
			Temperature: getFloatEnv("AI_TEMPERATURE", 0.3),
		},
		Storage: StorageConfig{
			Type:      getEnv("STORAGE_TYPE", "local"),
			LocalPath: getEnv("STORAGE_LOCAL_PATH", "./uploads"),
			MaxSize:   int64(getIntEnv("STORAGE_MAX_SIZE", 10*1024*1024)), // 10MB default
			AllowedTypes: []string{
				"image/jpeg", "image/png", "image/gif", "image/webp",
				"application/pdf",
				"application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			},
		},
		Deployment: DeploymentConfig{
			Mode: deploymentMode,
		},
		SaaS: SaaSConfig{
			Enabled:          isSaaS,
			AlipayAppID:      getEnv("ALIPAY_APP_ID", ""),
			AlipayPrivateKey: getEnv("ALIPAY_PRIVATE_KEY", ""),
			AlipayPublicKey:  getEnv("ALIPAY_PUBLIC_KEY", ""),
			WechatAppID:      getEnv("WECHAT_APP_ID", ""),
			WechatMchID:      getEnv("WECHAT_MCH_ID", ""),
			WechatAPIKey:     getEnv("WECHAT_API_KEY", ""),
			WechatCertPath:   getEnv("WECHAT_CERT_PATH", ""),
			TrialDays:        getIntEnv("SAAS_TRIAL_DAYS", 14),
			MaxMembersFree:   getIntEnv("SAAS_MAX_MEMBERS_FREE", 3),
			MaxMembersPro:    getIntEnv("SAAS_MAX_MEMBERS_PRO", 50),
			MaxStorageFree:   int64(getIntEnv("SAAS_MAX_STORAGE_FREE", 100*1024*1024)),   // 100MB
			MaxStoragePro:    int64(getIntEnv("SAAS_MAX_STORAGE_PRO", 10*1024*1024*1024)), // 10GB
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

func getFloatEnv(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatVal, err := strconv.ParseFloat(value, 64); err == nil {
			return floatVal
		}
	}
	return defaultValue
}

func getSliceEnv(key string, defaultValue []string) []string {
	if value := os.Getenv(key); value != "" {
		var result []string
		for _, v := range splitString(value, ",") {
			if trimmed := trimSpace(v); trimmed != "" {
				result = append(result, trimmed)
			}
		}
		if len(result) > 0 {
			return result
		}
	}
	return defaultValue
}

func splitString(s, sep string) []string {
	return strings.Split(s, sep)
}

func trimSpace(s string) string {
	return strings.TrimSpace(s)
}
