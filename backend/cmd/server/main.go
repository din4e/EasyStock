package main

import (
	"log"

	"easystock/internal/ai"
	"easystock/internal/config"
	"easystock/internal/database"
	"easystock/internal/handlers"
	"easystock/internal/middleware"
	"easystock/internal/storage"
	"easystock/internal/utils"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	// Load config
	cfg := config.Load()

	// Set JWT secret
	utils.SetJWTSecret(cfg.JWT.Secret)

	// Connect to database
	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize storage
	fileStorage, err := storage.NewLocalStorage(&cfg.Storage)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}

	// Initialize AI provider (optional - may be nil if not configured)
	var aiProvider ai.Provider
	if cfg.AI.APIKey != "" || cfg.AI.Provider == "ollama" {
		aiProvider, err = ai.NewProvider(&cfg.AI)
		if err != nil {
			log.Printf("Warning: Failed to initialize AI provider: %v", err)
		} else {
			log.Printf("AI provider initialized: %s", aiProvider.GetName())
		}
	}

	// Initialize handlers
	authHandler := handlers.NewAuthHandlerWithConfig(db, cfg)
	userHandler := handlers.NewUserHandler(db)
	categoryHandler := handlers.NewCategoryHandler(db)
	locationHandler := handlers.NewLocationHandler(db)
	itemHandler := handlers.NewItemHandler(db)
	transactionHandler := handlers.NewTransactionHandler(db)
	uploadHandler := handlers.NewUploadHandler(fileStorage, &cfg.Storage)
	aiHandler := handlers.NewAIRecognizeHandler(aiProvider, fileStorage, db, &cfg.AI)

	// Setup Gin
	r := gin.Default()

	// CORS - 根据部署模式限制 origins，生产环境不应 AllowAllOrigins
	var corsOrigins []string
	if cfg.Deployment.Mode == "local" {
		// 本地模式：允许本地开发服务器
		corsOrigins = []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		}
	} else {
		// SaaS 模式：只允许特定域名
		corsOrigins = []string{
			"https://easystock.example.com", // 主域名
		}
	}

	r.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Tenant-ID"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":        "ok",
			"version":       "0.1.0",
			"mode":          cfg.Deployment.Mode,
			"ai_configured": aiProvider != nil && aiProvider.IsAvailable(),
		})
	})

	// Static files for uploads
	r.Static("/uploads", cfg.Storage.LocalPath)

	// API v1
	v1 := r.Group("/api/v1")
	{
		// Auth routes (public)
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		// AI status (public - for checking configuration)
		v1.GET("/ai/status", aiHandler.GetAIStatus)
		v1.GET("/ai/providers", aiHandler.GetProviders)

		// Protected routes
		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// User profile
			protected.GET("/profile", authHandler.GetProfile)
			protected.PUT("/profile", authHandler.UpdateProfile)

			// Users management (admin+)
			users := protected.Group("/users")
			users.Use(middleware.RequireAdmin())
			{
				users.GET("", userHandler.List)
				users.GET("/:id", userHandler.Get)
				users.PUT("/:id", userHandler.Update)
				users.DELETE("/:id", userHandler.Delete)
				users.PUT("/:id/password", userHandler.UpdatePassword)
			}

			// Categories
			categories := protected.Group("/categories")
			{
				categories.GET("", categoryHandler.List)
				categories.POST("", categoryHandler.Create)
				categories.POST("/reorder", categoryHandler.Reorder)
				categories.GET("/:id", categoryHandler.Get)
				categories.PUT("/:id", categoryHandler.Update)
				categories.DELETE("/:id", categoryHandler.Delete)
			}

			// Locations
			locations := protected.Group("/locations")
			{
				locations.GET("", locationHandler.List)
				locations.POST("", locationHandler.Create)
				locations.POST("/reorder", locationHandler.Reorder)
				locations.GET("/:id", locationHandler.Get)
				locations.PUT("/:id", locationHandler.Update)
				locations.DELETE("/:id", locationHandler.Delete)
			}

			// Items
			items := protected.Group("/items")
			{
				items.GET("", itemHandler.List)
				items.POST("", itemHandler.Create)
				items.POST("/batch", aiHandler.BatchCreateItems)
				items.GET("/barcode/:barcode", itemHandler.GetByBarcode)
				items.GET("/:id", itemHandler.Get)
				items.PUT("/:id", itemHandler.Update)
				items.DELETE("/:id", itemHandler.Delete)
			}

			// Transactions
			transactions := protected.Group("/transactions")
			{
				transactions.GET("", transactionHandler.List)
				transactions.POST("", transactionHandler.Create)
				transactions.GET("/:id", transactionHandler.Get)
			}

			// Dashboard
			protected.GET("/dashboard/stats", transactionHandler.GetStats)

			// File upload
			upload := protected.Group("/upload")
			{
				upload.POST("", uploadHandler.Upload)
				upload.POST("/multiple", uploadHandler.UploadMultiple)
				upload.GET("/:id", uploadHandler.GetFile)
				upload.DELETE("/:id", uploadHandler.DeleteFile)
			}

			// AI recognition
			aiRoutes := protected.Group("/ai")
			{
				aiRoutes.POST("/recognize", aiHandler.Recognize)
			}
		}
	}

	// Start server
	log.Printf("Server starting on port %s (mode: %s)", cfg.Server.Port, cfg.Deployment.Mode)
	if cfg.SaaS.Enabled {
		log.Printf("SaaS mode enabled with trial period: %d days", cfg.SaaS.TrialDays)
	}
	if cfg.AI.APIKey != "" {
		log.Printf("AI provider: %s, model: %s", cfg.AI.Provider, cfg.AI.Model)
	} else {
		log.Printf("AI recognition disabled - set AI_API_KEY to enable")
	}

	if err := r.Run(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
