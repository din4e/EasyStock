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

type TransactionHandler struct {
	db *gorm.DB
}

func NewTransactionHandler(db *gorm.DB) *TransactionHandler {
	return &TransactionHandler{db: db}
}

func (h *TransactionHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var req models.StockTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get item
	var item models.Item
	if err := h.db.First(&item, req.ItemID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Item not found"})
		return
	}

	// Verify ownership
	if item.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	beforeQty := item.Quantity
	var afterQty int

	switch req.Type {
	case "in":
		afterQty = beforeQty + req.Quantity
	case "out", "consume":
		afterQty = beforeQty - req.Quantity
		if afterQty < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Insufficient stock"})
			return
		}
	case "adjust":
		afterQty = req.Quantity
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid transaction type"})
		return
	}

	// Create transaction
	transaction := models.StockTransaction{
		Type:      req.Type,
		Quantity:  req.Quantity,
		BeforeQty: beforeQty,
		AfterQty:  afterQty,
		Price:     req.Price,
		Note:      req.Note,
		ItemID:    req.ItemID,
		UserID:    userID,
	}

	if err := h.db.Create(&transaction).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transaction"})
		return
	}

	// Update item quantity
	item.Quantity = afterQty
	if req.Type == "in" && req.Price > 0 {
		item.Price = req.Price
	}
	if err := h.db.Save(&item).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update item"})
		return
	}

	// Load relations
	h.db.Preload("Item").Preload("User").First(&transaction, transaction.ID)

	c.JSON(http.StatusCreated, transaction)
}

func (h *TransactionHandler) List(c *gin.Context) {
	userID := middleware.GetUserID(c)

	itemID := c.Query("item_id")
	limit := c.DefaultQuery("limit", "50")
	offset := c.DefaultQuery("offset", "0")

	query := h.db.Where("user_id = ?", userID).Preload("Item").Preload("User").Order("created_at DESC")

	if itemID != "" {
		id, _ := strconv.ParseUint(itemID, 10, 32)
		query = query.Where("item_id = ?", id)
	}

	limitInt, _ := strconv.Atoi(limit)
	offsetInt, _ := strconv.Atoi(offset)

	var transactions []models.StockTransaction
	if err := query.Limit(limitInt).Offset(offsetInt).Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch transactions"})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

func (h *TransactionHandler) Get(c *gin.Context) {
	userID := middleware.GetUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var transaction models.StockTransaction
	if err := h.db.Preload("Item").Preload("User").Where("id = ? AND user_id = ?", id, userID).First(&transaction).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Transaction not found"})
		return
	}

	c.JSON(http.StatusOK, transaction)
}

// Dashboard stats
func (h *TransactionHandler) GetStats(c *gin.Context) {
	userID := middleware.GetUserID(c)

	var stats models.DashboardStats

	// Total items
	h.db.Model(&models.Item{}).Where("user_id = ?", userID).Count(&stats.TotalItems)

	// Total value (sum of price * quantity)
	h.db.Model(&models.Item{}).Where("user_id = ? AND quantity > 0", userID).
		Select("COALESCE(SUM(price * quantity), 0)").Scan(&stats.TotalValue)

	// Expiring soon (within 7 days)
	alertDate := time.Now().AddDate(0, 0, 7)
	h.db.Model(&models.Item{}).Where("user_id = ? AND expired_at IS NOT NULL AND expired_at <= ? AND quantity > 0", userID, alertDate).
		Count(&stats.ExpiringSoon)

	// Out of stock
	h.db.Model(&models.Item{}).Where("user_id = ? AND quantity = 0", userID).Count(&stats.OutOfStock)

	// Low stock (quantity <= alert_days as threshold)
	h.db.Model(&models.Item{}).Where("user_id = ? AND quantity > 0 AND quantity <= alert_days", userID).Count(&stats.LowStock)

	// Recent transactions (last 7 days)
	weekAgo := time.Now().AddDate(0, 0, -7)
	var recentInCount, recentOutCount int64
	h.db.Model(&models.StockTransaction{}).Where("user_id = ? AND type = 'in' AND created_at >= ?", userID, weekAgo).Count(&recentInCount)
	h.db.Model(&models.StockTransaction{}).Where("user_id = ? AND type = 'out' AND created_at >= ?", userID, weekAgo).Count(&recentOutCount)
	stats.RecentIn = int(recentInCount)
	stats.RecentOut = int(recentOutCount)

	// Category stats
	var categoryStats []models.CategoryStat
	h.db.Model(&models.Item{}).
		Select("category_id, COUNT(*) as item_count, COALESCE(SUM(price * quantity), 0) as total_value").
		Where("user_id = ?", userID).
		Group("category_id").
		Scan(&categoryStats)

	for i := range categoryStats {
		var cat models.Category
		if err := h.db.First(&cat, categoryStats[i].CategoryID).Error; err == nil {
			categoryStats[i].CategoryName = cat.Name
		}
	}
	stats.CategoryStats = categoryStats

	// Location stats
	var locationStats []models.LocationStat
	h.db.Model(&models.Item{}).
		Select("location_id, COUNT(*) as item_count, COALESCE(SUM(price * quantity), 0) as total_value").
		Where("user_id = ?", userID).
		Group("location_id").
		Scan(&locationStats)

	for i := range locationStats {
		var loc models.Location
		if err := h.db.First(&loc, locationStats[i].LocationID).Error; err == nil {
			locationStats[i].LocationName = loc.Name
		}
	}
	stats.LocationStats = locationStats

	c.JSON(http.StatusOK, stats)
}
