# Rally — Event-Centered Microblogging

Rally is a microblogging platform built around **public events**. Alongside the usual
short posts, follows, and a reverse-chronological feed, users create events (sports, anime,
music, gaming, food, study, …), share them as posts, and **join events with a participate
button**. A **calendar** shows what's happening by date and which events you're attending,
**fixed categories** (instead of hashtags) make discovery easy, and **search**, **trending**,
and **in-app notifications** round out the experience. It's for people who want to share
activities, meet others around shared interests, and actually show up.

> Web Information Engineering — final project. Built with the recommended stack:
> React (Vite) · Node.js + Express · SQLite (better-sqlite3) · bcrypt.

## Features

**Core:** accounts (register / login / logout), public profiles, posts (≤280 chars, with
delete), follow / unfollow with counts, and an authenticated reverse-chronological feed.

**Extended:** events + participation + calendar, fixed categories, reposts, likes, replies
(threads), search (posts / users / events), single-image media attachments, in-app
notifications, trending (last 24h), bookmarks, and **approval-gated private accounts**
(following a private account requires the owner's approval before private posts are visible).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite (client-side only), react-router-dom, axios, dayjs |
| Backend | Node.js (≥22) + Express 5 (REST API) |
| Database | SQLite via better-sqlite3 (schema in `backend/db/schema.sql`) |
| Auth | bcrypt password hashing + httpOnly session cookie |
| Validation | zod on every POST/PUT |

## Prerequisites
- **Node.js ≥ 22** (a `.nvmrc` pins 22.21.0 — run `nvm use` if you use nvm)
- npm
- macOS/Linux/WSL with a C toolchain (for the native `better-sqlite3` / `bcrypt` builds;
  prebuilt binaries are used when available)

## Run locally (from a fresh clone)

Open **two terminals**.

**1) Backend**
```bash
cd backend
cp .env.example .env                 # then edit values (set a real SESSION_SECRET)
npm install
# Phase 0+: create the database from the schema
# sqlite3 db/app.db < db/schema.sql
npm run dev                          # http://localhost:4000
# verify:
curl http://localhost:4000/api/health
```

**2) Frontend**
```bash
cd frontend
cp .env.example .env                 # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev                          # http://localhost:5173
```

Open **http://localhost:5173**.

## Project structure
```
/
├── backend/    # Express REST API (server.js, routes/, middleware/, db/schema.sql)
├── frontend/   # React + Vite client (src/components/, src/pages/, App.jsx)
├── design-document.md
└── README.md
```
See `backend/README.md` for full API documentation and `frontend/README.md` for the component map.

## Live deployment
- **Live URL:** _TBD_ — add here once deployed.
- Backend → **Render**, frontend → **Vercel**. Config is committed (`render.yaml`,
  `frontend/vercel.json`); see **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the step-by-step guide.

## Team
4-member group project. Internal task ownership is tracked separately (shared within the
team) using neutral labels. Every member can explain any part of the system.
