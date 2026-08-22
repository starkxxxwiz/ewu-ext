# EWU Buddy — Cyber Command Portal Helper (v2.0 Production)

A high-performance Chrome Extension crafted specifically for East West University (EWU) students to automate portal tasks, optimize course advising, and generate exportable timetables with enterprise-grade license security and remote governance controls.

---

## 🚀 Key Features

### 1. Streamlined Cyber Command Settings
- **Minimalist Master First Page**: Clean initial view featuring global Master Extension Power toggle and Status Toast Notification controls.
- **Segmented Sub-Module Navigation**: Deep configuration tabs for **Advising**, **Courses**, **Routine**, **Login**, and **System** data management.
- **Fast Search & Filter**: Real-time filtering across all settings cards.

### 2. License Management & Key Switching
- **Dedicated Activation Portal (`activation.html`)**: Sleek dark matrix interface with Plus Jakarta Sans and JetBrains Mono typography.
- **Active Subscription Dashboard**: Visual active badge, license key prefix display, and lifetime/expiration validity tracker.
- **Quick-Action Buttons**:
  - **Visit Student Portal**: One-click jump directly to `portal.ewubd.edu`.
  - **Change License Key**: Switch or upgrade license keys without reinstalling the extension.
  - **Direct Support Link**: Fast access to Telegram developer support.

### 3. Remote Governance & Admin Control Hub (`/admin`)
- **Emergency Remote Killswitch**: Global lockdown switch to temporarily disable the extension with custom notice titles and messages (e.g. during university maintenance).
- **Global Broadcast Announcements**: Deliver informational, warning, or critical broadcast banners across all student portal sessions.
- **Mandatory Update Enforcement**: Restrict outdated client versions and automatically trigger the standalone **Update Landing Page (`update.html`)** with changelog notes and direct download links.
- **Connected Device Telemetry Export**: Download full device activation logs in both **CSV** and **JSON** formats.
- **Danger Zone Database Purge**: Double-confirmation safeguard requiring explicit `"DELETE ALL"` verification to purge keys and device records.

### 4. Portal Enhancement Suite
- **Visual Routine Generator**: Dynamic timetable matrix with custom blue-intensity themes and high-res image/PDF export.
- **Course Catalog Enhancer**: Sticky headers, seat occupancy heatmaps, and course code search filtering.
- **Advising Assistant (Online & Offline)**: 10-column advising layout with credit limits, conflict checking, and offline course planning.
- **Auto Captcha Solver**: Automatic portal captcha calculation and seamless login submission.

---

## 🔒 Security Architecture

- **CSPRNG $2^{80}$ Entropy Key Generation**: 16-character keys generated with uniform bitmask distribution (`& 31`) across 32 Crockford-style characters. Keys are stored as SHA-256 hashes in Cloudflare D1.
- **Session-Only Admin Hub**: Admin authentication is scoped strictly to `sessionStorage`. Closing the browser or tab immediately terminates the session and requires re-authentication.
- **Perpetual Expiry Accuracy**: Lifetime licenses are stored with `NULL` expiration timestamps, cleanly rendering `Never (Perpetual)` in the admin hub and `Lifetime Access` in the client.
- **HMAC-SHA256 Signed Tokens**: Extension client receives signed session tokens verified against Cloudflare Workers with device ID checks.
- **Rate-Limiting Protection**: Automatic 15-minute IP lockout after 5 consecutive invalid key submission attempts.

---

## 📦 Project Structure

```
publish/
├── manifest.json          # Chrome Extension Manifest V3
├── popup.html             # Cybertech Dark settings popup
├── popup.js               # Settings logic & tab navigation
├── activation.html        # License activation & management UI
├── activation.js          # License verification & key switcher
├── update.html            # Mandatory update splash landing page
├── update.js              # Update page controller
├── background.js          # Background Service Worker & remote sync
├── content.js             # Core portal module injector & banners
├── pageHook.js            # In-page script interceptor
├── styles.css             # Extension styling & themes
├── icons/                 # Extension icons
├── lib/                   # Vendor libraries (pdf.js, html2canvas, jspdf)
├── src/                   # Source files backup
├── backend/               # Cloudflare Serverless Worker & D1 Database
│   ├── worker.js          # API Worker & Admin Hub
│   ├── schema.sql         # D1 database schema
│   └── wrangler.toml      # Wrangler configuration
└── SETUP.md               # Backend deployment & setup guide
```

---

## 🛠️ Installation & Setup

### Loading the Extension in Google Chrome:
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `/publish` directory.

### Backend Deployment (Cloudflare Worker & D1):
For backend setup, D1 migrations, and Wrangler deployment instructions, see [`SETUP.md`](./SETUP.md).

---

## 📄 License & Ownership
Copyright © 2026 EWU Portal Helper. All rights reserved.
