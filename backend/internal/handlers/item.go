package handlers

import (
	"net/http"
	"strconv"
	"time"

	"easystock/internal/middleware"
	"easystock/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ItemHandler struct {
	db *gorm.DB
}

func NewItemHandler(db *gorm.DB) *ItemHandler {
	return &ItemHandler{db: db}
}

func (h *ItemHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)

	var req models.ItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item := models.Item{
		Name:        req.Name,
		Barcode:     req.Barcode,
		Quantity:    req.Quantity,
		Unit:        req.Unit,
		Price:       req.Price,
		Cost:        req.Cost,
		ExpiredAt:   req.ExpiredAt,
		ImageURL:    req.ImageURL,
		Description: req.Description,
		Note:        req.Note,
		AlertDays:   req.AlertDays,
		CategoryID:  req.CategoryID,
		LocationID:  req.LocationID,
		UserID:      userID,
		TenantID:    tenantID,
	}

	if err := h.db.Create(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建物品失败"})
		return
	}

	// Load relations
	h.db.Preload("Category").Preload("Location").First(&item, item.ID)

	c.JSON(http.StatusCreated, item)
}

func (h *ItemHandler) List(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	// Query params
	categoryID := c.Query("category_id")
	locationID := c.Query("location_id")
	search := c.Query("search")
	lowStock := c.Query("low_stock")
	expiring := c.Query("expiring")

	query := h.db.Where("tenant_id = ?", tenantID).Preload("Category").Preload("Location")

	if categoryID != "" {
		catID, _ := strconv.ParseUint(categoryID, 10, 32)
		query = query.Where("category_id = ?", catID)
	}

	if locationID != "" {
		locID, _ := strconv.ParseUint(locationID, 10, 32)
		query = query.Where("location_id = ?", locID)
	}

	if search != "" {
		query = query.Where("name LIKE ? OR barcode LIKE ?", "%"+search+"%", "%"+search+"%")
	}

	if lowStock == "true" {
		query = query.Where("quantity <= alert_days")
	}

	if expiring == "true" {
		alertDate := time.Now().AddDate(0, 0, 7)
		query = query.Where("expired_at IS NOT NULL AND expired_at <= ?", alertDate)
		query = query.Where("quantity > 0")
	}

	var items []models.Item
	if err := query.Order("updated_at DESC").Find(&items).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取物品列表失败"})
		return
	}

	c.JSON(http.StatusOK, items)
}

func (h *ItemHandler) Get(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var item models.Item
	if err := h.db.Preload("Category").Preload("Location").Preload("Transactions").Where("id = ? AND tenant_id = ?", id, tenantID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "物品不存在"})
		return
	}

	c.JSON(http.StatusOK, item)
}

func (h *ItemHandler) Update(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req models.ItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var item models.Item
	if err := h.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "物品不存在"})
		return
	}

	item.Name = req.Name
	item.Barcode = req.Barcode
	item.Quantity = req.Quantity
	item.Unit = req.Unit
	item.Price = req.Price
	item.Cost = req.Cost
	item.ExpiredAt = req.ExpiredAt
	item.ImageURL = req.ImageURL
	item.Description = req.Description
	item.Note = req.Note
	item.AlertDays = req.AlertDays
	item.CategoryID = req.CategoryID
	item.LocationID = req.LocationID

	if err := h.db.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新物品失败"})
		return
	}

	h.db.Preload("Category").Preload("Location").First(&item, item.ID)

	c.JSON(http.StatusOK, item)
}

func (h *ItemHandler) Delete(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	if err := h.db.Where("id = ? AND tenant_id = ?", id, tenantID).Delete(&models.Item{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除物品失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "物品已删除"})
}

func (h *ItemHandler) GetByBarcode(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	barcode := c.Param("barcode")

	var item models.Item
	if err := h.db.Preload("Category").Preload("Location").Where("barcode = ? AND tenant_id = ?", barcode, tenantID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "物品不存在"})
		return
	}

	c.JSON(http.StatusOK, item)
}
