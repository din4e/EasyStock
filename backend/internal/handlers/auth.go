package handlers

import (
	"log"
	"net/http"

	"easystock/internal/config"
	"easystock/internal/models"
	"easystock/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db     *gorm.DB
	cfg    *config.JWTConfig
	config *config.Config
}

func NewAuthHandler(db *gorm.DB, cfg *config.JWTConfig) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

// NewAuthHandlerWithConfig 创建带有完整配置的 AuthHandler
func NewAuthHandlerWithConfig(db *gorm.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: &cfg.JWT, config: cfg}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 检查用户名是否已存在
	var existingUser models.User
	if err := h.db.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "用户名已存在"})
		return
	}

	// 检查邮箱是否已存在
	if err := h.db.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "邮箱已被使用"})
		return
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码加密失败"})
		return
	}

	var tenantID uint
	var role string = "member"
	var tenant *models.Tenant

	// 处理租户逻辑
	// 本地模式：使用默认租户（ID=1）
	mode := "unknown"
	if h.config != nil {
		mode = h.config.Deployment.Mode
	}
	log.Printf("[DEBUG] h.config=%v, mode=%s", h.config != nil, mode)
	if h.config == nil || h.config.Deployment.Mode == "local" {
		// 本地模式：使用默认租户（ID=1）
		var defaultTenant models.Tenant
		if err := h.db.First(&defaultTenant, 1).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "默认租户不存在"})
			return
		}
		tenantID = defaultTenant.ID
		tenant = &defaultTenant

		// 本地模式第一个用户成为管理员
		var userCount int64
		h.db.Model(&models.User{}).Count(&userCount)
		if userCount == 0 {
			role = "admin"
		}
	} else {
		// SaaS 模式
		if req.InviteCode != "" {
			// 通过邀请码加入现有租户
			// TODO: 实现邀请码逻辑
			c.JSON(http.StatusBadRequest, gin.H{"error": "邀请码无效或已过期"})
			return
		} else if req.TenantName != "" {
			// 创建新租户
			tenant = &models.Tenant{
				Name:       req.TenantName,
				Slug:       generateSlug(req.TenantName),
				Plan:       "free",
				Status:     "active",
				MaxMembers: 3,
				MaxStorage: 100 * 1024 * 1024, // 100MB
				Language:   "zh-CN",
			}
			if err := h.db.Create(tenant).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "创建组织失败"})
				return
			}
			tenantID = tenant.ID
			role = "owner" // 创建者成为所有者
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "请提供组织名称或邀请码"})
			return
		}
	}

	// Create user
	user := models.User{
		Username: req.Username,
		Email:    req.Email,
		Password: hashedPassword,
		Nickname: req.Nickname,
		Role:     role,
		TenantID: tenantID,
		IsActive: true,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建用户失败"})
		return
	}

	// Generate token
	token, err := utils.GenerateToken(user.ID, user.Username, user.Role, user.TenantID, h.cfg.ExpireHour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
		return
	}

	c.JSON(http.StatusCreated, models.AuthResponse{
		Token:     token,
		User:      user,
		Tenant:    tenant,
		IsNewUser: true,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user with tenant info
	var user models.User
	if err := h.db.Preload("Tenant").Where("username = ?", req.Username).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	// Check if user is active
	if !user.IsActive {
		c.JSON(http.StatusForbidden, gin.H{"error": "账户已被禁用"})
		return
	}

	// Check password
	if !utils.CheckPassword(req.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	// Check tenant status (SaaS mode)
	if user.Tenant != nil && user.Tenant.Status == "suspended" {
		c.JSON(http.StatusForbidden, gin.H{"error": "组织已被暂停，请联系客服"})
		return
	}

	// Generate token
	token, err := utils.GenerateToken(user.ID, user.Username, user.Role, user.TenantID, h.cfg.ExpireHour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "生成令牌失败"})
		return
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		Token:  token,
		User:   user,
		Tenant: user.Tenant,
	})
}

func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID := c.GetUint("user_id")

	var user models.User
	if err := h.db.Preload("Tenant").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID := c.GetUint("user_id")

	var req struct {
		Nickname string `json:"nickname"`
		Email    string `json:"email"`
		Avatar   string `json:"avatar"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
		return
	}

	if req.Nickname != "" {
		user.Nickname = req.Nickname
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Avatar != "" {
		user.Avatar = req.Avatar
	}

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// generateSlug 生成 URL 友好的 slug
func generateSlug(name string) string {
	// TODO: 实现更完善的 slug 生成逻辑
	// 简化版本：使用时间戳
	return name
}
