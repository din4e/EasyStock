package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"easystock/internal/middleware"
	"easystock/internal/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TransactionHandler struct {
	db *gorm.DB
}

func NewTransactionHandler(db *gorm.DB) *TransactionHandler {
	return &TransactionHandler{db: db}
}

func (h *TransactionHandler) Create(c *gin.Context) {
	userID := middleware.GetUserID(c)
	tenantID := middleware.GetTenantID(c)

	var req models.StockTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 在事务中执行库存操作，防止并发竞态
	var transaction models.StockTransaction
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// 使用 FOR LOCK 行锁防止并发修改同一物品
		var item models.Item
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND tenant_id = ?", req.ItemID, tenantID).First(&item).Error; err != nil {
			return fmt.Errorf("物品不存在")
		}

		beforeQty := item.Quantity
		var afterQty int

		switch req.Type {
		case "in":
			afterQty = beforeQty + req.Quantity
		case "out", "consume":
			afterQty = beforeQty - req.Quantity
			if afterQty < 0 {
				return fmt.Errorf("库存不足")
			}
		case "adjust":
			afterQty = req.Quantity
		default:
			return fmt.Errorf("无效的交易类型")
		}

		// 创建交易记录
		transaction = models.StockTransaction{
			Type:      req.Type,
			Quantity:  req.Quantity,
			BeforeQty: beforeQty,
			AfterQty:  afterQty,
			Price:     req.Price,
			Note:      req.Note,
			ItemID:    req.ItemID,
			UserID:    userID,
			TenantID:  tenantID,
		}

		if err := tx.Create(&transaction).Error; err != nil {
			return fmt.Errorf("创建交易记录失败")
		}

		// 更新物品数量
		updates := map[string]interface{}{"quantity": afterQty}
		if req.Type == "in" && req.Price > 0 {
			updates["price"] = req.Price
		}
		if err := tx.Model(&item).Updates(updates).Error; err != nil {
			return fmt.Errorf("更新物品库存失败")
		}

		return nil
	})

	if err != nil {
		switch err.Error() {
		case "物品不存在":
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		case "库存不足", "无效的交易类型":
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// 加载关联数据
	h.db.Preload("Item").Preload("User").First(&transaction, transaction.ID)

	c.JSON(http.StatusCreated, transaction)
}

func (h *TransactionHandler) List(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	itemID := c.Query("item_id")
	limit := c.DefaultQuery("limit", "50")
	offset := c.DefaultQuery("offset", "0")

	query := h.db.Where("tenant_id = ?", tenantID).Preload("Item").Preload("User").Order("created_at DESC")

	if itemID != "" {
		id, _ := strconv.ParseUint(itemID, 10, 32)
		query = query.Where("item_id = ?", id)
	}

	limitInt, _ := strconv.Atoi(limit)
	offsetInt, _ := strconv.Atoi(offset)

	var transactions []models.StockTransaction
	if err := query.Limit(limitInt).Offset(offsetInt).Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "获取交易记录失败"})
		return
	}

	c.JSON(http.StatusOK, transactions)
}

func (h *TransactionHandler) Get(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var transaction models.StockTransaction
	if err := h.db.Preload("Item").Preload("User").Where("id = ? AND tenant_id = ?", id, tenantID).First(&transaction).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "交易记录不存在"})
		return
	}

	c.JSON(http.StatusOK, transaction)
}

// Dashboard stats
func (h *TransactionHandler) GetStats(c *gin.Context) {
	tenantID := middleware.GetTenantID(c)

	var stats models.DashboardStats

	// Total items
	h.db.Model(&models.Item{}).Where("tenant_id = ?", tenantID).Count(&stats.TotalItems)

	// Total value (sum of price * quantity)
	h.db.Model(&models.Item{}).Where("tenant_id = ? AND quantity > 0", tenantID).
		Select("COALESCE(SUM(price * quantity), 0)").Scan(&stats.TotalValue)

	// Expiring soon (within 7 days)
	alertDate := time.Now().AddDate(0, 0, 7)
	h.db.Model(&models.Item{}).Where("tenant_id = ? AND expired_at IS NOT NULL AND expired_at <= ? AND quantity > 0", tenantID, alertDate).
		Count(&stats.ExpiringSoon)

	// Out of stock
	h.db.Model(&models.Item{}).Where("tenant_id = ? AND quantity = 0", tenantID).Count(&stats.OutOfStock)

	// Low stock (quantity <= alert_days as threshold)
	h.db.Model(&models.Item{}).Where("tenant_id = ? AND quantity > 0 AND quantity <= alert_days", tenantID).Count(&stats.LowStock)

	// Recent transactions (last 7 days)
	weekAgo := time.Now().AddDate(0, 0, -7)
	var recentInCount, recentOutCount int64
	h.db.Model(&models.StockTransaction{}).Where("tenant_id = ? AND type = 'in' AND created_at >= ?", tenantID, weekAgo).Count(&recentInCount)
	h.db.Model(&models.StockTransaction{}).Where("tenant_id = ? AND type = 'out' AND created_at >= ?", tenantID, weekAgo).Count(&recentOutCount)
	stats.RecentIn = int(recentInCount)
	stats.RecentOut = int(recentOutCount)

	// Category stats
	var categoryStats []models.CategoryStat
	h.db.Model(&models.Item{}).
		Select("category_id, COUNT(*) as item_count, COALESCE(SUM(price * quantity), 0) as total_value").
		Where("tenant_id = ?", tenantID).
		Group("category_id").
		Scan(&categoryStats)

	for i := range categoryStats {
		var cat models.Category
		if err := h.db.Where("tenant_id = ?", tenantID).First(&cat, categoryStats[i].CategoryID).Error; err == nil {
			categoryStats[i].CategoryName = cat.Name
		}
	}
	stats.CategoryStats = categoryStats

	// Location stats
	var locationStats []models.LocationStat
	h.db.Model(&models.Item{}).
		Select("location_id, COUNT(*) as item_count, COALESCE(SUM(price * quantity), 0) as total_value").
		Where("tenant_id = ?", tenantID).
		Group("location_id").
		Scan(&locationStats)

	for i := range locationStats {
		var loc models.Location
		if err := h.db.Where("tenant_id = ?", tenantID).First(&loc, locationStats[i].LocationID).Error; err == nil {
			locationStats[i].LocationName = loc.Name
		}
	}
	stats.LocationStats = locationStats

	// Daily trends (last 30 days) - optimized single query with GROUP BY
	dailyTrends := make([]models.DailyTrend, 0)
	thirtyDaysAgo := time.Now().AddDate(0, 0, -29)
	startOfPeriod := time.Date(thirtyDaysAgo.Year(), thirtyDaysAgo.Month(), thirtyDaysAgo.Day(), 0, 0, 0, 0, thirtyDaysAgo.Location())

	// Create a map to store all daily data
	dailyMap := make(map[string]*models.DailyTrend)

	// Initialize all 30 days with zero values
	for i := 29; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i)
		dateStr := date.Format("2006-01-02")
		dailyMap[dateStr] = &models.DailyTrend{
			Date:     dateStr,
			InCount:  0,
			OutCount: 0,
			InValue:  0,
			OutValue: 0,
		}
	}

	// Query all in transactions in single query
	type DailyAgg struct {
		Date     string
		TotalQty int
		TotalVal float64
	}
	var inAggs []DailyAgg
	h.db.Model(&models.StockTransaction{}).
		Select("DATE(created_at) as date, COALESCE(SUM(quantity), 0) as total_qty, COALESCE(SUM(price * quantity), 0) as total_val").
		Where("tenant_id = ? AND type = 'in' AND created_at >= ?", tenantID, startOfPeriod).
		Group("DATE(created_at)").
		Scan(&inAggs)

	for _, agg := range inAggs {
		if day, ok := dailyMap[agg.Date]; ok {
			day.InCount = agg.TotalQty
			day.InValue = agg.TotalVal
		}
	}

	// Query all out transactions in single query
	var outAggs []DailyAgg
	h.db.Model(&models.StockTransaction{}).
		Select("DATE(created_at) as date, COALESCE(SUM(quantity), 0) as total_qty, COALESCE(SUM(price * quantity), 0) as total_val").
		Where("tenant_id = ? AND type = 'out' AND created_at >= ?", tenantID, startOfPeriod).
		Group("DATE(created_at)").
		Scan(&outAggs)

	for _, agg := range outAggs {
		if day, ok := dailyMap[agg.Date]; ok {
			day.OutCount = agg.TotalQty
			day.OutValue = agg.TotalVal
		}
	}

	// Convert map to sorted slice
	for _, day := range dailyMap {
		dailyTrends = append(dailyTrends, *day)
	}
	stats.DailyTrends = dailyTrends

	c.JSON(http.StatusOK, stats)
}
