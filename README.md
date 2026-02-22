# 🔐 Digital Vault — Next.js + Supabase

Production-grade rebuild of the Digital Vault app. Handles **2,500–3,000 concurrent users** on Vercel's serverless infrastructure with Supabase PostgreSQL as the database.

## Tech Stack

| Layer        | Technology                          | Why                                              |
|-------------|-------------------------------------|--------------------------------------------------|
| Frontend    | Next.js 14 (App Router)             | Serverless on Vercel, no cold-start bottleneck   |
| Database    | Supabase (PostgreSQL)               | ACID transactions, connection pooling, Realtime  |
| Auth        | JWT (jose) + HttpOnly cookies       | Stateless — scales to any number of instances    |
| Realtime    | Supabase Realtime (WebSockets)      | Live token status without polling                |
| Passwords   | bcrypt                              | Replaces plain-text PINs from the Excel version |
| Deployment  | Vercel                              | Auto-scaling, global CDN, zero-config deploy     |

---

## Setup in 5 Steps

### 1. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL**, **anon key**, and **service_role key** (Settings → API)

### 2. Run the database schema
In your Supabase project → SQL Editor → New Query, paste and run the contents of **`supabase_schema.sql`**.

This creates:
- `users` table (uid, username, bcrypt pin_hash, balance, blocked)
- `stalls` table (stall_id, name, bcrypt pin_hash)
- `menu_items` table
- `tokens` table with JSONB items column
- `admins` table
- `place_order()` PostgreSQL function — atomic balance deduction + token creation in one transaction
- Indexes on all hot-path columns

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:
```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=<run: openssl rand -base64 32>
SEED_SECRET=anyrandomstring
```

### 4. Seed the database
Run dev server first, then:
```bash
curl -X POST "http://localhost:3000/api/seed?secret=anyrandomstring"
```

This creates:
- **S101** — Tasty Bites (PIN: 2134)
- **S102** — Spice Junction (PIN: 1234)
- **S103** — Sweet Treats (PIN: 4321)
- **Admin** account (username: Admin, password: Hello)

To add more stalls, edit `/app/api/seed/route.ts`.

### 5. Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
```

Add the same environment variables in Vercel dashboard → Project → Settings → Environment Variables.

---

## Running Locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## Architecture: Why This Handles 3,000 Users

### Excel vs PostgreSQL
| Concern                 | Excel (old)              | PostgreSQL (new)                              |
|------------------------|--------------------------|-----------------------------------------------|
| Concurrent writes      | File-level fcntl lock    | Row-level locks via `SELECT FOR UPDATE`       |
| Race condition: payment | Lock whole file          | `place_order()` function — atomic transaction |
| Read speed             | Parse full file every time | Indexed query, milliseconds                 |
| Concurrent readers     | All blocked during write | Unlimited parallel reads                      |
| Crash recovery         | File corruption risk     | WAL, point-in-time recovery                   |

### `place_order()` — The Key Function
This PostgreSQL stored procedure runs the entire payment in **one database round-trip**:
1. `SELECT balance FOR UPDATE` — row-level lock on this user only (other users unaffected)
2. Check balance ≥ total
3. `UPDATE users SET balance = balance - total`
4. `SELECT MAX(token_no) + 1` for this stall
5. `INSERT INTO tokens`
6. Return token_no and new_balance

Even if 3,000 users all click "Pay" simultaneously, each waits only for its own row lock — they don't block each other.

### Realtime Instead of Polling
The old Streamlit app used `time.sleep(10) + st.rerun()` — every user was making a full HTTP request every 10 seconds. With 200 users that's 20 requests/second just for polling.

The new app uses **Supabase Realtime WebSockets**: the server pushes status changes to subscribed clients. 3,000 users = 3,000 persistent WebSocket connections (handled by Supabase's infrastructure), not 3,000 × 6 = 18,000 HTTP requests/minute.

### Vercel Serverless Scaling
Each API route is a serverless function. Vercel auto-scales — if 3,000 users hit `/api/tokens` simultaneously, Vercel spins up 3,000 function instances in parallel. No single server to bottleneck.

---

## File Structure

```
digital-vault/
├── app/
│   ├── page.tsx              ← Login (User / Stall Owner / Admin tabs)
│   ├── user/page.tsx         ← User dashboard (browse, cart, pay, my tokens)
│   ├── stall/page.tsx        ← Stall owner (live orders, mark served, menu)
│   ├── admin/page.tsx        ← Admin (dashboard, users, transactions, top-up)
│   ├── api/
│   │   ├── auth/login/       ← POST: user login
│   │   ├── auth/register/    ← POST: user registration
│   │   ├── auth/stall-login/ ← POST: stall owner login
│   │   ├── auth/admin-login/ ← POST: admin login
│   │   ├── auth/logout/      ← POST: clear session cookie
│   │   ├── auth/whoami/      ← GET: read current session
│   │   ├── stalls/           ← GET: all stalls + menus
│   │   ├── tokens/           ← GET: user tokens | POST: place order
│   │   ├── tokens/stall/     ← GET: stall tokens | PATCH: mark served
│   │   ├── users/balance/    ← GET: live balance
│   │   ├── admin/            ← GET: dashboard/users/txns | POST: actions
│   │   └── seed/             ← POST: seed initial data (protected)
│   ├── globals.css           ← Full dark design system
│   └── layout.tsx
├── lib/
│   ├── supabase.ts           ← Supabase client (browser + server)
│   └── auth.ts               ← JWT session helpers
├── types/index.ts            ← TypeScript interfaces
├── supabase_schema.sql       ← Full DB schema + place_order() function
├── .env.local.example        ← Environment variable template
├── vercel.json               ← Vercel config (Mumbai region)
└── package.json
```

---

## Default Credentials (after seeding)

| Role        | ID/Username   | Name/Password | PIN  |
|------------|---------------|---------------|------|
| Stall Owner | S101          | Tasty Bites   | 2134 |
| Stall Owner | S102          | Spice Junction | 1234 |
| Stall Owner | S103          | Sweet Treats  | 4321 |
| Admin       | Admin         | —             | Hello |

User accounts are created via the registration form.
