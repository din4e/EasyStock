# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyStock (易库存) - A simple, modern, self-hosted family/personal asset & inventory management web application. The project aims to solve common pain points in existing solutions like Grocy and Snipe-IT by providing a more modern UI/UX, better mobile experience, and easier deployment.

**支持双部署模式**: 本地化部署 (Self-hosted) 和 SaaS 模式

## Tech Stack

### Backend
- **Language**: Go
- **Framework**: Gin (lightweight, high performance)
- **Database**: Multi-database support
  - SQLite (default for easy deployment)
  - PostgreSQL (production)
  - MySQL (optional)
- **ORM**: GORM (Go ORM library)
- **Auth**: JWT-based authentication with tenant support

### Frontend
- **Framework**: Next.js (React)
- **Styling**: TailwindCSS + Shadcn (modern UI components)
- **Mobile**: PWA support with Service Worker + IndexedDB offline sync
- **Barcode Scanning**: ZXing.js or QuaggaJS

### Deployment
- **Container**: Docker with Docker Compose
- **Reverse Proxy**: Traefik (built-in support)

## Deployment Modes

### Local Mode (本地部署)
- Single tenant (default tenant ID = 1)
- No billing required
- First user becomes admin
- Unlimited storage and members

### SaaS Mode
- Multi-tenant architecture with shared schema
- Tenant isolation via `tenant_id` field
- Subscription plans (free/pro/enterprise)
- Alipay/WeChat Pay integration
- Trial period support

## Key Features

1. **Inventory Management**: Track items (name, quantity, expiration, price, location)
2. **Hierarchical Categories/Locations**: Up to 5 levels of nesting
3. **Barcode Scanning**: Built-in scanner using device camera
4. **PWA/Offline Support**: Work offline, sync when connected
5. **Multi-user**: Family/team sharing with different permission levels (owner/admin/member/readonly)
6. **Dashboard**: Usage trends, expiration alerts, spending statistics
7. **AI OCR**: Receipt scanning for automatic item entry
8. **Database**: Switch between SQLite/PostgreSQL/MySQL via config

## Project Structure

```
backend/
├── cmd/server/main.go      # Entry point
├── internal/
│   ├── config/             # Configuration (including SaaS config)
│   ├── database/           # Database connection & migrations
│   ├── handlers/           # HTTP handlers (all tenant-aware)
│   ├── middleware/         # Auth middleware with tenant support
│   ├── models/             # GORM models (all have tenant_id)
│   ├── storage/            # File storage
│   ├── ai/                 # AI provider integration
│   └── utils/              # Utilities (JWT, password hashing)
frontend/
├── src/
│   ├── app/                # Next.js app router pages
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks (useAuth, etc.)
│   └── lib/                # Utilities and API client
```

## Environment Variables

```bash
# Server
SERVER_PORT=8080

# Database
DB_TYPE=sqlite          # sqlite, postgres, mysql
DB_HOST=localhost
DB_PORT=5432
DB_USER=easystock
DB_PASSWORD=easystock
DB_NAME=easystock

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRE_HOUR=24

# Deployment Mode
DEPLOYMENT_MODE=local   # local or saas

# SaaS (only for saas mode)
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
WECHAT_APP_ID=
WECHAT_MCH_ID=
WECHAT_API_KEY=
SAAS_TRIAL_DAYS=14

# AI (optional)
AI_PROVIDER=openai      # openai, anthropic, qwen, ollama
AI_API_KEY=
AI_MODEL=gpt-4o

# Storage
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./uploads
```

## Development Commands

```bash
# Backend (Go)
cd backend
go mod tidy
go run cmd/server/main.go

# Frontend (Next.js)
cd frontend
npm install
npm run dev

# Docker (full stack)
docker compose up -d
```

## Architecture Guidelines

- **Project Structure**: Clean separation between frontend and backend
- **API**: RESTful API design, JSON responses
- **Multi-tenancy**: All data queries MUST filter by `tenant_id`
- **Auth**: JWT-based authentication with tenant context
- **Mobile-First**: All features designed for mobile-first experience
- **i18n**: Full Chinese (zh-CN, zh-HK, zh-TW) and English support

## Design Priorities

Based on user pain points with existing tools:
1. Modern UI/UX - No legacy Bootstrap look
2. Inline operations - Minimize navigation跳转
3. Easy onboarding - Simple wizard for new users
4. Offline-first for mobile - Scan and add items without internet
5. One-click deployment - Docker Compose with zero config

## Database Models

All models include `tenant_id` for multi-tenancy support:
- `Tenant` - Organization/workspace
- `User` - User account (belongs to tenant)
- `Category` - Item categories (hierarchical)
- `Location` - Storage locations (hierarchical)
- `Item` - Inventory items
- `StockTransaction` - Stock in/out records
- `Subscription` - SaaS subscription (saas mode only)
- `PaymentRecord` - Payment history (saas mode only)
