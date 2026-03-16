package middleware

import (
	"net/http"
	"strings"

	"easystock/internal/utils"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Bearer token required"})
			c.Abort()
			return
		}

		claims, err := utils.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Set("tenant_id", claims.TenantID)
		c.Next()
	}
}

func GetUserID(c *gin.Context) uint {
	userID, exists := c.Get("user_id")
	if !exists {
		return 0
	}
	return userID.(uint)
}

func GetUserRole(c *gin.Context) string {
	role, exists := c.Get("role")
	if !exists {
		return ""
	}
	return role.(string)
}

func GetTenantID(c *gin.Context) uint {
	tenantID, exists := c.Get("tenant_id")
	if !exists {
		return 0
	}
	return tenantID.(uint)
}

// RequireRole 检查用户角色
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole := GetUserRole(c)
		for _, role := range roles {
			if userRole == role {
				c.Next()
				return
			}
		}
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

// RequireOwner 仅限组织所有者
func RequireOwner() gin.HandlerFunc {
	return RequireRole("owner")
}

// RequireAdmin 仅限管理员及以上
func RequireAdmin() gin.HandlerFunc {
	return RequireRole("owner", "admin")
}
