<div align="center">
  <h1>🍔 Enterprise Canteen Management System</h1>
  <p>
    <strong>A robust, multi-tenant monorepo solution for modern school and college canteens.</strong>
  </p>
  <p>
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18.x-339933?style=flat-square&logo=node.js">
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript">
    <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14.x-000000?style=flat-square&logo=next.js">
    <img alt="React Native Expo" src="https://img.shields.io/badge/Expo-54.x-000020?style=flat-square&logo=expo">
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql">
    <img alt="Redis" src="https://img.shields.io/badge/Redis-7.0-DC382D?style=flat-square&logo=redis">
    <img alt="Zustand" src="https://img.shields.io/badge/Zustand-5.x-4B32C3?style=flat-square">
    <img alt="Firebase" src="https://img.shields.io/badge/Firebase-Auth-FFCA28?style=flat-square&logo=firebase">
  </p>
</div>

---

## 📖 Overview

The Enterprise Canteen Management System is an end-to-end platform designed to digitize cafeteria operations. It provides a highly scalable architecture supporting multiple institutions (multi-tenancy) via a unified codebase. The platform facilitates digital ordering, point-of-sale (POS) operations, real-time kitchen displays, inventory tracking, secure OTP authentication, and integrated digital wallets.

---

## 🏗 System Architecture

The project is structured as a monolithic repository (monorepo) comprising three interconnected environments:

1. **`backend/`** — A high-performance Node.js REST API powered by Express, Prisma ORM, and WebSocket integration.
2. **`web/`** — A Next.js web application serving as the Administrative Dashboard and Point-of-Sale (POS) terminal.
3. **`mobile/`** — An Expo (React Native) application tailored for end-users (Students, Teachers, and Staff) for on-the-go ordering, featuring a modern bridgeless architecture.

---

## ✨ Core Capabilities

### 📱 Client Mobile Application (`mobile`)
- **Modern Architecture:** Built on React Native 0.81.5 and Expo SDK 54, utilizing the new **Bridgeless** architecture for maximum performance.
- **State Management:** Fully migrated to **Zustand** for lightweight, predictable global state management (replacing Context API), alongside React Query for server state.
- **Secure Authentication:** Integrated with **Firebase Auth** for secure Phone Number (OTP) login and authentication.
- **Frictionless Multi-Tenancy:** Users connect to their specific institution using a simple "School Code".
- **Digital Checkout Flow:** Intuitive menu browsing, cart management, and seamless checkout.
- **Voice Search:** Integrated `expo-speech-recognition` for hands-free menu searching.
- **Offline Resilience:** Local storage queuing via `expo-secure-store` and `AsyncStorage` for network-degraded environments, ensuring session persistence and sync upon reconnection.
- **Live Order Tracking:** Push-like WebSocket updates keeping users informed of their exact order status.
- **Deep Linking:** Configured via Expo Router and `app.config.js` for universal link routing (`canteen://`).

### 🏢 Web Administration & POS (`web`)
- **Real-Time Dashboard:** Comprehensive analytics, live sales monitoring, and active queue metrics.
- **Integrated Point-of-Sale (POS):** Efficient walk-in order processing supporting Cash, UPI, and native Wallet payments, complete with order hold/resume functionality.
- **Kitchen Display System (KDS):** A live, WebSocket-driven Kanban board for kitchen staff to transition order states (Pending → Preparing → Ready → Completed).
- **Menu & Inventory Management:** Streamlined creation of categories and items, dynamic pricing, and automated low-stock threshold alerts.
- **Wallet Infrastructure:** Admin-controlled digital wallet top-ups for faculty and staff accounts.
- **Community Engagement:** Publish, pin, and manage global announcements visible within the mobile client.
- **Data Resilience:** Built-in snapshot functionality allowing administrators to download ZIP backups and restore database states instantly.
- **Custom Invoicing:** Configurable receipt templates including dynamic logos, custom footers, and toggleable metadata.

---

## 🛠 Technology Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Backend Framework** | Node.js, Express, TypeScript |
| **Database & ORM** | PostgreSQL, Prisma ORM |
| **Caching & Sessions** | Redis, Express Session |
| **Real-Time Engine** | Socket.io |
| **Web Frontend** | Next.js 14, React, CSS Modules |
| **Mobile Frontend** | React Native (0.81.5), Expo (SDK 54), Expo Router |
| **Mobile State & Data** | Zustand, React Query, AsyncStorage, SecureStore |
| **Mobile Auth & Native** | Firebase Auth (OTP), Speech Recognition, Expo Linking |

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

For the mobile app, set up the `.env` file in the `mobile/` directory:
```bash
EXPO_PUBLIC_API_URL=http://<your-ip>:4000/api
EXPO_PUBLIC_SOCKET_URL=http://<your-ip>:4000
```

### 5. Database Migrations
Generate the Prisma client and synchronize the database schema:
```bash
npm run prisma:generate -w backend
npm run prisma:db-push -w backend
```

### 6. Execution

**Backend API (Port 4000):**
```bash
npm run dev:backend
```

**Next.js Web Interface (Port 3000):**
```bash
npm run dev:web
```
*The admin portal is now accessible at [http://localhost:3000/admin](http://localhost:3000/admin).*

**React Native Mobile App:**
```bash
cd mobile
npx expo run:android
```
*(Note: Use `npx expo run:android` or `--variant release` for physical devices/emulators to utilize custom native modules like Firebase and Speech Recognition, as Expo Go is not supported).*

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
│   │   └── modules/            # Domain-driven controllers and routes
├── web/
│   ├── pages/
│   │   ├── admin/              # Comprehensive Administrator interface
│   │   ├── kds/                # Live Kitchen Display System
│   │   └── qr/                 # Table-specific QR landing pages
│   └── public/                 # Static web assets
└── mobile/
    ├── app/                    # Expo Router file-based navigation
    ├── src/
    │   ├── components/         # Reusable React Native UI elements
    │   ├── stores/             # Zustand global state stores
    │   ├── services/           # Firebase, Storage, and API utilities
    │   └── hooks/              # Custom React Query and Sync hooks
    ├── app.config.js           # Expo configuration & plugins
    └── package.json            # React Native 0.81.5 & Expo 54.x setup
```
