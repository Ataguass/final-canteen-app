<div align="center">
  <h1>🍔 Enterprise Canteen Management System</h1>
  <p>
    <strong>A robust, multi-tenant monorepo solution for modern school and college canteens.</strong>
  </p>
  <p>
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18.x-339933?style=flat-square&logo=node.js">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript">
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14.x-000000?style=flat-square&logo=next.js">
    <img alt="React Native Expo" src="https://img.shields.io/badge/Expo-51.x-000020?style=flat-square&logo=expo">
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql">
    <img alt="Redis" src="https://img.shields.io/badge/Redis-7.0-DC382D?style=flat-square&logo=redis">
  </p>
</div>

---

## 📖 Overview

The Enterprise Canteen Management System is an end-to-end platform designed to digitize cafeteria operations. It provides a highly scalable architecture supporting multiple institutions (multi-tenancy) via a unified codebase. The platform facilitates digital ordering, point-of-sale (POS) operations, real-time kitchen displays, inventory tracking, and integrated digital wallets.

---

## 🏗 System Architecture

The project is structured as a monolithic repository (monorepo) comprising three interconnected environments:

1. **`backend/`** — A high-performance Node.js REST API powered by Express, Prisma ORM, and WebSocket integration.
2. **`web/`** — A Next.js web application serving as the Administrative Dashboard and Point-of-Sale (POS) terminal.
3. **`mobile/`** — An Expo (React Native) application tailored for end-users (Students, Teachers, and Staff) for on-the-go ordering.

---

## ✨ Core Capabilities

### 🏢 Web Administration & POS (`web`)
- **Real-Time Dashboard:** Comprehensive analytics, live sales monitoring, and active queue metrics.
- **Integrated Point-of-Sale (POS):** Efficient walk-in order processing supporting Cash, UPI, and native Wallet payments, complete with order hold/resume functionality.
- **Kitchen Display System (KDS):** A live, WebSocket-driven Kanban board for kitchen staff to transition order states (Pending → Preparing → Ready → Completed).
- **Menu & Inventory Management:** Streamlined creation of categories and items, dynamic pricing, and automated low-stock threshold alerts.
- **Wallet Infrastructure:** Admin-controlled digital wallet top-ups for faculty and staff accounts.
- **Community Engagement:** Publish, pin, and manage global announcements visible within the mobile client.
- **Data Resilience:** Built-in snapshot functionality allowing administrators to download ZIP backups and restore database states instantly.
- **Custom Invoicing:** Configurable receipt templates including dynamic logos, custom footers, and toggleable metadata.

### 📱 Client Mobile Application (`mobile`)
- **Frictionless Multi-Tenancy:** Users connect to their specific institution using a simple "School Code" rather than complex URLs.
- **Digital Checkout Flow:** Intuitive menu browsing, cart management, and seamless checkout.
- **Offline Resilience:** Local storage queuing for network-degraded environments, ensuring orders are securely held and synced upon reconnection.
- **Live Order Tracking:** Push-like WebSocket updates keeping users informed of their exact order status.

---

## 🛠 Technology Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Backend Framework** | Node.js, Express, TypeScript |
| **Database & ORM** | PostgreSQL, Prisma ORM |
| **Caching & Sessions** | Redis, Express Session |
| **Real-Time Engine** | Socket.io |
| **Web Frontend** | Next.js 14, React, CSS Modules |
| **Mobile Frontend** | React Native, Expo, Expo Router |

---

## 🚀 Getting Started

### 1. System Requirements
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Docker & Docker Compose](https://www.docker.com/) (For localized database orchestration)

### 2. Initialization
Clone the repository and install all workspace dependencies:
```bash
npm install
```

### 3. Infrastructure Provisioning
Spin up the isolated PostgreSQL and Redis containers:
```bash
docker compose up -d postgres redis
```

### 4. Environment Configuration
Duplicate the backend environment template:
```bash
copy backend/.env.example backend/.env
```
*(Ensure `DATABASE_URL` and `REDIS_URL` map correctly to your local Docker containers).*

### 5. Database Migrations
Generate the Prisma client and synchronize the database schema:
```bash
npm run prisma:generate -w backend
npm run prisma:db-push -w backend
```

### 6. Execution

Spin up the backend API layer (defaults to Port 4000):
```bash
npm run dev:backend
```

In a separate terminal, start the Next.js web interface (defaults to Port 3000):
```bash
npm run dev:web
```

The admin portal is now accessible at [http://localhost:3000/admin](http://localhost:3000/admin).

---

## 🔐 Development Credentials

A default institution tenant (`KARIMCG`) is pre-configured for immediate testing. Use the credentials below to authenticate:

- **School Code**: `KARIMCG`
- **Administrator**: `8134011875` / `Admin@123`
- **Faculty / Teacher**: `9678039381` / `Niloy@123`

---

## 📂 Directory Structure

```text
├── backend/
│   ├── prisma/                 # Database schema and migrations
│   ├── src/
│   │   ├── config/             # Environment, DB, and Redis configurations
│   │   ├── middleware/         # Auth, tenant resolution, and error handling
│   │   └── modules/            # Domain-driven controllers and routes (Auth, Menu, Orders)
├── web/
│   ├── pages/
│   │   ├── admin/              # Comprehensive Administrator interface
│   │   ├── kds/                # Live Kitchen Display System
│   │   └── qr/                 # Table-specific QR landing pages
│   └── public/                 # Static web assets
└── mobile/
    ├── app/                    # Expo Router file-based navigation
    ├── components/             # Reusable React Native UI elements
    └── lib/                    # Mobile-specific utilities and API clients
```
