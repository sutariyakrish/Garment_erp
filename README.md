# 🧵 Kurti ERP — Setup Guide

## Quick Start (5 steps)

### 1. Install dependencies
```bash
cd garment-erp
npm install
```

### 2. Configure Supabase
Copy the env template:
```bash
cp .env.example .env
```
Then open `.env` and fill in your values from **Supabase Dashboard → Settings → API**:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 3. Run the database schema
- Open **Supabase Dashboard → SQL Editor**
- Paste the entire contents of `supabase_schema.sql`
- Click **Run**

### 4. Create a user account
- Go to **Supabase Dashboard → Authentication → Users**
- Click **Add User** → **Create new user**
- Enter email + password for each staff member

### 5. Start the app
```bash
npm run dev
```
Open http://localhost:5173

---

## Pages & Features

| Page | Description |
|------|-------------|
| Dashboard | Business overview, stats, recent activity |
| Gray Fabric | Add/edit/delete raw fabric lots with meter tracking |
| Parties | Manage mills, embroidery workers, vendors |
| Mill Dispatch | Send fabric to mills, track quantities |
| Receiving | Record returned fabric with color breakdown |
| Reports | Full lifecycle tracking per fabric lot |

## Business Rules Enforced
- Cannot dispatch more than available meters
- Cannot receive more than was sent
- Color totals must match received quantity
- Lot numbers must be unique
- All negative values blocked at DB level

## Build for Production
```bash
npm run build
# Deploy the 'dist' folder to Vercel, Netlify, or any static host
```
