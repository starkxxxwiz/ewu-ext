# EWU Portal Helper — Secured Production Setup & Deployment Guide (`SETUP.md`)

This directory (`/publish`) contains the complete, self-contained production package for **EWU Portal Helper v2.0**, including the Chrome Extension, first-install activation page, background service worker, Cloudflare Worker backend API, and D1 Database setup scripts.

---

## 1. Directory Structure

```
publish/
├── activation.html        <-- First-install activation & onboarding interface
├── activation.js          <-- Client activation handler & key formatter
├── background.js          <-- Service Worker handling install events & token checks
├── content.js             <-- Portal enhancement & feature content script
├── popup.html             <-- Extension popup settings UI with license badge
├── popup.js               <-- Popup script with license status binding
├── pageHook.js            <-- Page context API interceptor
├── styles.css             <-- Production extension stylesheet
├── manifest.json          <-- Manifest V3 configuration
├── icons/                 <-- Extension icons
├── lib/                   <-- Vendor libraries (pdf.js, html2canvas, jspdf)
│
├── backend/               <-- CLOUDFLARE SERVERLESS BACKEND
│   ├── schema.sql         <-- Cloudflare D1 SQL schema
│   ├── worker.js          <-- API worker & embedded admin dashboard (/admin)
│   └── wrangler.toml      <-- Wrangler worker configuration
│
├── build.js               <-- Build & obfuscation script for publish package
├── package.json           <-- Build dependencies
└── SETUP.md               <-- Complete setup and deployment documentation
```

---

# 2. Cloudflare Worker & D1 Setup

### Step A: Prerequisites & Wrangler Installation
Open terminal inside the `publish` directory:
```bash
cmd /c npm install -g wrangler
cmd /c wrangler login
```

### Step B: Create Cloudflare D1 Database & KV Namespace
Create the D1 database:
```bash
cmd /c wrangler d1 create ewu_helper_licenses
```
Copy the generated `database_id` into `backend/wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "ewu_helper_licenses"
database_id = "<YOUR_CLOUDFLARE_D1_DATABASE_ID>"
```

Create the Cloudflare KV Namespace for administrative password storage:
```bash
cmd /c wrangler kv namespace create ADMIN_KV
```
Update your `backend/wrangler.toml` with the generated namespace ID:
```toml
[[kv_namespaces]]
binding = "ADMIN_KV"
id = "<YOUR_CLOUDFLARE_KV_NAMESPACE_ID>"
```

### Step C: Execute Database Schema Migration
Run this command from the `/publish` root directory to initialize the remote database schema:
```bash
cmd /c wrangler d1 execute ewu_helper_licenses --config=backend/wrangler.toml --remote --file=backend/schema.sql
```

### Step D: Configure Environment Secrets, KV Password & Deploy Worker
1. Set the server-side JWT token generation secret:
```bash
cmd /c wrangler secret put JWT_SECRET --config=backend/wrangler.toml
```
2. Store your Admin password as Base64 inside the Cloudflare KV Storage:
   - Convert your desired admin password to Base64 (e.g., `my_secret_pass` -> `bXlfc2VjcmV0X3Bhc3M=`).
   - Write the Base64 value to the KV namespace:
```bash
cmd /c wrangler kv key put --config=backend/wrangler.toml --binding=ADMIN_KV "admin_password_b64" "bXlfc2VjcmV0X3Bhc3M="
```
*(Note: As a fallback, you can also set `wrangler secret put ADMIN_SECRET --config=backend/wrangler.toml` to configure a direct clear-text password).*

3. Deploy Worker API to Cloudflare:
```bash
cd backend
cmd /c wrangler deploy
```

---

## 3. Generating License Keys

1. Navigate to your deployed Cloudflare Worker URL in any browser:
   `https://<your-worker-subdomain>.workers.dev/admin`
2. Enter the `ADMIN_SECRET` password set during deployment.
3. In the **Generate New License Key** section:
   - Enter a client note or identifier (e.g. `Student John Doe`).
   - Set max device limit (default: 1).
   - Select expiration (30 days, 90 days, 1 year, or Never).
   - Click **Generate Key**.
4. Copy the key (`XXXX-XXXX-XXXX-XXXX`).

---

## 4. Production Build & Obfuscation Pipeline

Before releasing the `/publish` extension to users, run the build script to minify and obfuscate JavaScript files:

```bash
# Install obfuscation dependencies inside publish/
cmd /c npm install

# Run the build script
cmd /c npm run build
```

This obfuscates:
- `content.js`
- `popup.js`
- `background.js`
- `activation.js`

---

## 5. Chrome Extension Installation & Testing

1. Open Google Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the `publish` folder (`c:\xampp\htdocs\Extension\ewu-buddy\V4\publish`).

### Verification Testing Matrix:
- **Fresh Install Test**: Reload extension; `activation.html` opens automatically in a new tab.
- **Valid Key Test**: Enter a valid key (`XXXX-XXXX-XXXX-XXXX`); extension becomes activated and portal features unlock.
- **Revocation Test**: Go to `/admin`, click **Revoke** on an active key; next time the user loads portal, features disable and unactivated banner appears.
- **Brute-Force Test**: Submit 6 invalid keys rapidly; endpoint returns HTTP 429 Rate Limit error.
