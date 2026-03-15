# Lab 03: Automatic Audit Logging with Triggers

## Objective

Build an automatic audit logging system using PostgreSQL triggers. Every change to user accounts, role assignments, and sessions will be automatically recorded — without changing any application code. This is critical for compliance (SOC 2, GDPR, HIPAA).

## Prerequisites

- Completed Lab 01 and Lab 02 (identity database with users, roles, RLS)
- Connected to the `identity_lab` database

## Estimated Time

40–50 minutes

---

## Part 1: Why Automatic Audit Logging?

### The Problem with Application-Level Logging

If you log changes in your application code:
- Developers can forget to add logging to new features
- Direct database changes (migrations, admin queries) aren't logged
- Different parts of the codebase may log inconsistently

### The Solution: Database Triggers

Triggers fire automatically on INSERT, UPDATE, DELETE — no matter how the change was made (application, migration script, admin console). Nothing escapes the audit log.

---

## Part 2: Create the Audit Infrastructure

### Step 1: Enhance the audit_log table

```sql
\c identity_lab
SET search_path TO identity, public;

-- Drop the old audit_log if it exists and recreate with more detail
DROP TABLE IF EXISTS identity.audit_log CASCADE;

CREATE TABLE identity.audit_log (
    id              BIGSERIAL PRIMARY KEY,
    -- What happened
    table_name      VARCHAR(100) NOT NULL,
    operation       VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    -- Who did it
    user_id         UUID,
    organization_id UUID,
    db_user         VARCHAR(100) DEFAULT current_user,
    -- What changed
    record_id       TEXT,                          -- Primary key of affected row
    old_data        JSONB,                         -- Previous values (UPDATE/DELETE)
    new_data        JSONB,                         -- New values (INSERT/UPDATE)
    changed_fields  TEXT[],                        -- List of changed column names
    -- Context
    ip_address      INET,
    user_agent      TEXT,
    -- When
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_audit_table ON identity.audit_log(table_name, created_at DESC);
CREATE INDEX idx_audit_user ON identity.audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_record ON identity.audit_log(table_name, record_id);
CREATE INDEX idx_audit_time ON identity.audit_log(created_at DESC);

-- Partition by month for performance (optional, for production)
COMMENT ON TABLE identity.audit_log IS 'Immutable audit trail of all data changes';
```

### Step 2: Create the audit trigger function

This is the heart of the system — a generic function that works on any table:

```sql
CREATE OR REPLACE FUNCTION identity.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    old_json    JSONB;
    new_json    JSONB;
    record_id   TEXT;
    changes     TEXT[] := '{}';
    col         TEXT;
    v_user_id   UUID;
    v_org_id    UUID;
BEGIN
    -- Get the record ID (assumes primary key is 'id')
    IF TG_OP = 'DELETE' THEN
        record_id := OLD.id::TEXT;
        old_json := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        record_id := NEW.id::TEXT;
        new_json := to_jsonb(NEW);
    ELSE  -- UPDATE
        record_id := NEW.id::TEXT;
        old_json := to_jsonb(OLD);
        new_json := to_jsonb(NEW);

        -- Find which fields actually changed
        FOR col IN SELECT key FROM jsonb_each(new_json)
        LOOP
            IF old_json->col IS DISTINCT FROM new_json->col THEN
                changes := array_append(changes, col);
            END IF;
        END LOOP;

        -- Skip audit if nothing actually changed
        IF array_length(changes, 1) IS NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Try to get the current user context (set by the application)
    BEGIN
        v_user_id := NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    BEGIN
        v_org_id := NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_org_id := NULL;
    END;

    -- Strip sensitive fields from the audit log
    -- NEVER log passwords, tokens, or secrets
    old_json := old_json - ARRAY['password_hash', 'token_hash', 'secret'];
    new_json := new_json - ARRAY['password_hash', 'token_hash', 'secret'];

    -- Insert the audit record
    INSERT INTO identity.audit_log (
        table_name, operation, user_id, organization_id,
        record_id, old_data, new_data, changed_fields
    ) VALUES (
        TG_TABLE_NAME, TG_OP, v_user_id, v_org_id,
        record_id, old_json, new_json, changes
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Key design decisions explained:**
- `SECURITY DEFINER` — runs with the function owner's permissions so `app_user` can insert into audit_log
- Strips `password_hash`, `token_hash` — never log secrets
- Tracks `changed_fields` — easy to see what was modified without diff-ing JSON
- Skips no-op updates — avoids noise in the audit log

### Step 3: Attach triggers to tables

```sql
-- Audit all changes to the users table
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON identity.users
    FOR EACH ROW EXECUTE FUNCTION identity.audit_trigger_function();

-- Audit all changes to user_roles
CREATE TRIGGER audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON identity.user_roles
    FOR EACH ROW EXECUTE FUNCTION identity.audit_trigger_function();

-- Audit all changes to roles
CREATE TRIGGER audit_roles
    AFTER INSERT OR UPDATE OR DELETE ON identity.roles
    FOR EACH ROW EXECUTE FUNCTION identity.audit_trigger_function();
```

---

## Part 3: Test the Audit System

### Step 4: Make some changes and watch the audit log

```sql
-- Clear previous audit entries
TRUNCATE identity.audit_log;

-- 1. Update a user's name
UPDATE identity.users SET display_name = 'Alice J.' WHERE email = 'alice@example.com';

-- 2. Suspend a user
UPDATE identity.users SET status = 'suspended' WHERE email = 'bob@example.com';

-- 3. Verify what got logged
SELECT
    id,
    table_name,
    operation,
    record_id,
    changed_fields,
    old_data->>'display_name' AS old_name,
    new_data->>'display_name' AS new_name,
    created_at
FROM identity.audit_log
ORDER BY id DESC
LIMIT 5;
```

You should see two entries — one for Alice's name change, one for Bob's status change.

### Step 5: Verify password is stripped from the log

```sql
-- Update a password (this simulates a password change)
UPDATE identity.users
SET password_hash = '$2b$12$NEWHASHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
WHERE email = 'alice@example.com';

-- Check the audit log
SELECT
    operation,
    changed_fields,
    new_data ? 'password_hash' AS has_password_in_new,
    old_data ? 'password_hash' AS has_password_in_old
FROM identity.audit_log
WHERE record_id = (SELECT id::text FROM identity.users WHERE email = 'alice@example.com')
ORDER BY id DESC
LIMIT 1;
-- has_password_in_new and has_password_in_old should both be FALSE
```

### Step 6: Test role assignment auditing

```sql
-- Assign a new role
INSERT INTO identity.user_roles (user_id, role_id)
SELECT u.id, r.id FROM identity.users u, identity.roles r
WHERE u.email = 'carol@example.com' AND r.name = 'viewer';

-- Check the audit log
SELECT table_name, operation, new_data
FROM identity.audit_log
WHERE table_name = 'user_roles'
ORDER BY id DESC LIMIT 1;
```

---

## Part 4: Useful Audit Queries

### Step 7: Build reporting queries

```sql
-- 1. All changes to a specific user
SELECT operation, changed_fields, created_at
FROM identity.audit_log
WHERE record_id = (SELECT id::text FROM identity.users WHERE email = 'alice@example.com')
ORDER BY created_at DESC;

-- 2. All status changes (account suspensions, activations, etc.)
SELECT
    al.created_at,
    al.old_data->>'email' AS user_email,
    al.old_data->>'status' AS old_status,
    al.new_data->>'status' AS new_status
FROM identity.audit_log al
WHERE al.table_name = 'users'
  AND 'status' = ANY(al.changed_fields)
ORDER BY al.created_at DESC;

-- 3. Activity summary by day
SELECT
    DATE(created_at) AS day,
    table_name,
    operation,
    COUNT(*) AS changes
FROM identity.audit_log
GROUP BY DATE(created_at), table_name, operation
ORDER BY day DESC, table_name;

-- 4. Recent role changes (who got what role, when)
SELECT
    al.created_at,
    al.operation,
    u.email AS user_email,
    r.name AS role_name
FROM identity.audit_log al
LEFT JOIN identity.users u ON (al.new_data->>'user_id')::UUID = u.id
LEFT JOIN identity.roles r ON (al.new_data->>'role_id')::INT = r.id
WHERE al.table_name = 'user_roles'
ORDER BY al.created_at DESC;
```

---

## Validation Checklist

- [ ] Enhanced audit_log table with old_data, new_data, changed_fields
- [ ] Generic audit trigger function created
- [ ] Triggers attached to users, user_roles, and roles tables
- [ ] User updates generate audit entries with correct changed_fields
- [ ] Password hash is stripped from audit entries
- [ ] Role assignments are logged
- [ ] No-op updates (no actual changes) are skipped
- [ ] Audit queries return meaningful results

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Trigger not firing | Check with `SELECT tgname FROM pg_trigger WHERE tgrelid = 'identity.users'::regclass;` |
| `SECURITY DEFINER` error | Create the function as the table owner (postgres), not app_user |
| `changed_fields` is always empty | Verify the column comparison logic handles NULL values with `IS DISTINCT FROM` |
| Audit log growing too large | Consider partitioning by month or archiving old entries |

---

## What You Built

An automatic audit system that:
- Logs every change to identity-related tables
- Tracks who made changes and what changed
- Strips sensitive fields (passwords, tokens)
- Requires zero application code changes
- Works even for direct SQL updates and migrations

This is exactly what auditors look for in SOC 2 and HIPAA compliance reviews.

---

**Next Module**: [Module 09: AWS IAM →](../../09-aws-iam/README.md)
