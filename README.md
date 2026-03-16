# EasyStock (易库存)

[English](#english) | [中文](#中文)

---

## 中文

简单、现代、自托管的家庭/个人资产 & 库存管理 Web 应用。

### 特性

- 📦 **库存管理** - 追踪物品名称、数量、过期日期、价格、存放位置
- 🏷️ **层级分类** - 分类和位置支持最多 5 级嵌套
- 📱 **条码扫描** - 使用设备摄像头扫描条码
- 📴 **离线支持** - PWA 支持，离线操作，联网同步
- 👨‍👩‍👧‍👦 **多用户协作** - 家庭成员共享，支持不同权限级别
- 📊 **数据看板** - 使用趋势、过期提醒、消费统计
- 🤖 **AI 识别** - 小票/图片扫描自动录入物品
- 🗄️ **多数据库** - 支持 SQLite/PostgreSQL/MySQL

### 部署模式

#### 本地部署模式 (默认)
- 单租户架构，适合家庭/个人使用
- 支持多用户（家庭成员共享）
- 第一个注册用户自动成为管理员
- 无存储和成员数量限制
- 无需计费系统

#### SaaS 模式
- 多租户架构，每个组织独立数据隔离
- 订阅制计费（免费版/专业版/企业版）
- 支付宝/微信支付集成
- 按套餐限制存储空间和成员数
- 支持试用期

### 快速开始

```bash
# 使用 Docker Compose 一键部署
docker compose up -d

# 或手动运行
# 后端
cd backend
go mod tidy
go run cmd/server/main.go

# 前端
cd frontend
npm install
npm run dev
```

### 环境配置

```bash
# 部署模式 (local 或 saas)
DEPLOYMENT_MODE=local

# 数据库类型 (sqlite/postgres/mysql)
DB_TYPE=sqlite

# JWT 密钥
JWT_SECRET=your-secret-key
```

### 用户角色

| 角色 | 权限 |
|------|------|
| owner | 组织所有者，拥有全部权限 |
| admin | 管理员，可管理用户和设置 |
| member | 成员，可正常使用所有功能 |
| readonly | 只读用户，仅可查看数据 |

### 技术栈

- **后端**: Go + Gin + GORM
- **前端**: Next.js + TailwindCSS + Shadcn
- **数据库**: SQLite / PostgreSQL / MySQL
- **认证**: JWT

---

## English

A simple, modern, self-hosted family/personal asset & inventory management web application.

### Features

- 📦 **Inventory Management** - Track items with name, quantity, expiration, price, location
- 🏷️ **Hierarchical Organization** - Categories and locations with up to 5 levels of nesting
- 📱 **Barcode Scanning** - Built-in scanner using device camera
- 📴 **Offline Support** - PWA with offline capability and sync when connected
- 👨‍👩‍👧‍👦 **Multi-user Collaboration** - Family sharing with different permission levels
- 📊 **Dashboard** - Usage trends, expiration alerts, spending statistics
- 🤖 **AI Recognition** - Receipt/image scanning for automatic item entry
- 🗄️ **Multi-database** - Support for SQLite/PostgreSQL/MySQL

### Deployment Modes

#### Local Mode (Default)
- Single tenant architecture for family/personal use
- Multi-user support (family members sharing)
- First registered user becomes admin automatically
- No storage or member limits
- No billing system required

#### SaaS Mode
- Multi-tenant architecture with data isolation per organization
- Subscription billing (free/pro/enterprise)
- Alipay/WeChat Pay integration
- Storage and member limits by plan
- Trial period support

### Quick Start

```bash
# One-click deployment with Docker Compose
docker compose up -d

# Or run manually
# Backend
cd backend
go mod tidy
go run cmd/server/main.go

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Configuration

```bash
# Deployment mode (local or saas)
DEPLOYMENT_MODE=local

# Database type (sqlite/postgres/mysql)
DB_TYPE=sqlite

# JWT secret
JWT_SECRET=your-secret-key
```

### User Roles

| Role | Permissions |
|------|-------------|
| owner | Organization owner with full permissions |
| admin | Administrator, can manage users and settings |
| member | Regular member with full functionality |
| readonly | Read-only access |

### Tech Stack

- **Backend**: Go + Gin + GORM
- **Frontend**: Next.js + TailwindCSS + Shadcn
- **Database**: SQLite / PostgreSQL / MySQL
- **Auth**: JWT

---

## License

MIT License
