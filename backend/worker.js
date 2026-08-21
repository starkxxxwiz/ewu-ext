/* =============================================================
   EWU Portal Helper - License Control Cloudflare Worker Backend
   ============================================================= */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // -------------------------------------------------------------
      // ROUTER
      // -------------------------------------------------------------
      if (path === '/api/license/activate' && request.method === 'POST') {
        return await handleActivate(request, env, corsHeaders);
      }
      if (path === '/api/license/verify' && request.method === 'POST') {
        return await handleVerify(request, env, corsHeaders);
      }
      if (path === '/api/license/refresh' && request.method === 'POST') {
        return await handleRefresh(request, env, corsHeaders);
      }
      if (path === '/admin') {
        return handleAdminUI();
      }
      if (path.startsWith('/admin/api/')) {
        return await handleAdminAPI(path, request, env, corsHeaders);
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: corsHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

/* -------------------------------------------------------------
   CRYPTOGRAPHY & TOKEN HELPERS
   ------------------------------------------------------------- */

async function hashKey(key) {
  const cleanKey = key.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const msgBuffer = new TextEncoder().encode(cleanKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateRandomKey() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like 0, O, 1, I
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return `${result.substring(0, 4)}-${result.substring(4, 8)}-${result.substring(8, 12)}-${result.substring(12, 16)}`;
}

async function signHMAC(dataStr, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(dataStr));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyHMAC(dataStr, signature, secret) {
  const expectedSig = await signHMAC(dataStr, secret);
  return expectedSig === signature;
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function createToken(payload, secret) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const data = `${header}.${body}`;
  const sig = await signHMAC(data, secret);
  return `${data}.${sig}`;
}

async function parseAndVerifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const valid = await verifyHMAC(`${header}.${body}`, sig, secret);
  if (!valid) return null;
  try {
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

/* -------------------------------------------------------------
   RATE LIMITING / ANTI BRUTE FORCE
   ------------------------------------------------------------- */

async function checkRateLimit(ip, env) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT * FROM rate_limits WHERE ip_address = ?').bind(ip).first();
  if (row) {
    if (row.blocked_until > now) {
      return false; // Still blocked
    }
    // Reset if last attempt was over 15 minutes ago
    if (now - row.last_attempt_at > 15 * 60 * 1000) {
      await env.DB.prepare('UPDATE rate_limits SET attempt_count = 1, last_attempt_at = ?, blocked_until = 0 WHERE ip_address = ?')
        .bind(now, ip).run();
      return true;
    }
  }
  return true;
}

async function recordFailedAttempt(ip, env) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT * FROM rate_limits WHERE ip_address = ?').bind(ip).first();
  if (row) {
    const newCount = row.attempt_count + 1;
    let blockedUntil = 0;
    if (newCount >= 5) {
      blockedUntil = now + 15 * 60 * 1000; // Block for 15 minutes
    }
    await env.DB.prepare('UPDATE rate_limits SET attempt_count = ?, last_attempt_at = ?, blocked_until = ? WHERE ip_address = ?')
      .bind(newCount, now, blockedUntil, ip).run();
  } else {
    await env.DB.prepare('INSERT INTO rate_limits (ip_address, attempt_count, last_attempt_at, blocked_until) VALUES (?, 1, ?, 0)')
      .bind(ip, now).run();
  }
}

async function clearRateLimit(ip, env) {
  await env.DB.prepare('DELETE FROM rate_limits WHERE ip_address = ?').bind(ip).run();
}

/* -------------------------------------------------------------
   PUBLIC API HANDLERS
   ------------------------------------------------------------- */

async function handleActivate(request, env, corsHeaders) {
  const clientIP = request.headers.get('CF-Connecting-IP') || '127.0.0.1';
  
  if (!(await checkRateLimit(clientIP, env))) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Too many invalid attempts. Please try again in 15 minutes.'
    }), { status: 429, headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return new Response(JSON.stringify({ success: false, message: 'Invalid JSON payload' }), { status: 400, headers: corsHeaders });
  }

  const { licenseKey, deviceId } = body || {};
  if (!licenseKey || !deviceId) {
    return new Response(JSON.stringify({ success: false, message: 'License key and device ID are required' }), { status: 400, headers: corsHeaders });
  }

  const keyHash = await hashKey(licenseKey);
  const license = await env.DB.prepare('SELECT * FROM licenses WHERE license_key_hash = ?').bind(keyHash).first();

  if (!license) {
    await recordFailedAttempt(clientIP, env);
    return new Response(JSON.stringify({ success: false, message: 'Invalid or inactive license key.' }), { status: 400, headers: corsHeaders });
  }

  if (license.status !== 'active') {
    await recordFailedAttempt(clientIP, env);
    return new Response(JSON.stringify({ success: false, message: 'License has been revoked or is inactive.' }), { status: 400, headers: corsHeaders });
  }

  const now = Date.now();
  if (license.expires_at && now > license.expires_at) {
    await env.DB.prepare('UPDATE licenses SET status = "expired" WHERE id = ?').bind(license.id).run();
    return new Response(JSON.stringify({ success: false, message: 'License key has expired.' }), { status: 400, headers: corsHeaders });
  }

  // Check device activations
  const existingActivation = await env.DB.prepare('SELECT * FROM activations WHERE license_id = ? AND device_id = ?')
    .bind(license.id, deviceId).first();

  if (!existingActivation) {
    if (license.activation_count >= license.max_activations) {
      return new Response(JSON.stringify({
        success: false,
        message: `Activation limit reached (${license.activation_count}/${license.max_activations} devices).`
      }), { status: 400, headers: corsHeaders });
    }

    // Register activation
    const actId = 'act_' + crypto.randomUUID();
    await env.DB.prepare('INSERT INTO activations (id, license_id, device_id, activated_at, last_seen_at) VALUES (?, ?, ?, ?, ?)')
      .bind(actId, license.id, deviceId, now, now).run();

    await env.DB.prepare('UPDATE licenses SET activation_count = activation_count + 1 WHERE id = ?').bind(license.id).run();
  } else {
    await env.DB.prepare('UPDATE activations SET last_seen_at = ? WHERE id = ?').bind(now, existingActivation.id).run();
  }

  await clearRateLimit(clientIP, env);

  // Issue Token (72 hours validity)
  const secret = env.JWT_SECRET || 'EWU_HELPER_DEFAULT_SECURE_JWT_SECRET_2026';
  const hours = parseInt(env.JWT_EXPIRATION_HOURS || '72', 10);
  const exp = now + (hours * 60 * 60 * 1000);

  const token = await createToken({
    lic: license.id,
    dev: deviceId,
    iat: now,
    exp: exp
  }, secret);

  return new Response(JSON.stringify({
    success: true,
    message: 'Extension activated successfully!',
    token: token,
    expiresAt: exp,
    licenseInfo: {
      keyPrefix: license.raw_key_prefix,
      expiresAt: license.expires_at
    }
  }), { headers: corsHeaders });
}

async function handleVerify(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch (_) {}
  const { token, deviceId } = body || {};

  const secret = env.JWT_SECRET || 'EWU_HELPER_DEFAULT_SECURE_JWT_SECRET_2026';
  const payload = await parseAndVerifyToken(token, secret);

  if (!payload || payload.dev !== deviceId) {
    return new Response(JSON.stringify({ valid: false, reason: 'Invalid or expired session token.' }), { status: 401, headers: corsHeaders });
  }

  // Verify license is still active in DB
  const license = await env.DB.prepare('SELECT status, expires_at FROM licenses WHERE id = ?').bind(payload.lic).first();
  if (!license || license.status !== 'active') {
    return new Response(JSON.stringify({ valid: false, reason: 'License has been revoked or expired.' }), { status: 401, headers: corsHeaders });
  }

  if (license.expires_at && Date.now() > license.expires_at) {
    return new Response(JSON.stringify({ valid: false, reason: 'License has expired.' }), { status: 401, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ valid: true, expiresAt: payload.exp }), { headers: corsHeaders });
}

async function handleRefresh(request, env, corsHeaders) {
  let body;
  try { body = await request.json(); } catch (_) {}
  const { token, deviceId } = body || {};

  const secret = env.JWT_SECRET || 'EWU_HELPER_DEFAULT_SECURE_JWT_SECRET_2026';
  const payload = await parseAndVerifyToken(token, secret);

  if (!payload || payload.dev !== deviceId) {
    return new Response(JSON.stringify({ success: false, message: 'Invalid session token' }), { status: 401, headers: corsHeaders });
  }

  const license = await env.DB.prepare('SELECT * FROM licenses WHERE id = ?').bind(payload.lic).first();
  if (!license || license.status !== 'active') {
    return new Response(JSON.stringify({ success: false, message: 'License revoked' }), { status: 401, headers: corsHeaders });
  }

  const now = Date.now();
  const hours = parseInt(env.JWT_EXPIRATION_HOURS || '72', 10);
  const exp = now + (hours * 60 * 60 * 1000);

  const newToken = await createToken({
    lic: license.id,
    dev: deviceId,
    iat: now,
    exp: exp
  }, secret);

  return new Response(JSON.stringify({ success: true, token: newToken, expiresAt: exp }), { headers: corsHeaders });
}

/* -------------------------------------------------------------
   ADMIN DASHBOARD & API
   ------------------------------------------------------------- */

async function handleAdminAPI(path, request, env, corsHeaders) {
  let adminSecret = env.ADMIN_SECRET || 'admin123456';
  
  // Try reading password from KV storage (expecting Base64 encoded)
  if (env.ADMIN_KV) {
    const kvPassB64 = await env.ADMIN_KV.get('admin_password_b64');
    if (kvPassB64) {
      try {
        // Decode base64 to plain text for comparison
        adminSecret = atob(kvPassB64);
      } catch (_) {}
    }
  }

  const authHeader = request.headers.get('Authorization') || request.headers.get('X-Admin-Key') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!safeCompare(token, adminSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized admin access' }), { status: 401, headers: corsHeaders });
  }

  if (path === '/admin/api/licenses/create' && request.method === 'POST') {
    const body = await request.json();
    const { note, maxActivations, expiresInDays } = body || {};
    
    let rawKey = '';
    let keyHash = '';
    let exists = true;
    
    // Ensure uniqueness by checking collision in D1
    for (let attempts = 0; attempts < 5 && exists; attempts++) {
      rawKey = generateRandomKey();
      keyHash = await hashKey(rawKey);
      const row = await env.DB.prepare('SELECT id FROM licenses WHERE license_key_hash = ?').bind(keyHash).first();
      if (!row) {
        exists = false;
      }
    }
    
    if (exists) {
      return new Response(JSON.stringify({ success: false, message: 'Could not generate a unique key. Please try again.' }), { status: 500, headers: corsHeaders });
    }

    const licId = 'lic_' + crypto.randomUUID();
    const now = Date.now();
    const expiresAt = expiresInDays ? (now + (parseInt(expiresInDays, 10) * 24 * 60 * 60 * 1000)) : null;

    await env.DB.prepare(
      'INSERT INTO licenses (id, license_key_hash, raw_key_prefix, status, created_at, expires_at, max_activations, notes) VALUES (?, ?, ?, "active", ?, ?, ?, ?)'
    ).bind(licId, keyHash, rawKey.substring(0, 9) + '...', now, expiresAt, parseInt(maxActivations || '1', 10), note || '').run();

    return new Response(JSON.stringify({
      success: true,
      licenseKey: rawKey,
      licenseId: licId,
      expiresAt: expiresAt
    }), { headers: corsHeaders });
  }

  if (path === '/admin/api/licenses' && request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, raw_key_prefix, status, created_at, expires_at, max_activations, activation_count, notes FROM licenses ORDER BY created_at DESC').all();
    return new Response(JSON.stringify({ licenses: results || [] }), { headers: corsHeaders });
  }

  if (path === '/admin/api/licenses/revoke' && request.method === 'POST') {
    const { licenseId } = await request.json();
    await env.DB.prepare('UPDATE licenses SET status = "revoked" WHERE id = ?').bind(licenseId).run();
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  if (path === '/admin/api/licenses/reactivate' && request.method === 'POST') {
    const { licenseId } = await request.json();
    await env.DB.prepare('UPDATE licenses SET status = "active" WHERE id = ?').bind(licenseId).run();
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  if (path === '/admin/api/licenses/extend' && request.method === 'POST') {
    const { licenseId, additionalDays } = await request.json();
    const lic = await env.DB.prepare('SELECT expires_at FROM licenses WHERE id = ?').bind(licenseId).first();
    const baseTime = (lic && lic.expires_at && lic.expires_at > Date.now()) ? lic.expires_at : Date.now();
    const newExpiresAt = baseTime + (parseInt(additionalDays, 10) * 24 * 60 * 60 * 1000);
    await env.DB.prepare('UPDATE licenses SET expires_at = ?, status = "active" WHERE id = ?').bind(newExpiresAt, licenseId).run();
    return new Response(JSON.stringify({ success: true, newExpiresAt: newExpiresAt }), { headers: corsHeaders });
  }

  if (path === '/admin/api/stats' && request.method === 'GET') {
    const totalLic = await env.DB.prepare('SELECT COUNT(*) as count FROM licenses').first();
    const activeLic = await env.DB.prepare('SELECT COUNT(*) as count FROM licenses WHERE status = "active"').first();
    const totalAct = await env.DB.prepare('SELECT COUNT(*) as count FROM activations').first();
    return new Response(JSON.stringify({
      totalLicenses: totalLic.count,
      activeLicenses: activeLic.count,
      totalActivations: totalAct.count
    }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: 'Unknown admin route' }), { status: 404, headers: corsHeaders });
}

function handleAdminUI() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EWU Portal Helper - License Admin Hub</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030712;
      --card-bg: rgba(17, 24, 39, 0.65);
      --border-color: rgba(255, 255, 255, 0.06);
      --border-hover: rgba(255, 255, 255, 0.12);
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.15);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --glass-glow: radial-gradient(circle at top left, rgba(99,102,241,0.08), transparent 70%);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; transition: background-color 0.25s, border-color 0.25s; }
    body { background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh; overflow-x: hidden; position: relative; }
    body::before { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: var(--glass-glow); pointer-events: none; z-index: 0; }
    .container { max-width: 1200px; margin: 0 auto; position: relative; z-index: 1; }

    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; border-bottom: 1px solid var(--border-color); padding-bottom: 20px; }
    h1 { font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #a5b4fc, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    
    .btn-logout { background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 8px 16px; border-radius: 8px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .btn-logout:hover { border-color: var(--danger); color: #fff; background: rgba(239, 68, 68, 0.05); }

    .card { background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; margin-bottom: 24px; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5); }
    .card:hover { border-color: var(--border-hover); }
    
    .auth-box { max-width: 420px; margin: 120px auto; text-align: center; border-radius: 20px; padding: 40px 30px; border-color: rgba(99, 102, 241, 0.25); box-shadow: 0 20px 40px -15px rgba(99, 102, 241, 0.1); }
    .auth-box h2 { font-size: 24px; margin-bottom: 8px; font-weight: 700; color: #fff; }
    .auth-box p { color: var(--text-muted); font-size: 14px; margin-bottom: 24px; }

    input, select, button { width: 100%; padding: 12px 16px; margin-top: 8px; border-radius: 10px; border: 1px solid var(--border-color); background: rgba(31, 41, 55, 0.5); color: #fff; font-size: 14px; outline: none; }
    input:focus, select:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }
    button { background: var(--accent); border: none; font-weight: 600; cursor: pointer; color: #fff; transform: translateY(0); transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); margin-top: 16px; }
    button:hover { background: #4f46e5; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
    button:active { transform: translateY(0); }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 24px; }
    .stat { background: var(--card-bg); border: 1px solid var(--border-color); padding: 24px; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(12px); }
    .stat-info { display: flex; flex-direction: column; }
    .stat-val { font-size: 32px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #fff, #a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .stat-lbl { font-size: 14px; color: var(--text-muted); margin-top: 4px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2); display: flex; align-items: center; justify-content: center; color: var(--accent); }

    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-top: 16px; align-items: end; }
    .form-group { display: flex; flex-direction: column; }
    .form-group label { font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .form-group input, .form-group select { margin-top: 0; }

    .key-display { font-family: 'JetBrains Mono', monospace; background: rgba(0, 0, 0, 0.4); border: 1px dashed rgba(16, 185, 129, 0.3); padding: 14px; border-radius: 10px; font-size: 18px; color: var(--success); text-align: center; margin-top: 16px; user-select: all; cursor: pointer; font-weight: 700; position: relative; }
    .key-display::after { content: "Click to copy"; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 11px; font-family: 'Outfit', sans-serif; background: rgba(16, 185, 129, 0.1); color: var(--success); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.2); font-weight: 500; pointer-events: none; }

    .table-container { overflow-x: auto; margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
    th, td { padding: 16px; border-bottom: 1px solid var(--border-color); }
    th { font-weight: 600; color: var(--text-muted); background: rgba(31, 41, 55, 0.2); }
    tr:hover td { background: rgba(255, 255, 255, 0.015); }
    
    .badge { padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
    .badge-active { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.15); }
    .badge-revoked { background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.15); }
    .badge-expired { background: rgba(245, 158, 11, 0.12); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.15); }

    .btn-sm { width: auto; padding: 6px 12px; font-size: 12px; border-radius: 6px; cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; margin-top: 0; }
    .btn-danger { background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; }
    .btn-danger:hover { background: var(--danger); color: #fff; }
    .btn-success { background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; }
    .btn-success:hover { background: var(--success); color: #fff; }

    /* Custom Toast Notifications */
    .toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; }
    .toast { background: rgba(17, 24, 39, 0.95); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px 20px; color: #fff; font-size: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); backdrop-filter: blur(8px); display: flex; align-items: center; gap: 10px; transform: translateX(120%); animation: slideIn 0.3s forwards cubic-bezier(0.16, 1, 0.3, 1); }
    .toast.success { border-color: rgba(16, 185, 129, 0.4); }
    .toast.error { border-color: rgba(239, 68, 68, 0.4); }
    
    @keyframes slideIn { to { transform: translateX(0); } }

    /* Search Box & Controls */
    .controls { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; gap: 16px; flex-wrap: wrap; }
    .search-box { position: relative; max-width: 320px; width: 100%; }
    .search-box input { padding-left: 40px; margin-top: 0; }
    .search-box::before { content: "🔍"; position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text-muted); opacity: 0.6; }

    @media (max-width: 768px) {
      .form-row { grid-template-columns: 1fr; }
      th, td { padding: 12px; }
      table { font-size: 13px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="authSection" class="card auth-box">
      <h2>Admin Dashboard Access</h2>
      <p>Secure authentication using encrypted credentials storage</p>
      <input type="password" id="adminPass" placeholder="Enter Admin Secret Password" />
      <button onclick="login()">Log In Securely</button>
    </div>

    <div id="dashboardSection" style="display:none;">
      <header>
        <div>
          <h1>License Hub</h1>
          <p style="font-size: 14px; color: var(--text-muted); margin-top: 4px;">EWU Portal Helper Administration Console</p>
        </div>
        <button class="btn-logout" onclick="logout()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </button>
      </header>
      
      <div class="grid">
        <div class="stat">
          <div class="stat-info">
            <div class="stat-val" id="statTotal">0</div>
            <div class="stat-lbl">Total Licenses</div>
          </div>
          <div class="stat-icon">📄</div>
        </div>
        <div class="stat">
          <div class="stat-info">
            <div class="stat-val" id="statActive">0</div>
            <div class="stat-lbl">Active Keys</div>
          </div>
          <div class="stat-icon">🟢</div>
        </div>
        <div class="stat">
          <div class="stat-info">
            <div class="stat-val" id="statActivations">0</div>
            <div class="stat-lbl">Device Activations</div>
          </div>
          <div class="stat-icon">💻</div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">Generate Unique License Key</h3>
        <p style="font-size: 13px; color: var(--text-muted);">Uniqueness checks are executed automatically prior to D1 insertion.</p>
        
        <div class="form-row">
          <div class="form-group" style="flex: 2;">
            <label>Client Note / Identifier</label>
            <input type="text" id="licNote" placeholder="e.g. Student John Doe (Spring 2026)" />
          </div>
          <div class="form-group">
            <label>Device Limit</label>
            <input type="number" id="licMax" value="1" min="1" />
          </div>
          <div class="form-group">
            <label>Validity Duration</label>
            <select id="licExpiry">
              <option value="">Perpetual (Never Expires)</option>
              <option value="30">30 Days</option>
              <option value="90">90 Days</option>
              <option value="365">1 Year</option>
            </select>
          </div>
        </div>
        <button onclick="generateKey()" style="max-width: 220px; width: 100%;">Create New License</button>

        <div id="keyOutput" style="display:none; margin-top: 20px;">
          <div class="key-display" id="generatedKeyVal" onclick="copyGeneratedKey()"></div>
          <p style="font-size:12px; color:var(--text-muted); text-align:center; margin-top:8px;">⚠️ Make sure to copy this key now. The raw key cannot be displayed again.</p>
        </div>
      </div>

      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <h3 style="font-size: 18px; font-weight: 700;">Managed Subscriptions</h3>
          <div class="search-box">
            <input type="text" id="searchBar" oninput="filterLicenses()" placeholder="Search by prefix or client..." />
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Prefix</th>
                <th>Client Note</th>
                <th>Status</th>
                <th>Devices</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="licTable"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div class="toast-container" id="toastContainer"></div>

  <script>
    let adminToken = localStorage.getItem('ewu_admin_secret') || '';
    let allLicenses = [];

    if (adminToken) checkAuth();

    function showToast(message, type = 'success') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.innerHTML = (type === 'success' ? '✅' : '❌') + ' <span style="margin-left:8px;">' + message + '</span>';
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    async function login() {
      adminToken = document.getElementById('adminPass').value.trim();
      if (!adminToken) return showToast('Please enter your secret password', 'error');
      localStorage.setItem('ewu_admin_secret', adminToken);
      checkAuth();
    }

    function logout() {
      localStorage.removeItem('ewu_admin_secret');
      adminToken = '';
      document.getElementById('dashboardSection').style.display = 'none';
      document.getElementById('authSection').style.display = 'block';
      showToast('Logged out successfully');
    }

    async function checkAuth() {
      try {
        const res = await fetch('/admin/api/stats', { headers: { 'Authorization': 'Bearer ' + adminToken } });
        if (res.ok) {
          document.getElementById('authSection').style.display = 'none';
          document.getElementById('dashboardSection').style.display = 'block';
          loadDashboard();
        } else {
          showToast('Invalid Secret Key', 'error');
          localStorage.removeItem('ewu_admin_secret');
        }
      } catch (e) {
        showToast('Connection to server failed', 'error');
      }
    }

    async function loadDashboard() {
      try {
        const statsRes = await fetch('/admin/api/stats', { headers: { 'Authorization': 'Bearer ' + adminToken } });
        if (!statsRes.ok) return;
        const stats = await statsRes.json();
        document.getElementById('statTotal').textContent = stats.totalLicenses || 0;
        document.getElementById('statActive').textContent = stats.activeLicenses || 0;
        document.getElementById('statActivations').textContent = stats.totalActivations || 0;

        const licRes = await fetch('/admin/api/licenses', { headers: { 'Authorization': 'Bearer ' + adminToken } });
        const licData = await licRes.json();
        allLicenses = licData.licenses || [];
        renderLicenses(allLicenses);
      } catch (e) {
        showToast('Failed to load dashboard data', 'error');
      }
    }

    function renderLicenses(licenses) {
      const tbody = document.getElementById('licTable');
      if (licenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No matching licenses found</td></tr>';
        return;
      }
      tbody.innerHTML = licenses.map(l => {
        let badgeClass = 'badge-active';
        if (l.status === 'revoked') badgeClass = 'badge-revoked';
        else if (l.status === 'expired') badgeClass = 'badge-expired';

        return \`
          <tr>
            <td style="font-family:'JetBrains Mono', monospace; font-weight:700;">\${l.raw_key_prefix}</td>
            <td>\${l.notes || '<span style="color:var(--text-muted); opacity:0.5;">None</span>'}</td>
            <td><span class="badge \${badgeClass}">\${l.status}</span></td>
            <td>\${l.activation_count} / \${l.max_activations}</td>
            <td>\${l.expires_at ? new Date(l.expires_at).toLocaleDateString() : '<span style="color:var(--success);">Lifetime</span>'}</td>
            <td>
              \${l.status === 'active' 
                ? \`<button class="btn-sm btn-danger" onclick="revoke('\${l.id}')">Revoke</button>\`
                : \`<button class="btn-sm btn-success" onclick="reactivate('\${l.id}')">Reactivate</button>\`
              }
            </td>
          </tr>
        \`;
      }).join('');
    }

    function filterLicenses() {
      const q = document.getElementById('searchBar').value.toLowerCase().trim();
      const filtered = allLicenses.filter(l => 
        l.raw_key_prefix.toLowerCase().includes(q) || 
        (l.notes && l.notes.toLowerCase().includes(q))
      );
      renderLicenses(filtered);
    }

    async function generateKey() {
      const note = document.getElementById('licNote').value;
      const maxActivations = document.getElementById('licMax').value;
      const expiresInDays = document.getElementById('licExpiry').value;

      try {
        const res = await fetch('/admin/api/licenses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ note, maxActivations, expiresInDays })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('generatedKeyVal').textContent = data.licenseKey;
          document.getElementById('keyOutput').style.display = 'block';
          document.getElementById('licNote').value = '';
          showToast('Unique license key created!');
          loadDashboard();
        } else {
          showToast(data.message || 'Key generation failure', 'error');
        }
      } catch (e) {
        showToast('Error communicating with Server', 'error');
      }
    }

    function copyGeneratedKey() {
      const keyVal = document.getElementById('generatedKeyVal').textContent;
      navigator.clipboard.writeText(keyVal).then(() => {
        showToast('Key copied to clipboard!');
      });
    }

    async function revoke(id) {
      if (!confirm('Are you sure you want to revoke this license?')) return;
      try {
        const res = await fetch('/admin/api/licenses/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ licenseId: id })
        });
        if (res.ok) {
          showToast('License revoked successfully');
          loadDashboard();
        } else {
          showToast('Failed to revoke license', 'error');
        }
      } catch (e) {
        showToast('Error revoking license', 'error');
      }
    }

    async function reactivate(id) {
      try {
        const res = await fetch('/admin/api/licenses/reactivate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ licenseId: id })
        });
        if (res.ok) {
          showToast('License reactivated successfully');
          loadDashboard();
        } else {
          showToast('Failed to reactivate license', 'error');
        }
      } catch (e) {
        showToast('Error reactivating license', 'error');
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
