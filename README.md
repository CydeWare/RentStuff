# Rentora — peer-to-peer rental marketplace (MVP)

> **Rent what you need. Earn from what you own.**

Rentora lets people in Jakarta and the surrounding Jabodetabek area rent everyday items from each other: cameras, laptops, camping gear, tools, event equipment, sports gear and more. One account can both rent and list items. Prices are in Indonesian Rupiah (IDR).

"Rentora" is a working name. Change it in `client/src/config/brand.ts`.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI primitives (shadcn-style components), React Router 7, TanStack Query, Zustand, React Hook Form + Zod, Lucide icons, react-day-picker, sonner |
| Backend | Node.js, Express 5, TypeScript, REST, JWT in an HTTP-only cookie, bcrypt password hashing, Zod validation, Helmet, express-rate-limit, Multer |
| Database | PostgreSQL + Prisma ORM (migrations + seed) |
| Images | Cloudinary when configured, otherwise local disk (`server/uploads`) |
| Tests | Vitest + Supertest against a real PostgreSQL test database |

## Architecture

```
client/  (Vite dev server :5173, proxies /api and /uploads to the API)
  src/components   reusable UI (ui/ = design-system primitives)
  src/pages        route screens (dashboard/, admin/)
  src/layouts      navbar, footer, dashboard/admin shells
  src/hooks        auth, metadata, favorites, polling counts
  src/services     fetch wrapper + typed endpoint functions
  src/store        Zustand (persisted location preference)
  src/routes       router + auth/admin guards
  src/types, src/utils, src/config

server/  (Express API :4000)
  src/routes       route table with auth / admin / rate-limit middleware
  src/controllers  thin HTTP handlers (parse input -> call service -> respond)
  src/services     business logic (bookings, listings, messaging, reviews, admin...)
  src/validators   Zod schemas for every request body / query
  src/middleware   auth, errors, rate limiting, uploads
  src/utils        pricing, date rules, JWT/cookies, errors
  src/config       env validation, Prisma client, supported locations
  prisma/          schema.prisma, migrations, seed.ts
  tests/           unit + integration tests
```

Business rules live in `server/src/services` and `server/src/utils` (`pricing.ts`, `dates.ts`, `booking.rules.ts`) so they can be unit-tested without HTTP.

## Getting started

Requirements: Node.js 20+ and PostgreSQL 14+ (or Docker).

```bash
# 1. Install dependencies (npm workspaces: server + client)
npm install

# 2. Start PostgreSQL (or point DATABASE_URL at your own server)
docker compose up -d

# 3. Configure the API
cp server/.env.example server/.env
#    then set JWT_SECRET to a long random string:
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Create tables and load demo data
npm run db:migrate      # applies prisma/migrations
npm run db:seed         # WARNING: wipes and re-seeds the database

# 5. Run API + web app
npm run dev
```

Open http://localhost:5173. The API runs on http://localhost:4000.

### Demo accounts (created by the seed script)

| Role | Email | Password |
| --- | --- | --- |
| Renter + owner (has bookings, requests, messages) | `budi@rentora.test` | `Rentora123` |
| Owner with camera listings | `siti@rentora.test` | `Rentora123` |
| Administrator | `admin@rentora.test` | `Rentora123` |

All 11 seeded users share this password. These are fictional development accounts; don't seed them into a public deployment.

### Environment variables (`server/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `TEST_DATABASE_URL` | for tests | Separate database; **wiped by the test suite** |
| `JWT_SECRET` | yes | At least 16 characters, keep secret |
| `JWT_EXPIRES_IN` | no | Session lifetime, default `7d` |
| `PORT` | no | API port, default `4000` |
| `CLIENT_URL` | no | Allowed CORS origin(s), comma separated |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no | If all are set, uploads go to Cloudinary. Otherwise they are saved in `server/uploads/` (development fallback) |

No secrets are used in the frontend. In development the Vite proxy keeps the auth cookie first-party.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch) + client (Vite) |
| `npm run typecheck` | TypeScript checks for both packages |
| `npm test` | Server unit + integration tests (needs `TEST_DATABASE_URL`) |
| `npm run build` | Production builds (`server/dist`, `client/dist`) |
| `npm run db:migrate` / `db:seed` / `db:reset` | Prisma migrations and demo data |

## Features

- **Discovery:** homepage with categories, popular items near the selected location, recently added and top-rated items. The explore page has keyword search (title, description, subcategory, category), location (city or whole province), category, price range, availability date, rental duration, condition and delivery filters. Results can be sorted by relevance, price, rating or newest, with server-side pagination.
- **Item page:** gallery, pricing tiers, refundable deposit, condition, pickup/delivery, owner profile, reviews, availability calendar (booked and blocked dates are disabled), and a live price quote from the server. The request button is enabled only when the dates are valid and free.
- **Listings:** create/edit with multi-image upload (type and size checked, content verified by magic bytes), cover photo ordering, province → city → district location, pickup/delivery, min/max rental days and owner-blocked dates. Owners can pause, reactivate and delete listings (soft delete keeps booking history).
- **Bookings:** Pending → Accepted → Active → Completed, plus Rejected and Cancelled. The price is snapshotted at request time. Accepting a booking declines overlapping pending requests automatically. Phone numbers are shared only after acceptance.
- **Simulated payment:** after acceptance the renter can mark a booking "Paid (simulated)". The UI states clearly that no money moves.
- **Messaging:** one thread per pair of users, linked to the item being discussed, with unread counts and read receipts. Stored in the database; the client polls every 5–20 seconds.
- **Reviews:** renters can review the owner once per completed booking. Owner and listing averages are updated in the same transaction.
- **Notifications:** in-app notifications for booking events, new messages and reviews, with a badge in the navbar, mark as read / read all, and per-user preferences.
- **Dashboard:** overview stats (earnings exclude deposits), my rentals, my listings, incoming requests, favorites, messages and account settings (profile, avatar, password, notifications).
- **Admin:** platform statistics, user search with suspend/reactivate (suspension ends the session immediately), listing removal/restore, all bookings, and the report queue.

## Security and integrity

- Passwords hashed with bcrypt (12 rounds). Login returns the same error for an unknown email and a wrong password, and takes similar time in both cases.
- JWT stored in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production). The user is re-loaded on every request so suspensions and role changes apply immediately.
- Role-based access: every `/api/admin/*` route goes through `requireAdmin`. Private resources are always scoped to the current user, and other users' bookings and conversations return 404.
- Every request body and query is validated with Zod on the server. Prisma parameterizes all queries.
- Rate limits on auth, writes and the API as a whole. Helmet headers, explicit CORS allow-list, 200 KB JSON body limit.
- Uploads: JPEG/PNG/WebP only, 5 MB each, max 8 per request. File content is checked by magic bytes and files get random names. Listing image URLs must come from the upload store (or the seed's image host).
- **Database constraints:** a PostgreSQL exclusion constraint (`btree_gist`) makes overlapping ACCEPTED/ACTIVE bookings for the same listing impossible, even under concurrent requests. Booking decisions also lock the listing row. CHECK constraints cover date ranges, non-negative prices and 1–5 ratings.

## Business rules

| Rule | Where it is enforced |
| --- | --- |
| Owners cannot rent their own items | `booking.service.ts` (+ UI hides the booking form) |
| Valid date ranges: end ≥ start, not in the past (Asia/Jakarta), ≤ 1 year ahead, min/max days | `utils/dates.ts` |
| No overlapping confirmed bookings or owner-blocked dates | `booking.service.ts` + DB exclusion constraint |
| Deposit shown separately from the rental fee | `utils/pricing.ts`, `PriceBreakdownView` |
| Price snapshot never changes after the request | `Booking.*Snapshot` columns |
| Reviews only for your own completed bookings, once | `review.service.ts` + unique `bookingId` |
| Paused, deleted and removed listings, and listings of suspended owners, are hidden from search | `publicListingWhere` |
| Rental days are inclusive (1–3 June = 3 days). Weekly (7d) and monthly (30d) rates apply only when cheaper | `utils/pricing.ts` |

## Tests

```bash
npm test
```

49 tests cover pricing (including the 3-day Rp100.000 example), date validation, the booking state machine, and API integration flows. The flows include register/login/logout, listing CRUD and ownership checks, search/filter/sort, favorites, booking request/accept/start/complete/review, overlap prevention (app level and DB level), blocked dates, price snapshots, private-data isolation, messaging access control, notifications, reports, admin-only endpoints and suspension.

## Not included in this MVP

- **Real payments:** only the clearly labeled simulated state.
- **Maps:** no API key is configured, so locations use a province/city/district selector and text descriptions.
- **Real-time chat:** messages are polled. `message.service.ts#createMessage` is the single place to emit a Socket.IO event later.
- **Email/push notifications:** shown as "Coming soon" in settings.
- **Social login:** not offered. There are no placeholder buttons.
- **Social links:** the footer says the accounts are launching soon instead of linking to non-existent pages.

Demo item photos come from Unsplash. Demo prices are fictional.
