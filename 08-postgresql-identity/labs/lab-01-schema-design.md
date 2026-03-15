# Lab 01: Identity Database Schema Design

## Objective

Design and build a complete identity database from scratch in PostgreSQL. You'll create tables for users, credentials, sessions, and audit logs — the foundation every identity system needs. By the end, you'll have a working database you can query.

## Prerequisites

- **PostgreSQL 14+** installed — check with `psql --version`
  - **macOS**: `brew install postgresql@16 && brew services start postgresql@16`
  - **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
  - **Linux**: `sudo apt install postgresql` or `sudo yum install postgresql-server`
  - **Docker** (alternative): `docker run --name pg-identity -e POSTGRES_PASSWORD=labpass -p 5432:5432 -d postgres:16`
- **psql** command-line tool (comes with PostgreSQL)
- Basic SQL knowledge (SELECT, INSERT, CREATE TABLE)

## Estimated Time

60–90 minutes

---

## Part 1: Set Up Your Database

### Step 1: Connect to PostgreSQL

```bash
# If using local PostgreSQL:
psql -U postgres

# If using Docker:
docker exec -it pg-identity psql -U postgres
```

### Step 2: Create a fresh database for this lab

```sql
-- Create the database
CREATE DATABASE identity_lab;

-- Connect to it
\c identity_lab

-- Verify you're connected
SELECT current_database();
-- Should show: identity_lab
```

### Step 3: Create a schema for identity tables

```sql
-- Schemas are like namespaces — they keep tables organized
CREATE SCHEMA identity;

-- Set the search path so we don't have to prefix every table
SET search_path TO identity, public;
```

> **Why a separate schema?** In production, you might have `identity.users`, `billing.subscriptions`, `content.posts` etc. Schemas keep things organized and allow independent permissions.

---

## Part 2: Users Table

### Step 4: Create the users table

This is the core table. Every person who interacts with your system gets a row here.

```sql
-- Enable UUID generation (built into PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE identity.users (
    -- Primary key: UUID instead of sequential integer
    -- Why? UUIDs don't reveal how many users you have and are safe to expose in URLs
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Login credentials
    email           VARCHAR(255) NOT NULL,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash   VARCHAR(255),    -- NULL if using social login only

    -- Profile information
    display_name    VARCHAR(100),
    first_name      VARCHAR(50),
    last_name       VARCHAR(50),
    avatar_url      TEXT,
    phone           VARCHAR(20),
    phone_verified  BOOLEAN NOT NULL DEFAULT FALSE,

    -- Account status
    -- 'pending' = just signed up, awaiting verification
    -- 'active' = normal account
    -- 'suspended' = temporarily disabled (e.g., suspicious activity)
    -- 'deactivated' = user requested account deletion
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'suspended', 'deactivated')),

    -- Security fields
    failed_login_attempts   INT NOT NULL DEFAULT 0,
    locked_until            TIMESTAMP WITH TIME ZONE,
    last_login_at           TIMESTAMP WITH TIME ZONE,
    last_login_ip           INET,          -- PostgreSQL's IP address type
    password_changed_at     TIMESTAMP WITH TIME ZONE,

    -- Metadata
    metadata        JSONB DEFAULT '{}',    -- Flexible key-value storage
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for common queries
CREATE INDEX idx_users_email ON identity.users (email);
CREATE INDEX idx_users_status ON identity.users (status);
CREATE INDEX idx_users_created ON identity.users (created_at DESC);

COMMENT ON TABLE identity.users IS 'Core user accounts table';
COMMENT ON COLUMN identity.users.metadata IS 'Flexible JSONB for app-specific data like preferences, plan, etc.';
```

**Let's understand each design decision:**

| Decision | Why |
|---|---|
| UUID primary key | Doesn't leak user count, safe in URLs, works across distributed systems |
| `email_verified` field | You must track this separately — many attacks use unverified emails |
| `password_hash` is nullable | Social-login-only users don't have a password |
| `status` with CHECK | Enforces a state machine at the database level |
| `INET` for IP | PostgreSQL native type — supports IPv4 and IPv6, allows range queries |
| `JSONB` for metadata | Flexible storage without schema changes for app-specific data |
| `~*` regex in CHECK | PostgreSQL regex operator for email format validation |

### Step 5: Create an auto-update trigger for `updated_at`

```sql
-- This function updates the updated_at column automatically
CREATE OR REPLACE FUNCTION identity.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply it to the users table
CREATE TRIGGER users_update_timestamp
    BEFORE UPDATE ON identity.users
    FOR EACH ROW
    EXECUTE FUNCTION identity.update_timestamp();
```

> **Why a trigger?** Without this, every UPDATE query would need to include `SET updated_at = NOW()`. The trigger handles it automatically — you can't forget.

### Step 6: Insert test users

```sql
INSERT INTO identity.users (email, email_verified, password_hash, display_name, first_name, last_name, status)
VALUES
    ('alice@example.com', TRUE, '$2b$12$LJ3m4ys3uz4xIHRqpkL3HOx.IdFVxfGPQ1YMNhMdTBhRfJY3w0cTi', 'Alice Johnson', 'Alice', 'Johnson', 'active'),
    ('bob@example.com', TRUE, '$2b$12$LJ3m4ys3uz4xIHRqpkL3HOx.IdFVxfGPQ1YMNhMdTBhRfJY3w0cTi', 'Bob Smith', 'Bob', 'Smith', 'active'),
    ('carol@example.com', FALSE, NULL, 'Carol Williams', 'Carol', 'Williams', 'pending'),
    ('dave@example.com', TRUE, '$2b$12$LJ3m4ys3uz4xIHRqpkL3HOx.IdFVxfGPQ1YMNhMdTBhRfJY3w0cTi', 'Dave Brown', 'Dave', 'Brown', 'suspended');

-- Verify
SELECT id, email, status, email_verified, created_at FROM identity.users;
```

---

## Part 3: Roles and Permissions (RBAC)

### Step 7: Create the RBAC tables

```sql
-- Permissions represent individual actions
CREATE TABLE identity.permissions (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'users:read'
    description TEXT,
    resource    VARCHAR(50) NOT NULL,           -- e.g., 'users'
    action      VARCHAR(50) NOT NULL,           -- e.g., 'read'
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource, action)
);

-- Roles group permissions together
CREATE TABLE identity.roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,    -- e.g., 'admin'
    description TEXT,
    is_system   BOOLEAN DEFAULT FALSE,          -- Can't be deleted if system role
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Many-to-many: which permissions belong to which roles
CREATE TABLE identity.role_permissions (
    role_id       INT REFERENCES identity.roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES identity.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Many-to-many: which roles are assigned to which users
CREATE TABLE identity.user_roles (
    user_id     UUID REFERENCES identity.users(id) ON DELETE CASCADE,
    role_id     INT REFERENCES identity.roles(id) ON DELETE CASCADE,
    granted_by  UUID REFERENCES identity.users(id),
    granted_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at  TIMESTAMP WITH TIME ZONE,  -- NULL = permanent
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON identity.user_roles(user_id);
```

### Step 8: Seed permissions and roles

```sql
-- Insert permissions
INSERT INTO identity.permissions (name, resource, action, description) VALUES
    ('users:read',    'users',    'read',    'View user profiles'),
    ('users:write',   'users',    'write',   'Create and update users'),
    ('users:delete',  'users',    'delete',  'Delete user accounts'),
    ('roles:manage',  'roles',    'manage',  'Create and assign roles'),
    ('reports:read',  'reports',  'read',    'View reports'),
    ('settings:write','settings', 'write',   'Modify system settings');

-- Insert roles
INSERT INTO identity.roles (name, description, is_system) VALUES
    ('admin',  'Full system access',           TRUE),
    ('editor', 'Can read and write content',   FALSE),
    ('viewer', 'Read-only access',             FALSE);

-- Assign permissions to roles
-- Admin gets everything
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM identity.roles r, identity.permissions p
WHERE r.name = 'admin';

-- Editor gets read + write
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM identity.roles r, identity.permissions p
WHERE r.name = 'editor' AND p.name IN ('users:read', 'users:write', 'reports:read');

-- Viewer gets read only
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM identity.roles r, identity.permissions p
WHERE r.name = 'viewer' AND p.name IN ('users:read', 'reports:read');

-- Assign roles to users
INSERT INTO identity.user_roles (user_id, role_id)
SELECT u.id, r.id FROM identity.users u, identity.roles r
WHERE u.email = 'alice@example.com' AND r.name = 'admin';

INSERT INTO identity.user_roles (user_id, role_id)
SELECT u.id, r.id FROM identity.users u, identity.roles r
WHERE u.email = 'bob@example.com' AND r.name = 'editor';
```

### Step 9: Write a permission check query

```sql
-- Check if a user has a specific permission
-- This is the query your API would run on every request
SELECT EXISTS (
    SELECT 1
    FROM identity.user_roles ur
    JOIN identity.role_permissions rp ON ur.role_id = rp.role_id
    JOIN identity.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = (SELECT id FROM identity.users WHERE email = 'alice@example.com')
      AND p.name = 'users:delete'
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
) AS has_permission;
-- Should return TRUE (alice is admin)

-- Try with bob (editor):
SELECT EXISTS (
    SELECT 1
    FROM identity.user_roles ur
    JOIN identity.role_permissions rp ON ur.role_id = rp.role_id
    JOIN identity.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = (SELECT id FROM identity.users WHERE email = 'bob@example.com')
      AND p.name = 'users:delete'
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
) AS has_permission;
-- Should return FALSE (editor can't delete)
```

---

## Part 4: Sessions Table

### Step 10: Create a sessions table

```sql
CREATE TABLE identity.sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 of the session token
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_revoked      BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_sessions_user ON identity.sessions(user_id);
CREATE INDEX idx_sessions_token ON identity.sessions(token_hash);
CREATE INDEX idx_sessions_expires ON identity.sessions(expires_at);

COMMENT ON COLUMN identity.sessions.token_hash IS 'Store hash of token, never the raw token itself';
```

> **Security note:** Never store raw session tokens in the database. Store a hash. That way, even if the database is breached, attackers can't use the tokens.

---

## Part 5: Audit Log Table

### Step 11: Create an audit log

```sql
CREATE TABLE identity.audit_log (
    id          BIGSERIAL PRIMARY KEY,       -- BIGSERIAL for high-volume tables
    user_id     UUID REFERENCES identity.users(id),
    action      VARCHAR(100) NOT NULL,        -- e.g., 'login', 'password_change'
    resource    VARCHAR(100),                 -- e.g., 'users', 'roles'
    resource_id VARCHAR(255),                 -- ID of the affected resource
    details     JSONB DEFAULT '{}',           -- What changed
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying by user and time
CREATE INDEX idx_audit_user ON identity.audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_action ON identity.audit_log(action);
CREATE INDEX idx_audit_time ON identity.audit_log(created_at DESC);
```

### Step 12: Insert some audit entries

```sql
INSERT INTO identity.audit_log (user_id, action, resource, resource_id, details, ip_address)
SELECT u.id, 'login', 'sessions', gen_random_uuid()::text,
       '{"method": "password", "success": true}'::jsonb,
       '192.168.1.100'::inet
FROM identity.users u WHERE u.email = 'alice@example.com';

INSERT INTO identity.audit_log (user_id, action, resource, resource_id, details, ip_address)
SELECT u.id, 'role_assigned', 'roles', 'admin',
       '{"assigned_by": "system", "reason": "initial setup"}'::jsonb,
       '10.0.0.1'::inet
FROM identity.users u WHERE u.email = 'alice@example.com';

-- Query the audit log
SELECT
    al.created_at,
    u.email,
    al.action,
    al.resource,
    al.details,
    al.ip_address
FROM identity.audit_log al
JOIN identity.users u ON al.user_id = u.id
ORDER BY al.created_at DESC;
```

---

## Part 6: Useful Queries

### Step 13: Practice common identity queries

```sql
-- 1. List all users with their roles
SELECT u.email, u.status, array_agg(r.name) AS roles
FROM identity.users u
LEFT JOIN identity.user_roles ur ON u.id = ur.user_id
LEFT JOIN identity.roles r ON ur.role_id = r.id
GROUP BY u.id, u.email, u.status
ORDER BY u.email;

-- 2. Find users who haven't verified their email
SELECT email, created_at, status
FROM identity.users
WHERE NOT email_verified
ORDER BY created_at;

-- 3. List all permissions for a specific user
SELECT p.name, p.description
FROM identity.permissions p
JOIN identity.role_permissions rp ON p.id = rp.permission_id
JOIN identity.user_roles ur ON rp.role_id = ur.role_id
JOIN identity.users u ON ur.user_id = u.id
WHERE u.email = 'alice@example.com'
ORDER BY p.name;

-- 4. Count users by status
SELECT status, COUNT(*) as count
FROM identity.users
GROUP BY status
ORDER BY count DESC;

-- 5. Find locked accounts
SELECT email, failed_login_attempts, locked_until
FROM identity.users
WHERE locked_until IS NOT NULL AND locked_until > NOW();
```

---

## Validation Checklist

- [ ] Database `identity_lab` created
- [ ] `identity` schema created
- [ ] Users table with UUID primary key, email validation, and status check
- [ ] Auto-updating `updated_at` trigger works
- [ ] RBAC tables: permissions, roles, role_permissions, user_roles
- [ ] Permission check query returns correct results for admin vs editor
- [ ] Sessions table stores hashed tokens with expiry
- [ ] Audit log captures actions with JSONB details
- [ ] All test queries run without errors

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `role "postgres" does not exist` | Create it: `createuser -s postgres` or use your system username |
| `permission denied to create extension` | Connect as superuser: `psql -U postgres` |
| `relation "identity.users" does not exist` | Run `SET search_path TO identity, public;` first |
| `duplicate key violates unique constraint` | Data already exists. Run `DELETE FROM identity.users;` to reset |

---

## What You Built

```
identity_lab database
└── identity schema
    ├── users           (core accounts with email, status, security fields)
    ├── permissions      (resource:action pairs)
    ├── roles           (named groups of permissions)
    ├── role_permissions (many-to-many linking)
    ├── user_roles      (role assignments with expiry)
    ├── sessions        (hashed tokens, IP tracking)
    └── audit_log       (who did what, when, from where)
```

This is the same pattern used by Auth0, Keycloak, and most identity providers internally.

---

**Next Lab**: [Lab 02: Row-Level Security for Multi-Tenancy →](./lab-02-rls-multi-tenant.md)
