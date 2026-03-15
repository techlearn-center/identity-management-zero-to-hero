-- V002: Add MFA-related tables

CREATE TABLE mfa_devices (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(20) NOT NULL,  -- totp, webauthn, sms
    name        VARCHAR(100),
    secret      TEXT,  -- Encrypted
    credential  JSONB,  -- WebAuthn credential data
    verified    BOOLEAN DEFAULT FALSE,
    last_used   TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE mfa_recovery_codes (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   VARCHAR(255) NOT NULL,
    used        BOOLEAN DEFAULT FALSE,
    used_at     TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mfa_devices_user ON mfa_devices(user_id);
