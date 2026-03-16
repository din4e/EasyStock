package handlers

import (
	"net/http"
	"strconv"

	"easystock/internal/middleware"
	"easystock/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CategoryHandler struct {
	db *gorm.DB
}

func NewCategoryHandler(db *gorm.DB) *CategoryHandler {
	return &CategoryHandler{db: db}
}

func (h *CategoryHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)

	var req models.CategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Calculate level based on parent
	level := 0
	if req.ParentID != nil {
		var parent models.Category
		if err := h.db.Where("id = ? AND tenant_id = ?", *req.ParentID, tenantID).First(&parent).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "父级分类不存在"})
			return
		}
		level = parent.Level + 1

		// Check max depth (5 levels)
		if level > 4 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "超过最大层级限制（5级）"})
			return
		}
	}

	category := models.Category{
		Name:        req.Name,
		Description: req.Description,
		Color:       req.Color,
		Icon:        req.Icon,
		ParentID:    req.ParentID,
		SortOrder:   req.SortOrder,
		Level:       level,
		UserID:      userID,
		TenantID:    tenantID,
	}

	if err := h.db.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建分类失败"})
		return
	}

	c.JSON(http.StatusCreated, category)
}

func (h *CategoryHandler) List(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	format := c.Query("format")

	var categories []models.Category
	if err := h.db.Where("tenant_id = ?", tenantID).Order("sort_order, name").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取分类列表失败"})
		return
	}

	// If tree format requested, build tree structure
	if format == "tree" {
		tree := h.buildCategoryTree(categories, nil)
		c.JSON(http.StatusOK, tree)
		return
	}

	c.JSON(http.StatusOK, categories)
}

// buildCategoryTree recursively builds a tree structure from flat categories
func (h *CategoryHandler) buildCategoryTree(categories []models.Category, parentID *uint) []models.Category {
	var result []models.Category
	for _, cat := range categories {
		// Match categories with the given parentID
		if (parentID == nil && cat.ParentID == nil) || (parentID != nil && cat.ParentID != nil && *cat.ParentID == *parentID) {
			// Recursively find children
			cat.Children = h.buildCategoryTree(categories, &cat.ID)
			result = append(result, cat)
		}
	}
	return result
}

func (h *CategoryHandler) Get(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var category models.Category
	if err := h.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&category).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	c.JSON(http.StatusOK, category)
}

func (h *CategoryHandler) Update(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req models.CategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var category models.Category
	if err := h.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&category).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "分类不存在"})
		return
	}

	// Check for circular reference (item becoming its own ancestor)
	if req.ParentID != nil {
		if *req.ParentID == category.ID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "不能将自己设为父级"})
			return
		}
		// Check if new parent is a descendant
		if h.isDescendant(category.ID, *req.ParentID, tenantID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "检测到循环引用"})
			return
		}
	}

	// Calculate new level
	level := 0
	if req.ParentID != nil {
		var parent models.Category
		if err := h.db.Where("id = ? AND tenant_id = ?", *req.ParentID, tenantID).First(&parent).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "父级分类不存在"})
			return
		}
		level = parent.Level + 1

		// Check max depth
		if level > 4 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "超过最大层级限制（5级）"})
			return
		}
	}

	category.Name = req.Name
	category.Description = req.Description
	category.Color = req.Color
	category.Icon = req.Icon
	category.ParentID = req.ParentID
	category.SortOrder = req.SortOrder
	category.Level = level

	if err := h.db.Save(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新分类失败"})
		return
	}

	c.JSON(http.StatusOK, category)
}

// isDescendant checks if potentialChildID is a descendant of parentID
func (h *CategoryHandler) isDescendant(parentID, potentialChildID uint, tenantID uint) bool {
	var children []models.Category
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

func (h *CategoryHandler) Delete(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	// Check for children
	var childCount int64
	h.db.Model(&models.Category{}).Where("parent_id = ? AND tenant_id = ?", id, tenantID).Count(&childCount)
	if childCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法删除有子级的分类，请先删除或移动子级"})
		return
	}

	// Check for items
	var itemCount int64
	h.db.Model(&models.Item{}).Where("category_id = ?", id).Count(&itemCount)
	if itemCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无法删除有物品的分类，请先移动或删除物品"})
		return
	}

	if err := h.db.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&models.Category{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除分类失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "分类已删除"})
}

// Reorder handles batch reordering of categories
func (h *CategoryHandler) Reorder(c *gin.Context) {
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
		var category models.Category
		if err := tx.Where("id = ? AND tenant_id = ?", item.ID, tenantID).First(&category).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, gin.H{"error": "分类不存在: " + strconv.FormatUint(uint64(item.ID), 10)})
			return
		}

		// Calculate new level if parent changed
		level := 0
		if item.ParentID != nil {
			var parent models.Category
			if err := tx.Where("id = ? AND tenant_id = ?", *item.ParentID, tenantID).First(&parent).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"error": "父级分类不存在"})
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

		// Update category
		updates := map[string]interface{}{
			"parent_id":  item.ParentID,
			"sort_order": item.SortOrder,
			"level":      level,
		}
		if err := tx.Model(&models.Category{}).Where("id = ?", item.ID).Updates(updates).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "更新分类失败"})
			return
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "提交事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "分类排序已更新"})
}
