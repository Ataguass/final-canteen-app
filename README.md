# Canteen App Monorepo Scaffold

This repository is a starter implementation based on the canteen blueprint.

## Apps

- `backend` - Express + TypeScript + Prisma + Redis + Socket.io
- `mobile` - Expo Router scaffold for auth/admin/student flows
- `web` - Next.js scaffold for admin, KDS, and QR landing

## Implemented Backend Modules

- Health: `GET /api/health`
- Auth:
  - `POST /api/auth/request-otp`
  - `POST /api/auth/verify-otp`
  - `POST /api/auth/register/student`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh-token`
- Tenants:
  - `GET /api/tenants/resolve?code=ABC123` (public school-code/slug resolver)
  - `GET /api/tenants` (requires `x-platform-key`)
  - `POST /api/tenants` (bootstrap tenant + first admin, requires `x-platform-key`)
- Menu:
  - `GET /api/menu/categories`
  - `POST /api/menu/categories` (admin)
  - `GET /api/menu/items`
  - `POST /api/menu/items` (admin)
  - `PATCH /api/menu/items/:id` (admin)
  - `PATCH /api/menu/items/:id/toggle` (admin)
  - `DELETE /api/menu/items/:id` (admin)
- Orders:
  - `POST /api/orders`
  - `POST /api/orders/sync`
  - `GET /api/orders`
  - `GET /api/orders/:id`
  - `PATCH /api/orders/:id/status` (admin)
- Users (admin):
  - `GET /api/users` (lists teacher/staff users for tenant)
  - `POST /api/users` (create teacher/staff)
  - `PATCH /api/users/:id/approval` (approve/revoke)
  - `PATCH /api/users/:id/active` (activate/deactivate)

## Phase 1 Included in Mobile

- Auth guard with role-aware redirects in Expo Router.
- Student register flow with OTP request + verification.
- School code based login/register (students do not need raw tenant IDs).
- Login flow that stores persisted session for app runtime.
- Admin menu management screen with category/item create, item toggle, and delete.

## Phase 2 Included in Mobile

- Student browse -> item detail -> add to cart -> checkout -> order detail flow.
- In-memory cart context with quantity/note editing.
- Checkout with payment-method selection and server-side order creation.
- My Orders list and order detail screens.
- Real-time order updates via Socket.io (`order:new`, `order:status_changed`).

## Next Milestone Added

- Offline fallback queue in mobile checkout using local storage.
- `Sync Queued Orders` action in student orders screen.
- Auto background sync when network reconnects after login.
- Online/Offline status badge on student dashboard and orders screens.
- Session persistence across restarts (secure storage for user/token).
- Cart persistence with per-user rehydration on app startup.
- Batch sync endpoint in backend (`POST /api/orders/sync`).
- Admin POS-lite screen (menu selection + order creation).
- Admin order operations screen with status transition actions.

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start infra:

```bash
docker compose up -d postgres redis
```

3. Prepare backend env:

```bash
copy backend/.env.example backend/.env
```

4. Generate Prisma client and migrate:

```bash
npm run prisma:generate -w backend
npm run prisma:migrate -w backend
```

5. Start backend:

```bash
npm run dev:backend
```

6. Start frontend apps (optional):

```bash
npm run dev:web
npm run dev:mobile
```

## Next Milestones

1. Persist mobile auth with secure storage + refresh-token rotation.
2. Add tenant branding/theme delivery and slug-based tenant discovery screen.
3. Add users/approval module for teacher and staff onboarding.
4. Add community, banners, stock logs, notifications, and reports modules.
5. Add WatermelonDB sync pipeline, FCM, printer integrations, and observability.
