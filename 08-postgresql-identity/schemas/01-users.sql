-- Users table for identity management
-- Stores core user identity, credentials, and profile data

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending', 'archived');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   VARCHAR(255),  -- NULL for social/SSO-only users
    display_name    VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    avatar_url      TEXT,
    phone           VARCHAR(20),
    phone_verified  BOOLEAN DEFAULT FALSE,
    status          user_status NOT NULL DEFAULT 'pending',
    auth_provider   VARCHAR(50) NOT NULL DEFAULT 'local',  -- local, google, github, saml
    external_id     VARCHAR(255),  -- ID from external provider
    last_login_at   TIMESTAMP WITH TIME ZONE,
    last_login_ip   INET,
    failed_login_attempts INT DEFAULT 0,
    locked_until    TIMESTAMP WITH TIME ZONE,
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    mfa_secret      VARCHAR(255),  -- Encrypted TOTP secret
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_auth_provider ON users(auth_provider);
CREATE INDEX idx_users_external_id ON users(external_id);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
