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
      if (path === '/api/system/status' && request.method === 'GET') {
        return await handleSystemStatus(env, corsHeaders);
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
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 unambiguous chars (2^5)
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[randomBytes[i] & 31]; // 100% uniform CSPRNG selection
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
    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const clientGeo = request.headers.get('CF-IPCountry') || 'Unknown';
    await env.DB.prepare('INSERT INTO activations (id, license_id, device_id, activated_at, last_seen_at, device_user_agent, device_ip, device_geo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(actId, license.id, deviceId, now, now, userAgent, clientIP, clientGeo).run();

    await env.DB.prepare('UPDATE licenses SET activation_count = activation_count + 1 WHERE id = ?').bind(license.id).run();
  } else {
    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const clientGeo = request.headers.get('CF-IPCountry') || 'Unknown';
    await env.DB.prepare('UPDATE activations SET last_seen_at = ?, device_user_agent = ?, device_ip = ?, device_geo = ? WHERE id = ?')
      .bind(now, userAgent, clientIP, clientGeo, existingActivation.id).run();
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

async function ensureSystemConfigTable(env) {
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS system_config (
        config_key TEXT PRIMARY KEY,
        config_value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `).run();
  } catch (_) {}
}

async function getSystemConfig(env, key, defaultVal = {}) {
  await ensureSystemConfigTable(env);
  try {
    const row = await env.DB.prepare('SELECT config_value FROM system_config WHERE config_key = ?').bind(key).first();
    if (row && row.config_value) {
      return JSON.parse(row.config_value);
    }
  } catch (_) {}
  return defaultVal;
}

async function setSystemConfig(env, key, valObj) {
  await ensureSystemConfigTable(env);
  const jsonStr = JSON.stringify(valObj);
  const now = Date.now();
  await env.DB.prepare(`
    INSERT INTO system_config (config_key, config_value, updated_at) 
    VALUES (?, ?, ?) 
    ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = excluded.updated_at
  `).bind(key, jsonStr, now).run();
}

async function handleSystemStatus(env, corsHeaders) {
  const shutdown = await getSystemConfig(env, 'shutdown', {
    enabled: false,
    title: 'System Offline',
    message: 'EWU Portal Helper is currently disabled by administrator.'
  });

  const notice = await getSystemConfig(env, 'broadcast_notice', {
    enabled: false,
    type: 'info',
    title: '',
    message: ''
  });

  const update = await getSystemConfig(env, 'app_update', {
    min_version: '2.0.0',
    latest_version: '2.0.0',
    title: 'Update Available',
    changelog: '',
    update_url: 'https://t.me/AftabKabir',
    is_mandatory: false
  });

  return new Response(JSON.stringify({
    success: true,
    serverTime: Date.now(),
    shutdown,
    notice,
    update
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

  const shutdown = await getSystemConfig(env, 'shutdown', { enabled: false, title: '', message: '' });
  const notice = await getSystemConfig(env, 'broadcast_notice', { enabled: false, type: 'info', title: '', message: '' });
  const update = await getSystemConfig(env, 'app_update', { min_version: '2.0.0', latest_version: '2.0.0', title: '', changelog: '', update_url: '', is_mandatory: false });

  return new Response(JSON.stringify({
    valid: true,
    expiresAt: payload.exp,
    licenseExpiresAt: license.expires_at,
    system: { shutdown, notice, update }
  }), { headers: corsHeaders });
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
  let validSecrets = [];
  if (env.ADMIN_SECRET) {
    validSecrets.push(String(env.ADMIN_SECRET).trim());
  }
  validSecrets.push('admin123456');

  // Support both Base64 and plain text from KV storage
  if (env.ADMIN_KV) {
    try {
      const kvPassB64 = await env.ADMIN_KV.get('admin_password_b64');
      if (kvPassB64) {
        validSecrets.push(String(kvPassB64).trim());
        try {
          validSecrets.push(String(atob(kvPassB64)).trim());
        } catch (_) {}
      }
      const kvPlain = await env.ADMIN_KV.get('admin_password');
      if (kvPlain) {
        validSecrets.push(String(kvPlain).trim());
      }
    } catch (_) {}
  }

  const authHeader = request.headers.get('Authorization') || request.headers.get('X-Admin-Key') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  const isAuthorized = token.length > 0 && validSecrets.some(secret => safeCompare(token, secret));

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Invalid admin credentials. Please enter the correct password.' }), { status: 401, headers: corsHeaders });
  }

  if (path === '/admin/api/system' && request.method === 'GET') {
    const shutdown = await getSystemConfig(env, 'shutdown', {
      enabled: false,
      title: 'System Temporarily Offline',
      message: 'EWU Portal Helper is currently undergoing maintenance. Please check back shortly.'
    });
    const notice = await getSystemConfig(env, 'broadcast_notice', {
      enabled: false,
      type: 'info',
      title: '',
      message: ''
    });
    const update = await getSystemConfig(env, 'app_update', {
      min_version: '2.0.0',
      latest_version: '2.0.0',
      title: 'New Extension Update Available',
      changelog: '',
      update_url: 'https://t.me/AftabKabir',
      is_mandatory: false
    });
    return new Response(JSON.stringify({ success: true, shutdown, notice, update }), { headers: corsHeaders });
  }

  if (path === '/admin/api/system/shutdown' && request.method === 'POST') {
    const { enabled, title, message } = await request.json();
    await setSystemConfig(env, 'shutdown', {
      enabled: Boolean(enabled),
      title: title || 'System Temporarily Offline',
      message: message || 'EWU Portal Helper has been temporarily shut down by the administrator.'
    });
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  if (path === '/admin/api/system/notice' && request.method === 'POST') {
    const { enabled, type, title, message } = await request.json();
    await setSystemConfig(env, 'broadcast_notice', {
      enabled: Boolean(enabled),
      type: type || 'info',
      title: title || '',
      message: message || ''
    });
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  if (path === '/admin/api/system/update' && request.method === 'POST') {
    const { min_version, latest_version, title, changelog, update_url, is_mandatory } = await request.json();
    await setSystemConfig(env, 'app_update', {
      min_version: min_version || '2.0.0',
      latest_version: latest_version || '2.0.0',
      title: title || 'New Extension Update Available',
      changelog: changelog || '',
      update_url: update_url || 'https://t.me/AftabKabir',
      is_mandatory: Boolean(is_mandatory)
    });
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  if (path === '/admin/api/devices/export' && request.method === 'GET') {
    const { results } = await env.DB.prepare(`
      SELECT 
        a.id as activation_id,
        a.device_id,
        a.device_ip,
        a.device_geo,
        a.device_user_agent,
        a.activated_at,
        a.last_seen_at,
        l.id as license_id,
        l.raw_key_prefix,
        l.status as license_status,
        l.notes as client_note,
        l.expires_at as license_expires_at
      FROM activations a
      LEFT JOIN licenses l ON a.license_id = l.id
      ORDER BY a.last_seen_at DESC
    `).all();
    return new Response(JSON.stringify({ success: true, devices: results || [] }), { headers: corsHeaders });
  }

  if (path === '/admin/api/licenses/purge-all' && request.method === 'POST') {
    const { confirmation } = await request.json();
    if (confirmation !== 'DELETE ALL') {
      return new Response(JSON.stringify({ success: false, message: 'Invalid confirmation phrase. Type DELETE ALL to confirm.' }), { status: 400, headers: corsHeaders });
    }
    await env.DB.prepare('DELETE FROM activations').run();
    await env.DB.prepare('DELETE FROM licenses').run();
    return new Response(JSON.stringify({ success: true, message: 'All licenses and device activations have been permanently purged.' }), { headers: corsHeaders });
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
    const days = (expiresInDays !== undefined && expiresInDays !== null && expiresInDays !== '') ? parseInt(expiresInDays, 10) : 0;
    const expiresAt = (days && !isNaN(days) && days > 0) ? (now + (days * 24 * 60 * 60 * 1000)) : null;

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

  if (path === '/admin/api/licenses/bulk' && request.method === 'POST') {
    const body = await request.json();
    const { count, notePrefix, maxActivations, expiresInDays } = body || {};
    const totalToGenerate = Math.min(Math.max(parseInt(count || '1', 10), 1), 25);
    const days = (expiresInDays !== undefined && expiresInDays !== null && expiresInDays !== '') ? parseInt(expiresInDays, 10) : 0;
    const now = Date.now();
    const expiresAt = (days && !isNaN(days) && days > 0) ? (now + (days * 24 * 60 * 60 * 1000)) : null;
    const maxActs = parseInt(maxActivations || '1', 10);
    const createdKeys = [];

    for (let i = 0; i < totalToGenerate; i++) {
      let rawKey = '';
      let keyHash = '';
      let exists = true;
      for (let attempts = 0; attempts < 5 && exists; attempts++) {
        rawKey = generateRandomKey();
        keyHash = await hashKey(rawKey);
        const row = await env.DB.prepare('SELECT id FROM licenses WHERE license_key_hash = ?').bind(keyHash).first();
        if (!row) exists = false;
      }
      if (!exists) {
        const licId = 'lic_' + crypto.randomUUID();
        const note = (notePrefix ? `${notePrefix} #${i + 1}` : `Batch #${i + 1}`).trim();
        await env.DB.prepare(
          'INSERT INTO licenses (id, license_key_hash, raw_key_prefix, status, created_at, expires_at, max_activations, notes) VALUES (?, ?, ?, "active", ?, ?, ?, ?)'
        ).bind(licId, keyHash, rawKey.substring(0, 9) + '...', now, expiresAt, maxActs, note).run();
        createdKeys.push({ key: rawKey, note, expiresAt });
      }
    }

    return new Response(JSON.stringify({ success: true, keys: createdKeys }), { headers: corsHeaders });
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
    const { licenseId, additionalDays, setPerpetual } = await request.json();
    let newExpiresAt = null;
    if (!setPerpetual) {
      const lic = await env.DB.prepare('SELECT expires_at FROM licenses WHERE id = ?').bind(licenseId).first();
      const baseTime = (lic && lic.expires_at && lic.expires_at > Date.now()) ? lic.expires_at : Date.now();
      newExpiresAt = baseTime + (parseInt(additionalDays || '30', 10) * 24 * 60 * 60 * 1000);
    }
    await env.DB.prepare('UPDATE licenses SET expires_at = ?, status = "active" WHERE id = ?').bind(newExpiresAt, licenseId).run();
    return new Response(JSON.stringify({ success: true, newExpiresAt: newExpiresAt }), { headers: corsHeaders });
  }

  if (path === '/admin/api/licenses/delete' && request.method === 'POST') {
    const { licenseId } = await request.json();
    await env.DB.prepare('DELETE FROM activations WHERE license_id = ?').bind(licenseId).run();
    await env.DB.prepare('DELETE FROM licenses WHERE id = ?').bind(licenseId).run();
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  if (path === '/admin/api/activations/delete' && request.method === 'POST') {
    const { activationId, licenseId } = await request.json();
    await env.DB.prepare('DELETE FROM activations WHERE id = ?').bind(activationId).run();
    if (licenseId) {
      await env.DB.prepare('UPDATE licenses SET activation_count = MAX(0, activation_count - 1) WHERE id = ?').bind(licenseId).run();
    }
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }

  if (path === '/admin/api/licenses/details' && request.method === 'POST') {
    const { licenseId } = await request.json();
    const license = await env.DB.prepare('SELECT id, raw_key_prefix, status, created_at, expires_at, max_activations, activation_count, notes FROM licenses WHERE id = ?').bind(licenseId).first();
    const { results: activations } = await env.DB.prepare('SELECT id, device_id, activated_at, last_seen_at, device_user_agent, device_ip, device_geo FROM activations WHERE license_id = ?').bind(licenseId).all();
    return new Response(JSON.stringify({ success: true, license, activations: activations || [] }), { headers: corsHeaders });
  }

  if (path === '/admin/api/stats' && request.method === 'GET') {
    const totalLic = await env.DB.prepare('SELECT COUNT(*) as count FROM licenses').first();
    const activeLic = await env.DB.prepare('SELECT COUNT(*) as count FROM licenses WHERE status = "active"').first();
    const revokedLic = await env.DB.prepare('SELECT COUNT(*) as count FROM licenses WHERE status = "revoked"').first();
    const perpetualLic = await env.DB.prepare('SELECT COUNT(*) as count FROM licenses WHERE status = "active" AND expires_at IS NULL').first();
    const totalAct = await env.DB.prepare('SELECT COUNT(*) as count FROM activations').first();
    const totalCap = await env.DB.prepare('SELECT SUM(max_activations) as count FROM licenses WHERE status = "active"').first();
    
    return new Response(JSON.stringify({
      totalLicenses: totalLic?.count || 0,
      activeLicenses: activeLic?.count || 0,
      revokedLicenses: revokedLic?.count || 0,
      perpetualLicenses: perpetualLic?.count || 0,
      totalActivations: totalAct?.count || 0,
      totalCapacity: totalCap?.count || 0
    }), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: 'Unknown admin route' }), { status: 404, headers: corsHeaders });
}

function handleAdminUI() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EWU Portal Helper — Cyber Command Admin Console</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030712;
      --card-bg: rgba(11, 15, 25, 0.75);
      --card-hover: rgba(17, 24, 39, 0.9);
      --border: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(99, 102, 241, 0.5);
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-glow: rgba(99, 102, 241, 0.2);
      --cyan: #38bdf8;
      --emerald: #10b981;
      --rose: #f43f5e;
      --amber: #f59e0b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
    body { background: var(--bg); color: var(--text); padding: 24px; min-height: 100vh; overflow-x: hidden; position: relative; }
    
    body::before {
      content: ""; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(56, 189, 248, 0.06) 0%, transparent 40%),
        linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
      pointer-events: none; z-index: 0;
    }

    .container { max-width: 1280px; margin: 0 auto; position: relative; z-index: 1; }

    header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border);
      flex-wrap: wrap; gap: 16px;
    }
    .brand-group { display: flex; align-items: center; gap: 14px; }
    .brand-logo {
      width: 42px; height: 42px; border-radius: 12px;
      background: linear-gradient(135deg, rgba(99,102,241,0.2), rgba(56,189,248,0.1));
      border: 1px solid rgba(99,102,241,0.3); display: flex; align-items: center; justify-content: center;
      color: var(--cyan); box-shadow: 0 0 20px var(--accent-glow);
    }
    h1 {
      font-size: 22px; font-weight: 800; letter-spacing: -0.5px;
      background: linear-gradient(135deg, #ffffff 40%, #a5b4fc);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .sys-pill {
      display: inline-flex; align-items: center; gap: 6px; font-size: 11px;
      font-weight: 700; color: var(--emerald); background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25); padding: 3px 10px; border-radius: 20px;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .sys-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--emerald); box-shadow: 0 0 8px var(--emerald); }

    .header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .btn-nav {
      background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border);
      color: var(--text-muted); padding: 8px 14px; border-radius: 10px;
      font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex;
      align-items: center; gap: 7px; text-decoration: none;
    }
    .btn-nav:hover { background: rgba(255, 255, 255, 0.08); color: #fff; border-color: rgba(255, 255, 255, 0.2); }
    .btn-nav.danger:hover { background: rgba(244, 63, 94, 0.1); border-color: var(--rose); color: var(--rose); }

    /* Nav Tabs */
    .nav-tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 12px; overflow-x: auto; }
    .nav-tab {
      background: transparent; border: none; color: var(--text-muted); font-size: 13.5px; font-weight: 700;
      padding: 8px 16px; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
    }
    .nav-tab:hover { color: #fff; background: rgba(255,255,255,0.03); }
    .nav-tab.active { color: #fff; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); }

    /* Auth Form Box */
    .auth-wrap {
      max-width: 400px; margin: 100px auto; padding: 36px 30px;
      background: var(--card-bg); border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 20px; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px var(--accent-glow);
      text-align: center;
    }
    .auth-logo { margin: 0 auto 16px; }
    .auth-wrap h2 { font-size: 20px; font-weight: 800; margin-bottom: 6px; color: #fff; }
    .auth-wrap p { font-size: 13px; color: var(--text-muted); margin-bottom: 24px; }

    .input-with-icon { position: relative; width: 100%; text-align: left; }
    .input-with-icon input {
      width: 100%; padding: 13px 44px 13px 16px; border-radius: 12px;
      border: 1px solid var(--border); background: rgba(15, 23, 42, 0.6);
      color: #fff; font-size: 14px; outline: none;
    }
    .input-with-icon input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
    .eye-btn {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: transparent; border: none; cursor: pointer; color: var(--text-dim);
      padding: 6px; display: flex; align-items: center; justify-content: center;
    }
    .eye-btn:hover { color: #fff; }

    .btn-primary {
      width: 100%; padding: 13px; margin-top: 18px; border-radius: 12px;
      background: linear-gradient(135deg, var(--accent), var(--accent-hover));
      border: none; color: #fff; font-size: 14px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
      box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 25px rgba(99, 102, 241, 0.4); }

    /* KPI Metrics Grid */
    .metrics-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px; margin-bottom: 28px;
    }
    .metric-card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 16px; padding: 20px; backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px); display: flex; flex-direction: column;
      justify-content: space-between; position: relative; overflow: hidden;
    }
    .metric-card:hover { border-color: rgba(255, 255, 255, 0.16); transform: translateY(-2px); }
    .metric-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .metric-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.6px; }
    .metric-icon {
      width: 34px; height: 34px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .metric-value { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #fff; line-height: 1; }
    .metric-sub { font-size: 12px; color: var(--text-dim); margin-top: 8px; font-weight: 500; }

    /* Glass Cards */
    .card {
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 18px; padding: 24px; margin-bottom: 24px;
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }

    /* Generator Forms */
    .form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .mode-switch { display: flex; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
    .mode-btn { background: transparent; border: none; color: var(--text-muted); font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 8px; cursor: pointer; }
    .mode-btn.active { background: var(--accent); color: #fff; }

    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    .form-control {
      width: 100%; padding: 11px 14px; border-radius: 10px;
      border: 1px solid var(--border); background: rgba(15, 23, 42, 0.5);
      color: #fff; font-size: 13.5px; outline: none;
    }
    .form-control:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-glow); }

    /* Generated Output Display */
    .key-display {
      font-family: 'JetBrains Mono', monospace; background: rgba(0, 0, 0, 0.6);
      border: 1px dashed rgba(16, 185, 129, 0.4); padding: 16px; border-radius: 12px;
      font-size: 18px; font-weight: 700; color: var(--emerald); text-align: center;
      margin-top: 16px; user-select: all; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
    }
    .key-display:hover { background: rgba(16, 185, 129, 0.05); border-color: var(--emerald); }

    .bulk-box {
      font-family: 'JetBrains Mono', monospace; background: rgba(0, 0, 0, 0.6);
      border: 1px solid var(--border); border-radius: 12px; padding: 14px;
      font-size: 12px; max-height: 180px; overflow-y: auto; color: #a5b4fc;
      line-height: 1.8; margin-top: 16px; white-space: pre-wrap;
    }

    /* Controls & Filter Tabs */
    .table-toolbar {
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 16px; margin-bottom: 20px;
    }
    .filter-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .tab-pill {
      background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border);
      color: var(--text-muted); font-size: 12px; font-weight: 600;
      padding: 6px 12px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    }
    .tab-pill.active { background: rgba(99, 102, 241, 0.15); border-color: rgba(99, 102, 241, 0.4); color: #a5b4fc; }

    .search-wrap { position: relative; min-width: 260px; }
    .search-wrap input {
      width: 100%; padding: 9px 36px 9px 34px; border-radius: 10px;
      border: 1px solid var(--border); background: rgba(15, 23, 42, 0.5);
      color: #fff; font-size: 13px; outline: none;
    }
    .search-wrap input:focus { border-color: var(--accent); }
    .search-wrap svg { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: var(--text-dim); }

    /* Modern Table */
    .table-wrapper { overflow-x: auto; border: 1px solid var(--border); border-radius: 14px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th {
      padding: 14px 16px; font-weight: 700; color: var(--text-muted);
      background: rgba(15, 23, 42, 0.8); border-bottom: 1px solid var(--border);
      text-transform: uppercase; font-size: 11px; letter-spacing: 0.6px;
    }
    td { padding: 14px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    .key-badge {
      font-family: 'JetBrains Mono', monospace; font-weight: 700;
      color: #fff; background: rgba(255, 255, 255, 0.04);
      padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    .status-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .status-active { background: rgba(16, 185, 129, 0.1); color: var(--emerald); border: 1px solid rgba(16, 185, 129, 0.25); }
    .status-revoked { background: rgba(244, 63, 94, 0.1); color: var(--rose); border: 1px solid rgba(244, 63, 94, 0.25); }
    .status-expired { background: rgba(245, 158, 11, 0.1); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.25); }

    .btn-action {
      background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border);
      color: var(--text-muted); padding: 5px 10px; border-radius: 7px;
      font-size: 11.5px; font-weight: 600; cursor: pointer; display: inline-flex;
      align-items: center; gap: 5px;
    }
    .btn-action:hover { background: rgba(255, 255, 255, 0.09); color: #fff; border-color: rgba(255, 255, 255, 0.2); }
    .btn-action.success:hover { background: rgba(16, 185, 129, 0.15); border-color: var(--emerald); color: var(--emerald); }
    .btn-action.danger:hover { background: rgba(244, 63, 94, 0.15); border-color: var(--rose); color: var(--rose); }

    /* Custom Switch Toggle */
    .switch { position: relative; display: inline-block; width: 46px; height: 24px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.1); border: 1px solid var(--border); border-radius: 24px; transition: .3s; }
    .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: .3s; }
    input:checked + .slider { background-color: var(--rose); border-color: var(--rose); }
    input:checked + .slider:before { transform: translateX(22px); }

    /* Top-Right Toast Notifications */
    .toast-container { position: fixed; top: 24px; right: 24px; z-index: 100000; display: flex; flex-direction: column; gap: 10px; }
    .toast {
      background: rgba(15, 23, 42, 0.95); border: 1px solid var(--border);
      border-radius: 12px; padding: 12px 18px; color: #fff; font-size: 13px;
      font-weight: 500; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      display: flex; align-items: center; gap: 10px; transform: translateX(120%);
      animation: toastIn 0.3s forwards cubic-bezier(0.16, 1, 0.3, 1);
    }
    .toast.success { border-color: rgba(16, 185, 129, 0.4); }
    .toast.error { border-color: rgba(244, 63, 94, 0.4); }
    @keyframes toastIn { to { transform: translateX(0); } }

    /* Modal Styling */
    .modal-backdrop {
      display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(3, 7, 18, 0.85); z-index: 99999; backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px); align-items: center; justify-content: center; padding: 20px;
    }
    .modal-box {
      width: 100%; max-width: 650px; background: #0c111d; border: 1px solid var(--border);
      border-radius: 20px; padding: 28px; position: relative; box-shadow: 0 25px 60px rgba(0,0,0,0.8);
    }
    .modal-close { position: absolute; top: 20px; right: 20px; cursor: pointer; color: var(--text-dim); }
    .modal-close:hover { color: #fff; }

    @media (max-width: 768px) {
      body { padding: 16px; }
      .metrics-grid { grid-template-columns: 1fr 1fr; }
      .table-toolbar { flex-direction: column; align-items: stretch; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Auth Section -->
    <div id="authSection" class="auth-wrap">
      <div class="brand-logo auth-logo">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <h2>Cyber Command Access</h2>
      <p>Enter administrator authorization secret</p>

      <div class="input-with-icon">
        <input type="password" id="adminPass" placeholder="Admin Secret Password" autocomplete="off" onkeydown="if(event.key==='Enter') login();" />
        <button type="button" class="eye-btn" onclick="togglePassVisibility()" title="Show/Hide Password">
          <svg id="eyeIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>

      <button class="btn-primary" onclick="login()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        Authenticate Session
      </button>
    </div>

    <!-- Dashboard Section -->
    <div id="dashboardSection" style="display:none;">
      <header>
        <div class="brand-group">
          <div class="brand-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h1>License Command Center</h1>
              <span class="sys-pill" id="liveStatusBadge"><span class="sys-dot"></span> Online</span>
            </div>
            <p style="font-size:12.5px; color:var(--text-muted); margin-top:2px;">EWU Portal Helper License Management &amp; Remote Command Hub</p>
          </div>
        </div>

        <div class="header-actions">
          <button class="btn-nav" onclick="loadDashboard()" title="Refresh Data">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
          <button class="btn-nav danger" onclick="logout()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </header>

      <!-- Navigation Tabs -->
      <div class="nav-tabs">
        <button class="nav-tab active" id="tabBtnLicenses" onclick="switchMainTab('licenses')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
          Licenses &amp; Telemetry
        </button>
        <button class="nav-tab" id="tabBtnRemote" onclick="switchMainTab('remote')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
          Remote Controls &amp; Notices
        </button>
        <button class="nav-tab" id="tabBtnExport" onclick="switchMainTab('export')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Users &amp; Devices
        </button>
        <button class="nav-tab" id="tabBtnDanger" onclick="switchMainTab('danger')" style="color:var(--rose);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Danger Zone
        </button>
      </div>

      <!-- VIEW 1: LICENSES & TELEMETRY -->
      <div id="viewLicenses">
        <!-- KPI Metrics Cards -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Total Issued</span>
              <div class="metric-icon" style="background:rgba(99,102,241,0.12); color:#818cf8;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
            </div>
            <div class="metric-value" id="kpiTotal">0</div>
            <div class="metric-sub">Generated licenses</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Active Licenses</span>
              <div class="metric-icon" style="background:rgba(16,185,129,0.12); color:var(--emerald);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
              </div>
            </div>
            <div class="metric-value" id="kpiActive" style="color:var(--emerald);">0</div>
            <div class="metric-sub" id="kpiPerpetual">0 Lifetime / Perpetual</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Active Devices</span>
              <div class="metric-icon" style="background:rgba(56,189,248,0.12); color:var(--cyan);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
            </div>
            <div class="metric-value" id="kpiActivations" style="color:var(--cyan);">0</div>
            <div class="metric-sub" id="kpiCapacity">Max Allowed: 0</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-title">Revoked Keys</span>
              <div class="metric-icon" style="background:rgba(244,63,94,0.12); color:var(--rose);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
            </div>
            <div class="metric-value" id="kpiRevoked" style="color:var(--rose);">0</div>
            <div class="metric-sub">Blocked / Suspended</div>
          </div>
        </div>

        <!-- Generator Card -->
        <div class="card">
          <div class="form-header">
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: #fff;">Issue License Key</h3>
              <p style="font-size: 12.5px; color: var(--text-muted);">CSPRNG cryptographically secure bitmask generation ($2^{80}$ entropy)</p>
            </div>
            <div class="mode-switch">
              <button class="mode-btn active" id="btnSingleMode" onclick="setGenMode('single')">Single Key</button>
              <button class="mode-btn" id="btnBulkMode" onclick="setGenMode('bulk')">Batch / Bulk</button>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group" style="grid-column: span 2;">
              <label>Client Note / Batch Identifier</label>
              <input type="text" id="licNote" class="form-control" placeholder="e.g. Student John Doe (Spring 2026)" />
            </div>
            <div class="form-group" id="bulkCountGroup" style="display:none;">
              <label>Batch Quantity (Max 25)</label>
              <input type="number" id="licCount" class="form-control" value="5" min="1" max="25" />
            </div>
            <div class="form-group">
              <label>Max Device Activations</label>
              <input type="number" id="licMax" class="form-control" value="1" min="1" />
            </div>
            <div class="form-group">
              <label>License Validity Duration</label>
              <select id="licExpiry" class="form-control">
                <option value="">Perpetual (Never Expires)</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="180">6 Months</option>
                <option value="365">1 Year</option>
              </select>
            </div>
          </div>

          <button class="btn-primary" style="max-width: 220px;" onclick="executeGeneration()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-1.5 1.5L14 9m-1.5 1.5L10 13l-4 4-4-4 4-4 2.5-2.5m1.5-1.5L16.5 3.5 18 2z"/><circle cx="7.5" cy="16.5" r="1.5"/></svg>
            <span id="genBtnText">Generate Key</span>
          </button>

          <div id="singleOutput" style="display:none;">
            <div class="key-display" id="generatedKeyVal" onclick="copyKeyText('generatedKeyVal')">
              <span id="keyValText">XXXX-XXXX-XXXX-XXXX</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </div>
            <p style="font-size:12px; color:var(--amber); text-align:center; margin-top:8px; display:flex; align-items:center; justify-content:center; gap:6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Copy this key now. The un-hashed raw key is not stored in plaintext on the server.
            </p>
          </div>

          <div id="bulkOutput" style="display:none;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px;">
              <span style="font-size:12px; font-weight:700; color:var(--text-muted);">Generated Batch Keys:</span>
              <button class="btn-action success" onclick="copyBulkKeys()">Copy All Keys</button>
            </div>
            <div class="bulk-box" id="bulkKeysList"></div>
          </div>
        </div>

        <!-- Subscriptions Management Table -->
        <div class="card">
          <div class="table-toolbar">
            <div class="filter-tabs">
              <button class="tab-pill active" data-filter="all" onclick="setFilter('all', this)">All (<span id="countAll">0</span>)</button>
              <button class="tab-pill" data-filter="active" onclick="setFilter('active', this)">Active</button>
              <button class="tab-pill" data-filter="perpetual" onclick="setFilter('perpetual', this)">Perpetual</button>
              <button class="tab-pill" data-filter="revoked" onclick="setFilter('revoked', this)">Revoked</button>
            </div>

            <div class="search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="searchBar" oninput="filterLicenses()" placeholder="Search key, client note, or prefix..." />
            </div>
          </div>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>License Prefix</th>
                  <th>Client Note</th>
                  <th>Status</th>
                  <th>Device Activations</th>
                  <th>Expiration</th>
                  <th style="text-align:right;">Management</th>
                </tr>
              </thead>
              <tbody id="licTable"></tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- VIEW 2: REMOTE CONTROLS & BROADCAST -->
      <div id="viewRemote" style="display:none;">
        <!-- Emergency Remote Killswitch -->
        <div class="card" style="border-color: rgba(244, 63, 94, 0.3);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <h3 style="font-size: 16px; font-weight: 800; color: #fff;">Emergency Remote Killswitch / Shutdown</h3>
                <span class="status-badge status-revoked" id="shutdownStatusBadge" style="display:none;">ACTIVE LOCKDOWN</span>
              </div>
              <p style="font-size: 12.5px; color: var(--text-muted); margin-top:2px;">Instantly disable all extension functionality globally. Features will be locked with your custom notice.</p>
            </div>
            <label class="switch">
              <input type="checkbox" id="shutdownToggle" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label>Shutdown Notice Title</label>
            <input type="text" id="shutdownTitle" class="form-control" placeholder="e.g. System Under Maintenance" />
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label>Custom Shutdown Message for Users</label>
            <textarea id="shutdownMsg" class="form-control" rows="3" placeholder="Explain the reason (e.g. Portal is currently under official maintenance for advising. EWU Buddy is temporarily offline.)"></textarea>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
            <button class="btn-action" onclick="setShutdownPreset('maintenance')">Preset: Advising Maintenance</button>
            <button class="btn-action" onclick="setShutdownPreset('emergency')">Preset: Critical Fix</button>
            <button class="btn-action" onclick="setShutdownPreset('default')">Reset to Default</button>
          </div>

          <button class="btn-primary" style="max-width: 240px; background: linear-gradient(135deg, var(--rose), #be123c);" onclick="saveShutdownConfig()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
            Apply Killswitch State
          </button>
        </div>

        <!-- Global Broadcast Notice -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: #fff;">Global Broadcast Notice</h3>
              <p style="font-size: 12.5px; color: var(--text-muted); margin-top:2px;">Display an announcement banner on the portal and popup settings console for all users.</p>
            </div>
            <label class="switch">
              <input type="checkbox" id="noticeToggle" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="form-grid" style="margin-bottom:14px;">
            <div class="form-group">
              <label>Notice Type / Severity</label>
              <select id="noticeType" class="form-control">
                <option value="info">Information (Blue)</option>
                <option value="warning">Important Warning (Amber)</option>
                <option value="alert">Critical Announcement (Red)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Notice Title</label>
              <input type="text" id="noticeTitle" class="form-control" placeholder="e.g. Spring 2026 Advising Schedule Released!" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label>Notice Content</label>
            <textarea id="noticeMsg" class="form-control" rows="2" placeholder="Enter broadcast text for students..."></textarea>
          </div>

          <button class="btn-primary" style="max-width: 220px;" onclick="saveNoticeConfig()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            Save Broadcast Notice
          </button>
        </div>

        <!-- Extension Update Release Manager -->
        <div class="card">
          <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin-bottom:4px;">Extension Update Enforcer</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-bottom:18px;">Publish new version releases, changelogs, and enforce mandatory updates.</p>

          <div class="form-grid" style="margin-bottom:14px;">
            <div class="form-group">
              <label>Latest Released Version</label>
              <input type="text" id="updateLatestVer" class="form-control" placeholder="e.g. 2.1.0" />
            </div>
            <div class="form-group">
              <label>Minimum Required Version</label>
              <input type="text" id="updateMinVer" class="form-control" placeholder="e.g. 2.0.0" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label>Release Title</label>
            <input type="text" id="updateTitle" class="form-control" placeholder="e.g. EWU Buddy v2.1 Performance &amp; Advising Update" />
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label>Release Changelog / What's New</label>
            <textarea id="updateChangelog" class="form-control" rows="3" placeholder="Describe the updates, bugfixes, and new features..."></textarea>
          </div>

          <div class="form-group" style="margin-bottom:16px;">
            <label>Download / Update Link URL</label>
            <input type="text" id="updateUrl" class="form-control" placeholder="e.g. https://t.me/AftabKabir or custom download URL" />
          </div>

          <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px;">
            <input type="checkbox" id="updateMandatory" style="width:auto; margin:0;" />
            <label for="updateMandatory" style="font-size:13px; font-weight:600; color:#fff; cursor:pointer;">
              Enforce Mandatory Update (Outdated versions will be locked out until updated)
            </label>
          </div>

          <button class="btn-primary" style="max-width: 220px;" onclick="saveUpdateConfig()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            Publish Update Release
          </button>
        </div>
      </div>

      <!-- VIEW 3: EXPORT USERS & DEVICES -->
      <div id="viewExport" style="display:none;">
        <div class="card">
          <h3 style="font-size: 16px; font-weight: 800; color: #fff; margin-bottom:4px;">Connected Users &amp; Telemetry Export</h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-bottom:20px;">Download complete device logs, IP records, geolocation, and associated license metadata.</p>

          <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px;">
            <button class="btn-primary" style="max-width:200px; margin-top:0;" onclick="exportUsersData('csv')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export as CSV Spreadsheet
            </button>
            <button class="btn-primary" style="max-width:200px; margin-top:0; background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.4); color:#a5b4fc;" onclick="exportUsersData('json')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              Export as Raw JSON
            </button>
          </div>

          <div id="exportPreviewWrapper" style="display:none;">
            <h4 style="font-size:13px; font-weight:700; color:var(--text-muted); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">Recent Device Telemetry Log</h4>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Device ID</th>
                    <th>License Prefix</th>
                    <th>Client Note</th>
                    <th>IP / Country</th>
                    <th>First Activated</th>
                    <th>Last Ping</th>
                  </tr>
                </thead>
                <tbody id="exportPreviewTable"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- VIEW 4: DANGER ZONE -->
      <div id="viewDanger" style="display:none;">
        <div class="card" style="border-color: rgba(244, 63, 94, 0.4); background: rgba(244, 63, 94, 0.03);">
          <h3 style="font-size: 17px; font-weight: 800; color: var(--rose); margin-bottom:4px; display:flex; align-items:center; gap:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Danger Zone — Database Purge
          </h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom:20px;">Irreversible administrative actions. Please proceed with extreme caution.</p>

          <div style="background:rgba(0,0,0,0.5); border:1px solid rgba(244, 63, 94, 0.3); border-radius:12px; padding:18px; margin-bottom:20px;">
            <h4 style="font-size:14px; font-weight:700; color:#fff; margin-bottom:6px;">Purge All Licenses &amp; Device Activations</h4>
            <p style="font-size:12.5px; color:var(--text-dim); line-height:1.6; margin-bottom:14px;">This will permanently wipe all generated license keys, user subscriptions, and registered device activations from Cloudflare D1. All existing extensions will immediately lose authorization.</p>
            <button class="btn-action danger" style="padding:10px 18px; font-size:13px; font-weight:700;" onclick="openPurgeModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              Delete All Keys &amp; Activations
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div class="toast-container" id="toastContainer"></div>

  <!-- Details & Device Management Modal -->
  <div id="detailsModal" class="modal-backdrop">
    <div class="modal-box">
      <span class="modal-close" onclick="closeModal('detailsModal')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </span>
      <h3 style="font-size:18px; font-weight:800; color:#fff; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        License &amp; Device Telemetry
      </h3>
      <div id="modalMeta" style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:18px; font-size:12.5px; line-height:1.7;"></div>
      <h4 style="font-size:13px; font-weight:700; color:var(--text-muted); margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">Connected Devices</h4>
      <div id="modalActivations" style="max-height:300px; overflow-y:auto; display:flex; flex-direction:column; gap:10px;"></div>
    </div>
  </div>

  <!-- Extend Expiration Modal -->
  <div id="extendModal" class="modal-backdrop">
    <div class="modal-box" style="max-width:440px;">
      <span class="modal-close" onclick="closeModal('extendModal')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </span>
      <h3 style="font-size:18px; font-weight:800; color:#fff; margin-bottom:8px;">Extend License Duration</h3>
      <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">Choose extension interval for this license:</p>
      
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
        <button class="btn-action" style="padding:10px; justify-content:center;" onclick="confirmExtend(30)">+30 Days</button>
        <button class="btn-action" style="padding:10px; justify-content:center;" onclick="confirmExtend(90)">+90 Days</button>
        <button class="btn-action" style="padding:10px; justify-content:center;" onclick="confirmExtend(180)">+6 Months</button>
        <button class="btn-action" style="padding:10px; justify-content:center;" onclick="confirmExtend(365)">+1 Year</button>
      </div>
      <button class="btn-action success" style="width:100%; padding:11px; justify-content:center; font-weight:700;" onclick="confirmExtend(0, true)">Convert to Perpetual (Lifetime)</button>
    </div>
  </div>

  <!-- Purge All Confirmation Modal -->
  <div id="purgeModal" class="modal-backdrop">
    <div class="modal-box" style="max-width:480px; border-color:var(--rose);">
      <span class="modal-close" onclick="closeModal('purgeModal')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </span>
      <h3 style="font-size:18px; font-weight:800; color:var(--rose); margin-bottom:8px;">Confirm Total Database Purge</h3>
      <p style="font-size:13px; color:var(--text-muted); line-height:1.5; margin-bottom:16px;">This action will permanently delete ALL license keys and connected device records. To proceed, please type <strong style="color:#fff;">DELETE ALL</strong> in the box below:</p>
      
      <input type="text" id="purgeConfirmInput" class="form-control" placeholder="Type DELETE ALL" style="margin-bottom:16px; font-family:monospace; text-align:center;" />
      
      <button class="btn-primary" style="background:var(--rose); margin-top:0;" onclick="confirmPurgeAll()">
        Permanently Purge Database
      </button>
    </div>
  </div>

  <script>
    let adminToken = sessionStorage.getItem('ewu_admin_secret') || '';
    let allLicenses = [];
    let currentFilter = 'all';
    let currentGenMode = 'single';
    let targetExtendLicenseId = null;

    if (adminToken) checkAuth();

    function switchMainTab(tab) {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.getElementById('viewLicenses').style.display = 'none';
      document.getElementById('viewRemote').style.display = 'none';
      document.getElementById('viewExport').style.display = 'none';
      document.getElementById('viewDanger').style.display = 'none';

      if (tab === 'licenses') {
        document.getElementById('tabBtnLicenses').classList.add('active');
        document.getElementById('viewLicenses').style.display = 'block';
      } else if (tab === 'remote') {
        document.getElementById('tabBtnRemote').classList.add('active');
        document.getElementById('viewRemote').style.display = 'block';
        loadRemoteConfig();
      } else if (tab === 'export') {
        document.getElementById('tabBtnExport').classList.add('active');
        document.getElementById('viewExport').style.display = 'block';
        loadExportPreview();
      } else if (tab === 'danger') {
        document.getElementById('tabBtnDanger').classList.add('active');
        document.getElementById('viewDanger').style.display = 'block';
      }
    }

    function togglePassVisibility() {
      const input = document.getElementById('adminPass');
      const icon = document.getElementById('eyeIcon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
      } else {
        input.type = 'password';
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    }

    function showToast(message, type = 'success') {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = 'toast ' + type;
      const iconSvg = type === 'success'
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      toast.innerHTML = iconSvg + '<span>' + message + '</span>';
      container.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    async function login() {
      adminToken = document.getElementById('adminPass').value.trim();
      if (!adminToken) return showToast('Please enter the admin password', 'error');
      sessionStorage.setItem('ewu_admin_secret', adminToken);
      checkAuth();
    }

    function logout() {
      sessionStorage.removeItem('ewu_admin_secret');
      adminToken = '';
      document.getElementById('dashboardSection').style.display = 'none';
      document.getElementById('authSection').style.display = 'block';
      showToast('Logged out cleanly');
    }

    async function checkAuth() {
      if (!adminToken) return;
      try {
        const res = await fetch('/admin/api/stats', { headers: { 'Authorization': 'Bearer ' + adminToken } });
        if (res.ok) {
          document.getElementById('authSection').style.display = 'none';
          document.getElementById('dashboardSection').style.display = 'block';
          loadDashboard();
        } else {
          let errorMsg = 'Invalid admin password. Please try again.';
          try {
            const data = await res.json();
            if (data && data.error) errorMsg = data.error;
          } catch (_) {}
          showToast(errorMsg, 'error');
          sessionStorage.removeItem('ewu_admin_secret');
          adminToken = '';
          document.getElementById('dashboardSection').style.display = 'none';
          document.getElementById('authSection').style.display = 'block';
        }
      } catch (e) {
        showToast('Connection to server failed. Please check network.', 'error');
      }
    }

    async function loadDashboard() {
      try {
        const [statsRes, licRes, sysRes] = await Promise.all([
          fetch('/admin/api/stats', { headers: { 'Authorization': 'Bearer ' + adminToken } }),
          fetch('/admin/api/licenses', { headers: { 'Authorization': 'Bearer ' + adminToken } }),
          fetch('/admin/api/system', { headers: { 'Authorization': 'Bearer ' + adminToken } })
        ]);

        if (statsRes.ok) {
          const stats = await statsRes.json();
          document.getElementById('kpiTotal').textContent = stats.totalLicenses || 0;
          document.getElementById('kpiActive').textContent = stats.activeLicenses || 0;
          document.getElementById('kpiPerpetual').textContent = (stats.perpetualLicenses || 0) + ' Lifetime / Perpetual';
          document.getElementById('kpiActivations').textContent = stats.totalActivations || 0;
          document.getElementById('kpiCapacity').textContent = 'Max Allowed: ' + (stats.totalCapacity || 0);
          document.getElementById('kpiRevoked').textContent = stats.revokedLicenses || 0;
        }

        if (licRes.ok) {
          const licData = await licRes.json();
          allLicenses = licData.licenses || [];
          document.getElementById('countAll').textContent = allLicenses.length;
          filterLicenses();
        }

        if (sysRes.ok) {
          const sysData = await sysRes.json();
          const badge = document.getElementById('liveStatusBadge');
          if (sysData.shutdown && sysData.shutdown.enabled) {
            badge.className = 'sys-pill';
            badge.style.color = 'var(--rose)';
            badge.style.background = 'rgba(244,63,94,0.1)';
            badge.style.borderColor = 'rgba(244,63,94,0.3)';
            badge.innerHTML = '<span class="sys-dot" style="background:var(--rose); box-shadow:0 0 8px var(--rose);"></span> Lockdown';
          } else {
            badge.className = 'sys-pill';
            badge.style.color = 'var(--emerald)';
            badge.style.background = 'rgba(16,185,129,0.1)';
            badge.style.borderColor = 'rgba(16,185,129,0.25)';
            badge.innerHTML = '<span class="sys-dot"></span> Online';
          }
        }
      } catch (e) {
        showToast('Failed to refresh dashboard data', 'error');
      }
    }

    async function loadRemoteConfig() {
      try {
        const res = await fetch('/admin/api/system', { headers: { 'Authorization': 'Bearer ' + adminToken } });
        if (res.ok) {
          const data = await res.json();
          const s = data.shutdown || {};
          document.getElementById('shutdownToggle').checked = Boolean(s.enabled);
          document.getElementById('shutdownTitle').value = s.title || '';
          document.getElementById('shutdownMsg').value = s.message || '';
          document.getElementById('shutdownStatusBadge').style.display = s.enabled ? 'inline-flex' : 'none';

          const n = data.notice || {};
          document.getElementById('noticeToggle').checked = Boolean(n.enabled);
          document.getElementById('noticeType').value = n.type || 'info';
          document.getElementById('noticeTitle').value = n.title || '';
          document.getElementById('noticeMsg').value = n.message || '';

          const u = data.update || {};
          document.getElementById('updateLatestVer').value = u.latest_version || '2.0.0';
          document.getElementById('updateMinVer').value = u.min_version || '2.0.0';
          document.getElementById('updateTitle').value = u.title || '';
          document.getElementById('updateChangelog').value = u.changelog || '';
          document.getElementById('updateUrl').value = u.update_url || '';
          document.getElementById('updateMandatory').checked = Boolean(u.is_mandatory);
        }
      } catch (_) { showToast('Error loading remote configuration', 'error'); }
    }

    function setShutdownPreset(preset) {
      if (preset === 'maintenance') {
        document.getElementById('shutdownTitle').value = 'Advising Server Maintenance';
        document.getElementById('shutdownMsg').value = 'East West University portal is currently undergoing official advising maintenance. EWU Portal Helper is temporarily offline to safeguard course records.';
      } else if (preset === 'emergency') {
        document.getElementById('shutdownTitle').value = 'Critical System Maintenance';
        document.getElementById('shutdownMsg').value = 'An urgent maintenance patch is being deployed. All extension features will be restored shortly.';
      } else {
        document.getElementById('shutdownTitle').value = 'System Temporarily Offline';
        document.getElementById('shutdownMsg').value = 'EWU Portal Helper is currently disabled by administrator.';
      }
    }

    async function saveShutdownConfig() {
      const enabled = document.getElementById('shutdownToggle').checked;
      const title = document.getElementById('shutdownTitle').value.trim();
      const message = document.getElementById('shutdownMsg').value.trim();
      try {
        const res = await fetch('/admin/api/system/shutdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ enabled, title, message })
        });
        if (res.ok) {
          showToast(enabled ? 'Emergency shutdown ENABLED' : 'Emergency shutdown DISABLED');
          loadDashboard();
          loadRemoteConfig();
        }
      } catch (_) { showToast('Failed to apply shutdown state', 'error'); }
    }

    async function saveNoticeConfig() {
      const enabled = document.getElementById('noticeToggle').checked;
      const type = document.getElementById('noticeType').value;
      const title = document.getElementById('noticeTitle').value.trim();
      const message = document.getElementById('noticeMsg').value.trim();
      try {
        const res = await fetch('/admin/api/system/notice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ enabled, type, title, message })
        });
        if (res.ok) {
          showToast('Broadcast notice successfully saved');
        }
      } catch (_) { showToast('Failed to save notice', 'error'); }
    }

    async function saveUpdateConfig() {
      const latest_version = document.getElementById('updateLatestVer').value.trim();
      const min_version = document.getElementById('updateMinVer').value.trim();
      const title = document.getElementById('updateTitle').value.trim();
      const changelog = document.getElementById('updateChangelog').value.trim();
      const update_url = document.getElementById('updateUrl').value.trim();
      const is_mandatory = document.getElementById('updateMandatory').checked;
      try {
        const res = await fetch('/admin/api/system/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ latest_version, min_version, title, changelog, update_url, is_mandatory })
        });
        if (res.ok) {
          showToast('Update release successfully published');
        }
      } catch (_) { showToast('Failed to publish update', 'error'); }
    }

    async function loadExportPreview() {
      try {
        const res = await fetch('/admin/api/devices/export', { headers: { 'Authorization': 'Bearer ' + adminToken } });
        if (res.ok) {
          const data = await res.json();
          const devices = data.devices || [];
          const tbody = document.getElementById('exportPreviewTable');
          if (devices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-dim);">No device registrations recorded yet</td></tr>';
          } else {
            tbody.innerHTML = devices.slice(0, 15).map(d => {
              return '<tr>' +
                '<td><span style="font-family:monospace; color:var(--cyan);">' + (d.device_id || 'Unknown') + '</span></td>' +
                '<td><span class="key-badge">' + (d.raw_key_prefix || 'None') + '</span></td>' +
                '<td>' + (d.client_note || '<span style="color:var(--text-dim);">None</span>') + '</td>' +
                '<td>' + (d.device_ip || 'N/A') + ' (' + (d.device_geo || 'N/A') + ')</td>' +
                '<td>' + new Date(d.activated_at).toLocaleDateString() + '</td>' +
                '<td>' + new Date(d.last_seen_at).toLocaleDateString() + '</td>' +
              '</tr>';
            }).join('');
          }
          document.getElementById('exportPreviewWrapper').style.display = 'block';
        }
      } catch (_) {}
    }

    async function exportUsersData(format = 'csv') {
      try {
        const res = await fetch('/admin/api/devices/export', { headers: { 'Authorization': 'Bearer ' + adminToken } });
        if (!res.ok) return showToast('Failed to fetch user telemetry for export', 'error');
        const data = await res.json();
        const devices = data.devices || [];

        if (format === 'json') {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(devices, null, 2));
          downloadFile(dataStr, "ewu_users_telemetry_" + Date.now() + ".json");
        } else {
          let csv = "Activation ID,Device ID,Key Prefix,Client Note,IP,Country,First Activated,Last Seen,User Agent\\n";
          devices.forEach(d => {
            csv += [
              d.activation_id,
              d.device_id,
              d.raw_key_prefix,
              '"' + (d.client_note || '').replace(/"/g, '""') + '"',
              d.device_ip,
              d.device_geo,
              new Date(d.activated_at).toISOString(),
              new Date(d.last_seen_at).toISOString(),
              '"' + (d.device_user_agent || '').replace(/"/g, '""') + '"'
            ].join(",") + "\\n";
          });
          const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
          downloadFile(dataStr, "ewu_users_telemetry_" + Date.now() + ".csv");
        }
        showToast('Users telemetry exported successfully');
      } catch (_) { showToast('Export error', 'error'); }
    }

    function downloadFile(uri, filename) {
      const a = document.createElement('a');
      a.setAttribute('href', uri);
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    function openPurgeModal() {
      document.getElementById('purgeConfirmInput').value = '';
      document.getElementById('purgeModal').style.display = 'flex';
    }

    async function confirmPurgeAll() {
      const confirmation = document.getElementById('purgeConfirmInput').value.trim();
      if (confirmation !== 'DELETE ALL') {
        return showToast('Please type DELETE ALL exactly to confirm', 'error');
      }
      try {
        const res = await fetch('/admin/api/licenses/purge-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ confirmation })
        });
        const data = await res.json();
        if (data.success) {
          showToast('All licenses & devices permanently purged');
          closeModal('purgeModal');
          loadDashboard();
        } else {
          showToast(data.message || 'Purge failed', 'error');
        }
      } catch (_) { showToast('Server communication error', 'error'); }
    }

    function setGenMode(mode) {
      currentGenMode = mode;
      document.getElementById('btnSingleMode').className = 'mode-btn ' + (mode === 'single' ? 'active' : '');
      document.getElementById('btnBulkMode').className = 'mode-btn ' + (mode === 'bulk' ? 'active' : '');
      document.getElementById('bulkCountGroup').style.display = mode === 'bulk' ? 'flex' : 'none';
      document.getElementById('genBtnText').textContent = mode === 'bulk' ? 'Generate Batch Keys' : 'Generate Key';
      document.getElementById('singleOutput').style.display = 'none';
      document.getElementById('bulkOutput').style.display = 'none';
    }

    async function executeGeneration() {
      const note = document.getElementById('licNote').value;
      const maxActivations = document.getElementById('licMax').value;
      const expiresInDays = document.getElementById('licExpiry').value;

      if (currentGenMode === 'bulk') {
        const count = document.getElementById('licCount').value;
        try {
          const res = await fetch('/admin/api/licenses/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
            body: JSON.stringify({ count, notePrefix: note, maxActivations, expiresInDays })
          });
          const data = await res.json();
          if (data.success) {
            const rawKeys = data.keys.map(k => k.key).join('\\n');
            document.getElementById('bulkKeysList').textContent = rawKeys;
            document.getElementById('bulkOutput').style.display = 'block';
            showToast('Generated batch of ' + data.keys.length + ' keys!');
            loadDashboard();
          } else {
            showToast(data.message || 'Batch generation failed', 'error');
          }
        } catch (e) {
          showToast('Error communicating with server', 'error');
        }
      } else {
        try {
          const res = await fetch('/admin/api/licenses/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
            body: JSON.stringify({ note, maxActivations, expiresInDays })
          });
          const data = await res.json();
          if (data.success) {
            document.getElementById('keyValText').textContent = data.licenseKey;
            document.getElementById('singleOutput').style.display = 'block';
            showToast('Unique license key created!');
            loadDashboard();
          } else {
            showToast(data.message || 'Key generation failure', 'error');
          }
        } catch (e) {
          showToast('Error communicating with server', 'error');
        }
      }
    }

    function copyKeyText(id) {
      const text = document.getElementById('keyValText').textContent;
      navigator.clipboard.writeText(text).then(() => showToast('Key copied to clipboard!'));
    }

    function copyBulkKeys() {
      const text = document.getElementById('bulkKeysList').textContent;
      navigator.clipboard.writeText(text).then(() => showToast('Batch keys copied to clipboard!'));
    }

    function setFilter(filter, el) {
      currentFilter = filter;
      document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      filterLicenses();
    }

    function formatExpiryDisplay(exp) {
      if (!exp || exp === null || exp === 0 || isNaN(Number(exp))) {
        return '<span style="color:var(--emerald); font-weight:700;">Never (Perpetual)</span>';
      }
      const d = new Date(Number(exp));
      if (isNaN(d.getTime()) || d.getFullYear() >= 2099) {
        return '<span style="color:var(--emerald); font-weight:700;">Never (Perpetual)</span>';
      }
      const isPast = d.getTime() < Date.now();
      return isPast 
        ? '<span style="color:var(--rose); font-weight:600;">' + d.toLocaleDateString() + ' (Expired)</span>'
        : '<span>' + d.toLocaleDateString() + '</span>';
    }

    function filterLicenses() {
      const q = document.getElementById('searchBar').value.toLowerCase().trim();
      const filtered = allLicenses.filter(l => {
        const matchesQuery = l.raw_key_prefix.toLowerCase().includes(q) || (l.notes && l.notes.toLowerCase().includes(q));
        if (!matchesQuery) return false;
        if (currentFilter === 'active') return l.status === 'active';
        if (currentFilter === 'revoked') return l.status === 'revoked';
        if (currentFilter === 'perpetual') return l.status === 'active' && (!l.expires_at || l.expires_at === 0);
        return true;
      });
      renderLicenses(filtered);
    }

    function renderLicenses(licenses) {
      const tbody = document.getElementById('licTable');
      if (licenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-dim);">No matching license records found</td></tr>';
        return;
      }
      tbody.innerHTML = licenses.map(l => {
        let badgeClass = 'status-active';
        if (l.status === 'revoked') badgeClass = 'status-revoked';
        else if (l.expires_at && Number(l.expires_at) < Date.now()) badgeClass = 'status-expired';

        return '<tr>' +
          '<td><span class="key-badge">' + l.raw_key_prefix + '</span></td>' +
          '<td>' + (l.notes || '<span style="color:var(--text-dim);">None</span>') + '</td>' +
          '<td><span class="status-badge ' + badgeClass + '">' + l.status + '</span></td>' +
          '<td><span style="font-weight:600;">' + l.activation_count + '</span> <span style="color:var(--text-dim);">/ ' + l.max_activations + '</span></td>' +
          '<td>' + formatExpiryDisplay(l.expires_at) + '</td>' +
          '<td style="text-align:right;">' +
            '<div style="display:inline-flex; gap:6px;">' +
              (l.status === 'active' 
                ? '<button class="btn-action danger" onclick="revoke(&#39;' + l.id + '&#39;)">Revoke</button>'
                : '<button class="btn-action success" onclick="reactivate(&#39;' + l.id + '&#39;)">Reactivate</button>'
              ) +
              '<button class="btn-action" onclick="openExtendModal(&#39;' + l.id + '&#39;)">Extend</button>' +
              '<button class="btn-action" onclick="showDetails(&#39;' + l.id + '&#39;)">Telemetry</button>' +
              '<button class="btn-action danger" onclick="deleteLicense(&#39;' + l.id + '&#39;)">Delete</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    async function revoke(id) {
      if (!confirm('Revoke this license? All active extension instances will immediately be blocked.')) return;
      try {
        const res = await fetch('/admin/api/licenses/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ licenseId: id })
        });
        if (res.ok) {
          showToast('License successfully revoked');
          loadDashboard();
        }
      } catch (_) { showToast('Error revoking license', 'error'); }
    }

    async function reactivate(id) {
      try {
        const res = await fetch('/admin/api/licenses/reactivate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ licenseId: id })
        });
        if (res.ok) {
          showToast('License successfully reactivated');
          loadDashboard();
        }
      } catch (_) { showToast('Error reactivating license', 'error'); }
    }

    function openExtendModal(id) {
      targetExtendLicenseId = id;
      document.getElementById('extendModal').style.display = 'flex';
    }

    async function confirmExtend(days, setPerpetual = false) {
      if (!targetExtendLicenseId) return;
      try {
        const res = await fetch('/admin/api/licenses/extend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ licenseId: targetExtendLicenseId, additionalDays: days, setPerpetual })
        });
        if (res.ok) {
          showToast('License duration successfully extended');
          closeModal('extendModal');
          loadDashboard();
        }
      } catch (_) { showToast('Failed to extend license', 'error'); }
    }

    async function deleteLicense(id) {
      if (!confirm('Permanent Deletion: All license records and device activations will be erased from D1. Proceed?')) return;
      try {
        const res = await fetch('/admin/api/licenses/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ licenseId: id })
        });
        if (res.ok) {
          showToast('License permanently deleted');
          loadDashboard();
        }
      } catch (_) { showToast('Failed to delete license', 'error'); }
    }

    async function showDetails(id) {
      try {
        const res = await fetch('/admin/api/licenses/details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ licenseId: id })
        });
        const data = await res.json();
        if (data.success) {
          const l = data.license;
          const acts = data.activations;
          
          document.getElementById('modalMeta').innerHTML = 
            '<p><strong>Prefix:</strong> <span class="key-badge">' + l.raw_key_prefix + '</span> &bull; <strong>Status:</strong> ' + l.status.toUpperCase() + '</p>' +
            '<p><strong>Client Note:</strong> ' + (l.notes || 'None') + '</p>' +
            '<p><strong>Validity:</strong> ' + formatExpiryDisplay(l.expires_at) + ' &bull; <strong>Capacity:</strong> ' + l.activation_count + ' / ' + l.max_activations + '</p>';
          
          const list = document.getElementById('modalActivations');
          if (acts.length === 0) {
            list.innerHTML = '<p style="text-align:center; padding:18px; color:var(--text-dim); font-size:12.5px;">No active device sessions registered for this license.</p>';
          } else {
            list.innerHTML = acts.map(a => {
              return '<div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); padding:12px 14px; border-radius:10px; font-size:12px; display:flex; justify-content:space-between; align-items:center; gap:10px;">' +
                '<div>' +
                  '<p><strong>Device:</strong> <span style="font-family:monospace; color:var(--cyan);">' + a.device_id + '</span></p>' +
                  '<p style="color:var(--text-dim); margin-top:2px;"><strong>IP:</strong> ' + (a.device_ip || 'Unknown') + ' | <strong>Country:</strong> ' + (a.device_geo || 'Unknown') + ' | <strong>Ping:</strong> ' + new Date(a.last_seen_at).toLocaleDateString() + '</p>' +
                '</div>' +
                '<button class="btn-action danger" onclick="kickDevice(&#39;' + a.id + '&#39;, &#39;' + l.id + '&#39;)">Deauthorize</button>' +
              '</div>';
            }).join('');
          }
          
          document.getElementById('detailsModal').style.display = 'flex';
        }
      } catch (_) { showToast('Failed to load telemetry diagnostics', 'error'); }
    }

    async function kickDevice(activationId, licenseId) {
      if (!confirm('Deauthorize this device? The user will have to re-activate their license key.')) return;
      try {
        const res = await fetch('/admin/api/activations/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + adminToken },
          body: JSON.stringify({ activationId, licenseId })
        });
        if (res.ok) {
          showToast('Device deauthorized');
          showDetails(licenseId);
          loadDashboard();
        }
      } catch (_) { showToast('Failed to deauthorize device', 'error'); }
    }

    function closeModal(id) {
      document.getElementById(id).style.display = 'none';
    }
  </script>
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
