# Lab 02: Row-Level Security for Multi-Tenancy

## Objective

Implement PostgreSQL Row-Level Security (RLS) to isolate data between tenants. After this lab, users from Organization A physically cannot query Organization B's data — enforced at the database level, not just the application.

## Prerequisites

- Completed Lab 01 (identity database with users, roles, sessions tables)
- Connected to the `identity_lab` database
- Understanding of basic SQL (JOIN, WHERE)

## Estimated Time

45–60 minutes

---

## Part 1: Understanding Multi-Tenancy

### What Is Multi-Tenancy?

Multi-tenancy means multiple customers (tenants/organizations) share the same database. There are three approaches:

| Approach | How | Isolation | Cost |
|---|---|---|---|
| Separate databases | One database per tenant | Strongest | Most expensive |
| Separate schemas | One schema per tenant in same DB | Strong | Medium |
| **Shared tables + RLS** | All tenants in same tables, filtered by policy | Good | Cheapest |

We'll implement the third approach — it's what most SaaS applications use.

### Why RLS?

Without RLS, a bug in your app code (forgetting a WHERE clause) could leak data between tenants. RLS moves the filter to the **database level**, so even if the app has a bug, the database won't return wrong data.

---

## Part 2: Add Tenant Support to the Schema

### Step 1: Create the organizations table

```sql
\c identity_lab
SET search_path TO identity, public;

CREATE TABLE identity.organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(50) UNIQUE NOT NULL,  -- URL-friendly identifier
    plan        VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert test organizations
INSERT INTO identity.organizations (name, slug, plan) VALUES
    ('Acme Corp',    'acme',    'enterprise'),
    ('Startup Inc',  'startup', 'pro'),
    ('Solo Dev LLC', 'solodev', 'free');
```

### Step 2: Add organization_id to users

```sql
-- Add the tenant column
ALTER TABLE identity.users
ADD COLUMN organization_id UUID REFERENCES identity.organizations(id);

-- Assign existing users to organizations
UPDATE identity.users SET organization_id = (
    SELECT id FROM identity.organizations WHERE slug = 'acme'
) WHERE email IN ('alice@example.com', 'bob@example.com');

UPDATE identity.users SET organization_id = (
    SELECT id FROM identity.organizations WHERE slug = 'startup'
) WHERE email IN ('carol@example.com');

UPDATE identity.users SET organization_id = (
    SELECT id FROM identity.organizations WHERE slug = 'solodev'
) WHERE email IN ('dave@example.com');

-- Add index for fast tenant lookups
CREATE INDEX idx_users_org ON identity.users(organization_id);

-- Verify
SELECT u.email, o.name AS organization
FROM identity.users u
JOIN identity.organizations o ON u.organization_id = o.id;
```

---

## Part 3: Enable Row-Level Security

### Step 3: Enable RLS on the users table

```sql
-- Enable RLS on the table
ALTER TABLE identity.users ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: By default, table owners bypass RLS.
-- Force the owner to also follow RLS policies:
ALTER TABLE identity.users FORCE ROW LEVEL SECURITY;
```

> **What just happened?** With RLS enabled but no policies, ALL queries return zero rows (default deny). We need to create policies that define who can see what.

### Step 4: Create the tenant context mechanism

PostgreSQL doesn't know which tenant the current user belongs to. We need a way to tell it. We'll use a session variable:

```sql
-- This function reads the current tenant ID from a session variable
CREATE OR REPLACE FUNCTION identity.current_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
```

> **How this works in practice:** Your API server sets `app.current_tenant_id` at the start of every database connection/transaction. The RLS policies call this function to filter rows.

### Step 5: Create RLS policies

```sql
-- Policy: Users can only see users in their own organization
CREATE POLICY tenant_isolation ON identity.users
    USING (organization_id = identity.current_tenant_id());

-- Policy: Users can only insert into their own organization
CREATE POLICY tenant_insert ON identity.users
    FOR INSERT
    WITH CHECK (organization_id = identity.current_tenant_id());

-- Policy: Users can only update users in their own organization
CREATE POLICY tenant_update ON identity.users
    FOR UPDATE
    USING (organization_id = identity.current_tenant_id())
    WITH CHECK (organization_id = identity.current_tenant_id());
```

**Understanding policy clauses:**
- `USING` — filters which rows you can **see** (SELECT) and **affect** (UPDATE/DELETE)
- `WITH CHECK` — validates which rows you can **insert** or **update to**

---

## Part 4: Test RLS in Action

### Step 6: Create a test role (simulating your app's DB user)

```sql
-- Create a role that your API would use (not a superuser!)
CREATE ROLE app_user LOGIN PASSWORD 'testpass';

-- Grant it access to the schema and tables
GRANT USAGE ON SCHEMA identity TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA identity TO app_user;
```

### Step 7: Test as Acme Corp

Open a new connection as `app_user`:

```bash
psql -U app_user -d identity_lab
```

```sql
SET search_path TO identity, public;

-- Set the tenant context to Acme Corp
SELECT set_config('app.current_tenant_id',
    (SELECT id::text FROM identity.organizations WHERE slug = 'acme'),
    FALSE
);

-- Now query users — you should ONLY see Acme users
SELECT email, display_name FROM identity.users;
-- Should show: alice@example.com, bob@example.com
-- Should NOT show: carol, dave
```

### Step 8: Test as Startup Inc

```sql
-- Switch to Startup Inc
SELECT set_config('app.current_tenant_id',
    (SELECT id::text FROM identity.organizations WHERE slug = 'startup'),
    FALSE
);

-- Query users again
SELECT email, display_name FROM identity.users;
-- Should show ONLY: carol@example.com
```

### Step 9: Test cross-tenant data leak prevention

```sql
-- While set to Startup, try to query an Acme user directly
SELECT * FROM identity.users WHERE email = 'alice@example.com';
-- Returns ZERO rows! RLS blocks it even though the WHERE clause matches.

-- Try to update an Acme user
UPDATE identity.users SET display_name = 'HACKED' WHERE email = 'alice@example.com';
-- UPDATE 0 — no rows affected because RLS filtered them out
```

### Step 10: Test without tenant context

```sql
-- Clear the tenant context
SELECT set_config('app.current_tenant_id', '', FALSE);

-- Try to query
SELECT * FROM identity.users;
-- Returns ZERO rows — no tenant = no data (secure by default)
```

---

## Part 5: Apply RLS to Other Tables

### Step 11: Add RLS to audit_log

```sql
-- Add organization_id to audit_log
ALTER TABLE identity.audit_log
ADD COLUMN organization_id UUID REFERENCES identity.organizations(id);

-- Enable RLS
ALTER TABLE identity.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.audit_log FORCE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON identity.audit_log
    USING (organization_id = identity.current_tenant_id());

-- Grant to app_user
GRANT SELECT, INSERT ON identity.audit_log TO app_user;
```

---

## Part 6: How Your API Uses RLS

### Step 12: Understand the API integration pattern

Here's how a typical API request works with RLS:

```
1. Request arrives: GET /api/users
                    Authorization: Bearer <jwt>

2. API validates the JWT and extracts:
   - user_id: "abc-123"
   - organization_id: "org-456"    ← from a custom claim

3. API gets a DB connection and sets the tenant:
   SET app.current_tenant_id = 'org-456';

4. API runs the query:
   SELECT * FROM users;        ← no WHERE clause needed!

5. PostgreSQL RLS automatically filters:
   SELECT * FROM users WHERE organization_id = 'org-456';

6. Only that organization's users are returned
```

Example in Node.js (Express):

```javascript
app.get("/api/users", auth, async (req, res) => {
  const orgId = req.auth.payload["https://app.example.com/org_id"];

  // Set tenant context for this connection
  await db.query("SELECT set_config('app.current_tenant_id', $1, TRUE)", [orgId]);

  // RLS automatically filters — no WHERE clause needed!
  const result = await db.query("SELECT email, display_name FROM identity.users");
  res.json(result.rows);
});
```

---

## Validation Checklist

- [ ] Organizations table created with test data
- [ ] `organization_id` added to users table
- [ ] RLS enabled on users table
- [ ] `current_tenant_id()` function created
- [ ] RLS policies created for SELECT, INSERT, UPDATE
- [ ] `app_user` role created (non-superuser)
- [ ] Acme context only shows Acme users
- [ ] Startup context only shows Startup users
- [ ] Cross-tenant queries return zero rows
- [ ] Empty tenant context returns zero rows

---

## Troubleshooting

| Problem | Solution |
|---|---|
| All queries return zero rows | Either RLS is on with no policies, or tenant context not set |
| Superuser sees all rows | Superusers bypass RLS. Use `app_user` role for testing |
| `FORCE ROW LEVEL SECURITY` not working | Only applies to table owner. Confirm with `\d identity.users` |
| Can't set `app.current_tenant_id` | The setting is created on first use. Use `set_config()` not `SET` |

---

**Next Lab**: [Lab 03: Audit Logging with Triggers →](./lab-03-audit-logging.md)
