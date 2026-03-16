package models

import (
	"time"

	"gorm.io/gorm"
)

// ============================================
// 租户相关模型 (SaaS 多租户支持)
// ============================================

// Tenant 租户/组织
type Tenant struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	Name     string `gorm:"size:100;not null" json:"name"`
	Slug     string `gorm:"uniqueIndex;size:50;not null" json:"slug"` // URL友好的唯一标识
	Logo     string `gorm:"size:255" json:"logo"`
	Plan     string `gorm:"size:20;default:'free'" json:"plan"`       // free, pro, enterprise
	Status   string `gorm:"size:20;default:'active'" json:"status"`   // active, suspended, cancelled
	Language string `gorm:"size:10;default:'zh-CN'" json:"language"` // zh-CN, zh-TW, en

	// 配额
	MaxMembers int   `gorm:"default:3" json:"max_members"`
	MaxStorage int64 `gorm:"default:104857600" json:"max_storage"` // bytes, 默认100MB
	UsedStorage int64 `gorm:"default:0" json:"used_storage"`

	// 试用期
	TrialEndsAt *time.Time `json:"trial_ends_at"`

	// 关联
	Users        []User        `gorm:"foreignKey:TenantID" json:"users,omitempty"`
	Subscriptions []Subscription `gorm:"foreignKey:TenantID" json:"subscriptions,omitempty"`
}

// Subscription 订阅记录
type Subscription struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	TenantID   uint      `gorm:"index;not null" json:"tenant_id"`
	Plan       string    `gorm:"size:20;not null" json:"plan"`      // free, pro, enterprise
	Status     string    `gorm:"size:20;not null" json:"status"`    // active, cancelled, expired
	Provider   string    `gorm:"size:20" json:"provider"`           // alipay, wechat
	ExternalID string    `gorm:"size:100" json:"external_id"`       // 支付平台订单号
	Amount     float64   `gorm:"default:0" json:"amount"`           // 金额（分）
	Currency   string    `gorm:"size:10;default:'CNY'" json:"currency"`
	StartedAt  time.Time `json:"started_at"`
	EndsAt     time.Time `json:"ends_at"`
	AutoRenew  bool      `gorm:"default:false" json:"auto_renew"`

	Tenant *Tenant `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
}

// PaymentRecord 支付记录
type PaymentRecord struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`

	TenantID       uint      `gorm:"index;not null" json:"tenant_id"`
	SubscriptionID uint      `gorm:"index" json:"subscription_id"`
	Provider       string    `gorm:"size:20;not null" json:"provider"` // alipay, wechat
	TradeNo        string    `gorm:"uniqueIndex;size:100" json:"trade_no"` // 商户订单号
	ExternalTradeNo string   `gorm:"size:100" json:"external_trade_no"`    // 支付平台交易号
	Amount         float64   `gorm:"not null" json:"amount"`
	Status         string    `gorm:"size:20;default:'pending'" json:"status"` // pending, paid, failed, refunded
	PaidAt         *time.Time `json:"paid_at"`
	RawResponse    string    `gorm:"type:text" json:"-"` // 原始支付回调数据
}

// ============================================
// 用户模型
// ============================================

type User struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 多租户支持
	TenantID uint `gorm:"index;not null" json:"tenant_id"` // 租户ID，本地部署默认为1

	Username string `gorm:"uniqueIndex:idx_username;size:50;not null" json:"username"`
	Email    string `gorm:"uniqueIndex:idx_email;size:100" json:"email"`
	Password string `gorm:"size:255;not null" json:"-"`
	Nickname string `gorm:"size:100" json:"nickname"`
	Avatar   string `gorm:"size:255" json:"avatar"`
	Role     string `gorm:"size:20;default:'member'" json:"role"` // owner, admin, member, readonly
	IsActive bool   `gorm:"default:true" json:"is_active"`

	// 关联
	Tenant      *Tenant           `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Items       []Item            `gorm:"foreignKey:UserID" json:"items,omitempty"`
}

type Category struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 多租户支持
	TenantID uint `gorm:"index;not null" json:"tenant_id"`

	// 层级支持
	ParentID  *uint `gorm:"index" json:"parent_id"`
	SortOrder int   `gorm:"default:0" json:"sort_order"`
	Level     int   `gorm:"default:0" json:"level"`

	Name        string `gorm:"size:100;not null" json:"name"`
	Description string `gorm:"size:255" json:"description"`
	Color       string `gorm:"size:20" json:"color"` // hex color
	Icon        string `gorm:"size:50" json:"icon"`
	UserID      uint   `gorm:"index" json:"user_id"` // 创建者

	// 关联
	Parent   *Category  `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children []Category `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	Items    []Item     `gorm:"foreignKey:CategoryID" json:"items,omitempty"`
}

type Location struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 多租户支持
	TenantID uint `gorm:"index;not null" json:"tenant_id"`

	// 层级支持
	ParentID  *uint `gorm:"index" json:"parent_id"`
	SortOrder int   `gorm:"default:0" json:"sort_order"`
	Level     int   `gorm:"default:0" json:"level"`

	Name        string `gorm:"size:100;not null" json:"name"`
	Description string `gorm:"size:255" json:"description"`
	Icon        string `gorm:"size:50" json:"icon"`
	UserID      uint   `gorm:"index" json:"user_id"` // 创建者

	// 关联
	Parent   *Location  `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children []Location `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	Items    []Item     `gorm:"foreignKey:LocationID" json:"items,omitempty"`
}

type Item struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 多租户支持
	TenantID uint `gorm:"index;not null" json:"tenant_id"`

	Name        string     `gorm:"size:100;not null" json:"name"`
	Barcode     string     `gorm:"size:100;index" json:"barcode"`
	Quantity    int        `gorm:"default:0" json:"quantity"`
	Unit        string     `gorm:"size:20" json:"unit"` // 个, 盒, 箱, kg, g, L, ml
	Price       float64    `gorm:"default:0" json:"price"`
	Cost        float64    `gorm:"default:0" json:"cost"` // 成本价
	ExpiredAt   *time.Time `gorm:"index" json:"expired_at"`
	ImageURL    string     `gorm:"size:255" json:"image_url"`
	Description string     `gorm:"size:500" json:"description"`
	Note        string     `gorm:"size:500" json:"note"`
	AlertDays   int        `gorm:"default:7" json:"alert_days"` // 过期前N天提醒

	UserID      uint  `gorm:"index;not null" json:"user_id"`
	CategoryID  *uint `gorm:"index" json:"category_id"`
	LocationID  *uint `gorm:"index" json:"location_id"`

	Category    *Category         `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Location    *Location         `gorm:"foreignKey:LocationID" json:"location,omitempty"`
	Transactions []StockTransaction `gorm:"foreignKey:ItemID" json:"transactions,omitempty"`
}

type StockTransaction struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 多租户支持
	TenantID uint `gorm:"index;not null" json:"tenant_id"`

	Type      string     `gorm:"size:20;not null" json:"type"` // in, out, adjust, consume
	Quantity  int        `gorm:"not null" json:"quantity"`
	BeforeQty int        `gorm:"not null" json:"before_qty"`
	AfterQty  int        `gorm:"not null" json:"after_qty"`
	Price     float64    `gorm:"default:0" json:"price"`
	Note      string     `gorm:"size:500" json:"note"`

	ItemID uint `gorm:"index;not null" json:"item_id"`
	UserID uint `gorm:"index;not null" json:"user_id"`

	Item *Item `gorm:"foreignKey:ItemID" json:"item,omitempty"`
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// Request/Response DTOs

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Nickname string `json:"nickname"`
	// SaaS 模式下创建新租户
	TenantName string `json:"tenant_name"` // 组织名称
	InviteCode string `json:"invite_code"` // 加入现有组织的邀请码
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token     string `json:"token"`
	User      User   `json:"user"`
	Tenant    *Tenant `json:"tenant,omitempty"`
	IsNewUser bool   `json:"is_new_user,omitempty"`
}

type CategoryRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Color       string `json:"color"`
	Icon        string `json:"icon"`
	ParentID    *uint  `json:"parent_id"`
	SortOrder   int    `json:"sort_order"`
}

type LocationRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	ParentID    *uint  `json:"parent_id"`
	SortOrder   int    `json:"sort_order"`
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

// ReorderRequest 批量重排序请求
type ReorderRequest struct {
	Items []ReorderItem `json:"items" binding:"required"`
}

// ReorderItem 单个重排序项
type ReorderItem struct {
	ID        uint  `json:"id" binding:"required"`
	ParentID  *uint `json:"parent_id"`
	SortOrder int   `json:"sort_order" binding:"required"`
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

// ============================================
// SaaS 相关 DTOs
// ============================================

// TenantCreateRequest 创建租户请求
type TenantCreateRequest struct {
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Slug     string `json:"slug" binding:"required,min=2,max=50,alphanum"`
	Language string `json:"language"`
}

// TenantUpdateRequest 更新租户请求
type TenantUpdateRequest struct {
	Name     string `json:"name" binding:"omitempty,min=2,max=100"`
	Logo     string `json:"logo"`
	Language string `json:"language"`
}

// InviteMemberRequest 邀请成员请求
type InviteMemberRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required,oneof=admin member readonly"`
}

// SubscriptionPlan 订阅计划
type SubscriptionPlan struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`        // 月费（元）
	YearlyPrice float64 `json:"yearly_price"` // 年费（元）
	MaxMembers  int     `json:"max_members"`
	MaxStorage  int64   `json:"max_storage"`  // bytes
	Features    []string `json:"features"`
}

// PaymentRequest 支付请求
type PaymentRequest struct {
	PlanID    string `json:"plan_id" binding:"required"`
	Duration  int    `json:"duration" binding:"required,min=1"` // 月数
	PayMethod string `json:"pay_method" binding:"required,oneof=alipay wechat"`
}

// PaymentResponse 支付响应
type PaymentResponse struct {
	TradeNo   string `json:"trade_no"`
	PayURL    string `json:"pay_url"`    // 支付页面URL
	QRCode    string `json:"qr_code"`    // 二维码内容（可选）
	Amount    float64 `json:"amount"`
	ExpiresAt int64  `json:"expires_at"` // Unix timestamp
}
