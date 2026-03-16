package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	Username string    `gorm:"uniqueIndex;size:50;not null" json:"username"`
	Email    string    `gorm:"uniqueIndex;size:100" json:"email"`
	Password string    `gorm:"size:255;not null" json:"-"`
	Nickname string    `gorm:"size:100" json:"nickname"`
	Avatar   string    `gorm:"size:255" json:"avatar"`
	Role     string    `gorm:"size:20;default:'member'" json:"role"` // admin, member, readonly
	Items    []Item    `gorm:"foreignKey:UserID" json:"items,omitempty"`
}

type Category struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	Name        string    `gorm:"size:100;not null" json:"name"`
	Description string    `gorm:"size:255" json:"description"`
	Color       string    `gorm:"size:20" json:"color"` // hex color
	Icon        string    `gorm:"size:50" json:"icon"`
	UserID      uint      `gorm:"index" json:"user_id"`
	Items       []Item    `gorm:"foreignKey:CategoryID" json:"items,omitempty"`
}

type Location struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	Name        string    `gorm:"size:100;not null" json:"name"`
	Description string    `gorm:"size:255" json:"description"`
	Icon        string    `gorm:"size:50" json:"icon"`
	UserID      uint      `gorm:"index" json:"user_id"`
	Items       []Item    `gorm:"foreignKey:LocationID" json:"items,omitempty"`
}

type Item struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	Name        string    `gorm:"size:100;not null" json:"name"`
	Barcode     string    `gorm:"size:100;index" json:"barcode"`
	Quantity    int       `gorm:"default:0" json:"quantity"`
	Unit        string    `gorm:"size:20" json:"unit"` // 个, 盒, 箱, kg, g, L, ml
	Price       float64   `gorm:"default:0" json:"price"`
	Cost        float64   `gorm:"default:0" json:"cost"` // 成本价
	ExpiredAt   *time.Time `gorm:"index" json:"expired_at"`
	ImageURL    string    `gorm:"size:255" json:"image_url"`
	Description string    `gorm:"size:500" json:"description"`
	Note        string    `gorm:"size:500" json:"note"`
	AlertDays   int       `gorm:"default:7" json:"alert_days"` // 过期前N天提醒

	UserID      uint      `gorm:"index;not null" json:"user_id"`
	CategoryID  *uint     `gorm:"index" json:"category_id"`
	LocationID  *uint     `gorm:"index" json:"location_id"`

	Category  *Category          `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Location  *Location          `gorm:"foreignKey:LocationID" json:"location,omitempty"`
	Transactions []StockTransaction `gorm:"foreignKey:ItemID" json:"transactions,omitempty"`
}

type StockTransaction struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	Type        string    `gorm:"size:20;not null" json:"type"` // in, out, adjust, consume
	Quantity    int       `gorm:"not null" json:"quantity"`
	BeforeQty   int       `gorm:"not null" json:"before_qty"`
	AfterQty    int       `gorm:"not null" json:"after_qty"`
	Price       float64   `gorm:"default:0" json:"price"`
	Note        string    `gorm:"size:500" json:"note"`

	ItemID      uint      `gorm:"index;not null" json:"item_id"`
	UserID      uint      `gorm:"index;not null" json:"user_id"`

	Item        *Item     `gorm:"foreignKey:ItemID" json:"item,omitempty"`
	User        *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// Request/Response DTOs

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Nickname string `json:"nickname"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CategoryRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Icon        string `json:"icon"`
}

type LocationRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
}

type ItemRequest struct {
	Name        string     `json:"name" binding:"required"`
	Barcode     string     `json:"barcode"`
	Quantity    int        `json:"quantity"`
	Unit        string     `json:"unit"`
	Price       float64    `json:"price"`
	Cost        float64    `json:"cost"`
	ExpiredAt   *time.Time `json:"expired_at"`
	ImageURL    string     `json:"image_url"`
	Description string     `json:"description"`
	Note        string     `json:"note"`
	AlertDays   int        `json:"alert_days"`
	CategoryID  *uint      `json:"category_id"`
	LocationID  *uint      `json:"location_id"`
}

type StockTransactionRequest struct {
	Type      string  `json:"type" binding:"required"` // in, out, adjust, consume
	Quantity  int     `json:"quantity" binding:"required"`
	Price     float64 `json:"price"`
	Note      string  `json:"note"`
	ItemID    uint    `json:"item_id" binding:"required"`
}

type DashboardStats struct {
	TotalItems      int64   `json:"total_items"`
	TotalValue      float64 `json:"total_value"`
	ExpiringSoon    int64   `json:"expiring_soon"`
	OutOfStock      int64   `json:"out_of_stock"`
	LowStock        int64   `json:"low_stock"`
	RecentIn        int     `json:"recent_in"`
	RecentOut       int     `json:"recent_out"`
	CategoryStats   []CategoryStat `json:"category_stats"`
	LocationStats   []LocationStat `json:"location_stats"`
}

type CategoryStat struct {
	CategoryID   uint    `json:"category_id"`
	CategoryName string  `json:"category_name"`
	ItemCount    int64   `json:"item_count"`
	TotalValue   float64 `json:"total_value"`
}

type LocationStat struct {
	LocationID   uint    `json:"location_id"`
	LocationName string  `json:"location_name"`
	ItemCount    int64   `json:"item_count"`
	TotalValue   float64 `json:"total_value"`
}
