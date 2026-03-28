package database

import (
	"fmt"
	"log"
	"os"

	"easystock/internal/config"
	"easystock/internal/models"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	var db *gorm.DB
	var err error

	dbCfg := &cfg.Database

	switch dbCfg.Type {
	case "postgres":
		dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
			dbCfg.Host, dbCfg.Port, dbCfg.User, dbCfg.Password, dbCfg.DBName)
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
	case "mysql":
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?charset=utf8mb4&parseTime=True&loc=Local",
			dbCfg.User, dbCfg.Password, dbCfg.Host, dbCfg.Port, dbCfg.DBName)
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
	case "sqlite":
		dbPath := os.Getenv("DB_PATH")
		if dbPath == "" {
			dbPath = "easystock.db"
		}
		db, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
	default:
		return nil, fmt.Errorf("unsupported database type: %s", dbCfg.Type)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Auto migrate - 按依赖顺序迁移
	err = db.AutoMigrate(
		&models.Tenant{},        // 先迁移租户表
		&models.Subscription{},  // 订阅表
		&models.PaymentRecord{}, // 支付记录表
		&models.User{},          // 用户依赖租户
		&models.Category{},
		&models.Location{},
		&models.Item{},
		&models.StockTransaction{},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to auto migrate: %w", err)
	}

	// 本地部署模式：确保存在默认租户
	if cfg.Deployment.Mode == "local" {
		if err := ensureDefaultTenant(db); err != nil {
			return nil, fmt.Errorf("failed to ensure default tenant: %w", err)
		}
	}

	log.Printf("Database connected successfully (mode: %s)", cfg.Deployment.Mode)
	return db, nil
}

// ensureDefaultTenant 确保本地模式存在默认租户
func ensureDefaultTenant(db *gorm.DB) error {
	var count int64
	db.Model(&models.Tenant{}).Count(&count)

	if count == 0 {
		defaultTenant := models.Tenant{
			Name:       "Default",
			Slug:       "default",
			Plan:       "enterprise", // 本地部署无限制
			Status:     "active",
			MaxMembers: 999999,
			MaxStorage: 999999999999,
			Language:   "zh-CN",
		}
		if err := db.Create(&defaultTenant).Error; err != nil {
			return err
		}
		log.Println("Created default tenant for local deployment")
	}
	return nil
}
