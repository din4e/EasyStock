package handlers

import (
	"net/http"
	"strconv"

	"easystock/internal/middleware"
	"easystock/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LocationHandler struct {
	db *gorm.DB
}

func NewLocationHandler(db *gorm.DB) *LocationHandler {
	return &LocationHandler{db: db}
}

func (h *LocationHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)

	var req models.LocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Calculate level based on parent
	level := 0
	if req.ParentID != nil {
		var parent models.Location
		if err := h.db.Where("id = ? AND tenant_id = ?", *req.ParentID, tenantID).First(&parent).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "父级位置不存在"})
			return
		}
		level = parent.Level + 1

		// Check max depth (5 levels)
		if level > 4 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "超过最大层级限制（5级）"})
			return
		}
	}

	location := models.Location{
		Name:        req.Name,
		Description: req.Description,
		Icon:        req.Icon,
		ParentID:    req.ParentID,
		SortOrder:   req.SortOrder,
		Level:       level,
		UserID:      userID,
		TenantID:    tenantID,
	}

	if err := h.db.Create(&location).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建位置失败"})
		return
	}

	c.JSON(http.StatusCreated, location)
}

func (h *LocationHandler) List(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	format := c.Query("format")

	var locations []models.Location
	if err := h.db.Where("tenant_id = ?", tenantID).Order("sort_order, name").Find(&locations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取位置列表失败"})
		return
	}

	// If tree format requested, build tree structure
	if format == "tree" {
		tree := h.buildLocationTree(locations, nil)
		c.JSON(http.StatusOK, tree)
		return
	}

	c.JSON(http.StatusOK, locations)
}

// buildLocationTree recursively builds a tree structure from flat locations
func (h *LocationHandler) buildLocationTree(locations []models.Location, parentID *uint) []models.Location {
	var result []models.Location
	for _, loc := range locations {
		// Match locations with the given parentID
		if (parentID == nil && loc.ParentID == nil) || (parentID != nil && loc.ParentID != nil && *loc.ParentID == *parentID) {
			// Recursively find children
			loc.Children = h.buildLocationTree(locations, &loc.ID)
			result = append(result, loc)
		}
	}
	return result
}

func (h *LocationHandler) Get(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var location models.Location
	if err := h.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&location).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "位置不存在"})
		return
	}

	c.JSON(http.StatusOK, location)
}

func (h *LocationHandler) Update(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req models.LocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var location models.Location
	if err := h.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&location).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "位置不存在"})
		return
	}

	// Check for circular reference (item becoming its own ancestor)
	if req.ParentID != nil {
		if *req.ParentID == location.ID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "不能将自己设为父级"})
			return
		}
		// Check if new parent is a descendant
		if h.isDescendant(location.ID, *req.ParentID, tenantID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "检测到循环引用"})
			return
		}
	}

	// Calculate new level
	level := 0
	if req.ParentID != nil {
		var parent models.Location
		if err := h.db.Where("id = ? AND tenant_id = ?", *req.ParentID, tenantID).First(&parent).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "父级位置不存在"})
			return
		}
		level = parent.Level + 1

		// Check max depth
		if level > 4 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "超过最大层级限制（5级）"})
			return
		}
	}

	location.Name = req.Name
	location.Description = req.Description
	location.Icon = req.Icon
	location.ParentID = req.ParentID
	location.SortOrder = req.SortOrder
	location.Level = level

	if err := h.db.Save(&location).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新位置失败"})
		return
	}

	c.JSON(http.StatusOK, location)
}

// isDescendant checks if potentialChildID is a descendant of parentID
func (h *LocationHandler) isDescendant(parentID, potentialChildID uint, tenantID uint) bool {
	var children []models.Location
	h.db.Where("parent_id = ? AND tenant_id = ?", parentID, tenantID).Find(&children)

	for _, child := range children {
		if child.ID == potentialChildID {
			return true
		}
		if h.isDescendant(child.ID, potentialChildID, tenantID) {
			return true
		}
	}
	return false
}

func (h *LocationHandler) Delete(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	// Check for children
	var childCount int64
	h.db.Model(&models.Location{}).Where("parent_id = ? AND tenant_id = ?", id, tenantID).Count(&childCount)
	if childCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法删除有子级的位置，请先删除或移动子级"})
		return
	}

	// Check for items
	var itemCount int64
	h.db.Model(&models.Item{}).Where("location_id = ?", id).Count(&itemCount)
	if itemCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法删除有物品的位置，请先移动或删除物品"})
		return
	}

	if err := h.db.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&models.Location{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除位置失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "位置已删除"})
}

// Reorder handles batch reordering of locations
func (h *LocationHandler) Reorder(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var req models.ReorderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Start transaction
	tx := h.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	for _, item := range req.Items {
		// Verify ownership
		var location models.Location
		if err := tx.Where("id = ? AND tenant_id = ?", item.ID, tenantID).First(&location).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "位置不存在: " + strconv.FormatUint(uint64(item.ID), 10)})
			return
		}

		// Calculate new level if parent changed
		level := 0
		if item.ParentID != nil {
			var parent models.Location
			if err := tx.Where("id = ? AND tenant_id = ?", *item.ParentID, tenantID).First(&parent).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": "父级位置不存在"})
				return
			}
			level = parent.Level + 1

			// Check for circular reference
			if *item.ParentID == item.ID || h.isDescendant(item.ID, *item.ParentID, tenantID) {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": "检测到循环引用"})
				return
			}

			// Check max depth
			if level > 4 {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": "超过最大层级限制（5级）"})
				return
			}
		}

		// Update location
		updates := map[string]interface{}{
			"parent_id":  item.ParentID,
			"sort_order": item.SortOrder,
			"level":      level,
		}
		if err := tx.Model(&models.Location{}).Where("id = ?", item.ID).Updates(updates).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "更新位置失败"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "位置排序已更新"})
}
