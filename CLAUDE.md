# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyStock (易库存) - A simple, modern, self-hosted family/personal asset & inventory management web application. The project aims to solve common pain points in existing solutions like Grocy and Snipe-IT by providing a more modern UI/UX, better mobile experience, and easier deployment.

## Tech Stack

### Backend
- **Language**: Go
- **Framework**: Gin or Fiber (lightweight, high performance)
- **Database**: Multi-database support
  - SQLite (default for easy deployment)
  - PostgreSQL (production)
  - MySQL (optional)
- **ORM**: GORM (Go ORM library)

### Frontend
- **Framework**: Next.js (React) or SvelteKit
- **Styling**: TailwindCSS + Shadcn (modern UI components)
- **Mobile**: PWA support with Service Worker + IndexedDB offline sync
- **Barcode Scanning**: ZXing.js or QuaggaJS

### Deployment
- **Container**: Docker with Docker Compose
- **Reverse Proxy**: Traefik (built-in support)

## Key Features to Implement

1. **Inventory Management**: Track items (name, quantity, expiration, price, location)
2. **Barcode Scanning**: Built-in scanner using device camera
3. **PWA/Offline Support**: Work offline, sync when connected
4. **Multi-user**: Family sharing with different permission levels
5. **Dashboard**: Usage trends, expiration alerts, spending statistics
6. **AI OCR**: Receipt scanning for automatic item entry
7. **Database**: Switch between SQLite/PostgreSQL/MySQL via config

## Development Commands

```bash
# Backend (Go)
cd backend
go mod tidy
go run main.go

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
- **Auth**: JWT-based authentication with refresh tokens
- **Mobile-First**: All features designed for mobile-first experience
- **i18n**: Full Chinese (zh-CN, zh-HK, zh-TW) and English support

## Design Priorities

Based on user pain points with existing tools:
1. Modern UI/UX - No legacy Bootstrap look
2. Inline operations - Minimize navigation跳转
3. Easy onboarding - Simple wizard for new users
4. Offline-first for mobile - Scan and add items without internet
5. One-click deployment - Docker Compose with zero config
