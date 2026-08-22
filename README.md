# EWU Buddy — Cyber Command Portal Helper (v2.0 Production)

A high-performance Chrome Extension crafted specifically for East West University (EWU) students to automate portal tasks, optimize course advising, and generate exportable timetables with enterprise-grade license security.

---

## 🚀 Key Features

- **Streamlined Settings UI**: Clean, clutter-free first page with Master Power and Toast Notification toggles. Detailed settings for Advising, Courses, Routine, Login, and System are accessible via dedicated top navigation tabs.
- **License Management & Key Switching**: Manage your subscription anytime, view lifetime/expiration status, or switch/change your license key directly from the activation interface.
- **Offline & Online Advising Enhancement**: 10-column advising layout with live search, PDF export, seat availability indicators, and offline course planning conflict solver.
- **Course Catalog Enhancer**: Sticky headers, fast filtering, and instant PDF catalog generation.
- **Visual Routine Generator**: Dynamic schedule timetable with custom themes and high-res image/PDF exports.
- **Auto Captcha Solver**: Automatic portal number captcha calculation and seamless login submission.

---

## 🔒 Security Architecture

- **CSPRNG $2^{80}$ Entropy Key Generation**: 16-character keys generated with uniform bitmask distribution (`& 31`) across 32 Crockford-style characters. Keys are stored as SHA-256 hashes in Cloudflare D1.
- **Session-Only Admin Hub**: Admin authentication is scoped strictly to `sessionStorage`. Closing the browser or tab immediately terminates the session and requires re-authentication.
- **Perpetual Expiry Accuracy**: Lifetime licenses are strictly stored with `NULL` expiration timestamps, cleanly rendering `Never (Perpetual)` in the admin hub and `Lifetime Access` in the client.
- **HMAC-SHA256 Signed Tokens**: Extension client receives signed JWT session tokens verified against Cloudflare Worker with device ID checks.
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
├── background.js          # Background Service Worker
├── content.js             # Core portal module injector
├── pageHook.js            # In-page script interceptor
├── styles.css             # Extension styling & themes
├── icons/                 # Extension icons
├── lib/                   # Vendor libraries (pdf.js, html2canvas, jspdf)
├── src/                   # Un-obfuscated clean source backup
├── backend/               # Cloudflare Serverless Worker & D1 Database
│   ├── worker.js          # API Worker & Admin Hub
│   ├── schema.sql         # D1 database schema
│   └── wrangler.toml      # Wrangler configuration
└── SETUP.md               # Backend deployment & setup guide
```

---

## 🛠️ Installation & Setup

For full backend deployment and database migration instructions, refer to [`SETUP.md`](./SETUP.md).

To load the extension in Developer Mode:
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select this directory (`/publish`).
