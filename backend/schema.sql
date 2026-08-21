-- Cloudflare D1 Database Schema for EWU Portal Helper

CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    license_key_hash TEXT UNIQUE NOT NULL,
    raw_key_prefix TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked', 'expired'
    created_at INTEGER NOT NULL,
    expires_at INTEGER DEFAULT NULL,      -- NULL = perpetual, or UNIX timestamp in ms
    max_activations INTEGER NOT NULL DEFAULT 1,
    activation_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS activations (
    id TEXT PRIMARY KEY,
    license_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    activated_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    revoked_at INTEGER DEFAULT NULL,
    device_user_agent TEXT DEFAULT NULL,
    device_ip TEXT DEFAULT NULL,
    device_geo TEXT DEFAULT NULL,
    FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rate_limits (
    ip_address TEXT PRIMARY KEY,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    last_attempt_at INTEGER NOT NULL,
    blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_licenses_hash ON licenses(license_key_hash);
CREATE INDEX IF NOT EXISTS idx_activations_license ON activations(license_id);
CREATE INDEX IF NOT EXISTS idx_activations_device ON activations(device_id);
