package handlers

import (
	"net/http"
	"strconv"

	"easystock/internal/models"
	"easystock/internal/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UserHandler struct {
	db *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{db: db}
}

// List 获取租户下所有用户
func (h *UserHandler) List(c *gin.Context) {
	tenantID := c.GetUint("tenant_id")

	var users []models.User
	if err := h.db.Where("tenant_id = ?", tenantID).Order("created_at desc").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户列表失败"})
		return
	}

	// 不返回密码
	for i := range users {
		users[i].Password = ""
	}

	c.JSON(http.StatusOK, users)
}

// Get 获取单个用户
func (h *UserHandler) Get(c *gin.Context) {
	targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	currentUserID := c.GetUint("user_id")
	currentRole := c.GetString("role")
	tenantID := c.GetUint("tenant_id")

	// 普通用户只能查看自己
	if currentRole != "owner" && currentRole != "admin" && uint(targetID) != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权限查看该用户"})
		return
	}

	var user models.User
	if err := h.db.Where("id = ? AND tenant_id = ?", targetID, tenantID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户失败"})
		return
	}

	user.Password = ""
	c.JSON(http.StatusOK, user)
}

// Update 更新用户信息
func (h *UserHandler) Update(c *gin.Context) {
	targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	currentUserID := c.GetUint("user_id")
	currentRole := c.GetString("role")
	tenantID := c.GetUint("tenant_id")

	var req struct {
		Nickname string `json:"nickname"`
		Email    string `json:"email"`
		Role     string `json:"role"`
		IsActive *bool  `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("id = ? AND tenant_id = ?", targetID, tenantID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户失败"})
		return
	}

	// 普通用户只能修改自己的昵称和邮箱
	if currentRole != "owner" && currentRole != "admin" {
		if uint(targetID) != currentUserID {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限修改该用户"})
			return
		}
		// 普通用户只能改昵称
		if req.Role != "" || req.IsActive != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限修改该字段"})
			return
		}
		if req.Nickname != "" {
			user.Nickname = req.Nickname
		}
		if req.Email != "" {
			user.Email = req.Email
		}
	} else {
		// 管理员可以修改昵称、邮箱、角色、激活状态
		if req.Nickname != "" {
			user.Nickname = req.Nickname
		}
		if req.Email != "" {
			// 检查邮箱是否被他人使用
			var existing models.User
			if err := h.db.Where("email = ? AND id != ? AND tenant_id = ?", req.Email, targetID, tenantID).First(&existing).Error; err == nil {
				c.JSON(http.StatusConflict, gin.H{"error": "邮箱已被使用"})
				return
			}
			user.Email = req.Email
		}
		if req.Role != "" {
			// 防止修改 owner
			if user.Role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "无法修改所有者角色"})
				return
			}
			// 只能设置为 admin/member/readonly
			if req.Role != "admin" && req.Role != "member" && req.Role != "readonly" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "无效的角色"})
				return
			}
			user.Role = req.Role
		}
		if req.IsActive != nil {
			// 防止禁用 owner
			if user.Role == "owner" {
				c.JSON(http.StatusForbidden, gin.H{"error": "无法禁用所有者"})
				return
			}
			user.IsActive = *req.IsActive
		}
	}

	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败"})
		return
	}

	user.Password = ""
	c.JSON(http.StatusOK, user)
}

// Delete 删除/禁用用户
func (h *UserHandler) Delete(c *gin.Context) {
	targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	currentUserID := c.GetUint("user_id")
	tenantID := c.GetUint("tenant_id")

	if uint(targetID) == currentUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法删除自己"})
		return
	}

	var user models.User
	if err := h.db.Where("id = ? AND tenant_id = ?", targetID, tenantID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户失败"})
		return
	}

	// 防止删除 owner
	if user.Role == "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "无法删除所有者"})
		return
	}

	// 软删除
	if err := h.db.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "用户已删除"})
}

// UpdatePassword 修改密码
func (h *UserHandler) UpdatePassword(c *gin.Context) {
	targetID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户ID"})
		return
	}

	currentUserID := c.GetUint("user_id")
	currentRole := c.GetString("role")
	tenantID := c.GetUint("tenant_id")

	// 普通用户只能改自己的密码，管理员可以改任意用户密码
	if currentRole != "owner" && currentRole != "admin" && uint(targetID) != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "无权限修改该用户密码"})
		return
	}

	var req struct {
		OldPassword string `json:"old_password"` // 修改自己密码时需要
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("id = ? AND tenant_id = ?", targetID, tenantID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取用户失败"})
		return
	}

	// 修改自己密码需要验证旧密码
	if uint(targetID) == currentUserID && req.OldPassword != "" {
		if !utils.CheckPassword(req.OldPassword, user.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "原密码错误"})
			return
		}
	} else if uint(targetID) == currentUserID && req.OldPassword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请提供原密码"})
		return
	}

	hashedPassword, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码加密失败"})
		return
	}

	user.Password = hashedPassword
	if err := h.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "修改密码失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "密码修改成功"})
}
