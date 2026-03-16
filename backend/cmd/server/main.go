package main

import (
	"log"

	"easystock/internal/config"
	"easystock/internal/database"
	"easystock/internal/handlers"
	"easystock/internal/middleware"
	"easystock/internal/utils"

	"github.com/gin-gonic/gin"
)

func main() {
	// Load config
	cfg := config.Load()

	// Set JWT secret
	utils.SetJWTSecret(cfg.JWT.Secret)

	// Connect to database
	db, err := database.Connect(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(db, &cfg.JWT)
	categoryHandler := handlers.NewCategoryHandler(db)
	locationHandler := handlers.NewLocationHandler(db)
	itemHandler := handlers.NewItemHandler(db)
	transactionHandler := handlers.NewTransactionHandler(db)

	// Setup Gin
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// API v1
	v1 := r.Group("/api/v1")
	{
		// Auth routes (public)
		auth := v1.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		// Protected routes
		protected := v1.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// User profile
			protected.GET("/profile", authHandler.GetProfile)
			protected.PUT("/profile", authHandler.UpdateProfile)

			// Categories
			categories := protected.Group("/categories")
			{
				categories.GET("", categoryHandler.List)
				categories.POST("", categoryHandler.Create)
				categories.GET("/:id", categoryHandler.Get)
				categories.PUT("/:id", categoryHandler.Update)
				categories.DELETE("/:id", categoryHandler.Delete)
			}

			// Locations
			locations := protected.Group("/locations")
			{
				locations.GET("", locationHandler.List)
				locations.POST("", locationHandler.Create)
				locations.GET("/:id", locationHandler.Get)
				locations.PUT("/:id", locationHandler.Update)
				locations.DELETE("/:id", locationHandler.Delete)
			}

			// Items
			items := protected.Group("/items")
			{
				items.GET("", itemHandler.List)
				items.POST("", itemHandler.Create)
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
		}
	}

	// Start server
	log.Printf("Server starting on port %s", cfg.Server.Port)
	if err := r.Run(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
