# Lab 01: Design an RBAC Model for a SaaS Application

## Objective

Design and implement a complete Role-Based Access Control (RBAC) model for a multi-tenant SaaS project management application, defining users, roles, permissions, and resource hierarchies.

---

## Prerequisites

- Understanding of RBAC concepts from Module 01 README
- A text editor or diagramming tool
- PostgreSQL installed (for Part 3)

---

## Scenario

You are the identity architect for **ProjectHub**, a SaaS project management tool with these features:
- Organizations (multi-tenant)
- Projects within organizations
- Tasks within projects
- Documents attached to tasks
- Team management
- Billing and subscription management

---

## Part 1: Identify Resources and Actions

### Step 1: List All Resources

Identify every resource in the application:

| Resource | Description |
|---|---|
| Organization | Top-level tenant |
| Project | A project within an org |
| Task | A task within a project |
| Document | File attached to a task |
| Team | Group of users |
| User | Individual user account |
| Billing | Subscription and payment |
| Settings | Organization settings |

### Step 2: Define Actions Per Resource

For each resource, define the CRUD+ actions:

```
Organization:  create, read, update, delete, manage_members
Project:       create, read, update, delete, archive
Task:          create, read, update, delete, assign, close
Document:      create, read, update, delete, download
Team:          create, read, update, delete, add_member, remove_member
User:          read, update_profile, deactivate
Billing:       read, update, manage_subscription
Settings:      read, update
```

### Step 3: Create Permission Strings

Use the `resource:action` naming convention:

```
organization:create
organization:read
organization:update
organization:delete
organization:manage_members
project:create
project:read
project:update
project:delete
project:archive
task:create
task:read
task:update
task:delete
task:assign
task:close
document:create
document:read
document:update
document:delete
document:download
team:create
team:read
team:update
team:delete
team:add_member
team:remove_member
user:read
user:update_profile
user:deactivate
billing:read
billing:update
billing:manage_subscription
settings:read
settings:update
```

---

## Part 2: Define Roles

### Step 4: Create Role Hierarchy

Design roles from least to most privileged:

```
┌─────────────────────────────────────────┐
│              SUPER ADMIN                │  ← Full system control
├─────────────────────────────────────────┤
│              ORG OWNER                  │  ← Full org control
├─────────────────────────────────────────┤
│              ORG ADMIN                  │  ← Manage org (no billing)
├─────────────────────────────────────────┤
│           PROJECT MANAGER               │  ← Manage projects
├─────────────────────────────────────────┤
│              MEMBER                     │  ← Standard access
├─────────────────────────────────────────┤
│              VIEWER                     │  ← Read-only access
├─────────────────────────────────────────┤
│              GUEST                      │  ← Limited project access
└─────────────────────────────────────────┘
```

### Step 5: Map Permissions to Roles

Create a permission matrix:

| Permission | Guest | Viewer | Member | PM | Org Admin | Owner |
|---|---|---|---|---|---|---|
| project:read | ✅* | ✅ | ✅ | ✅ | ✅ | ✅ |
| project:create | | | | ✅ | ✅ | ✅ |
| project:update | | | | ✅ | ✅ | ✅ |
| project:delete | | | | | ✅ | ✅ |
| task:read | ✅* | ✅ | ✅ | ✅ | ✅ | ✅ |
| task:create | | | ✅ | ✅ | ✅ | ✅ |
| task:update | | | ✅ | ✅ | ✅ | ✅ |
| task:assign | | | | ✅ | ✅ | ✅ |
| task:delete | | | | ✅ | ✅ | ✅ |
| document:read | ✅* | ✅ | ✅ | ✅ | ✅ | ✅ |
| document:create | | | ✅ | ✅ | ✅ | ✅ |
| document:delete | | | | ✅ | ✅ | ✅ |
| team:read | | ✅ | ✅ | ✅ | ✅ | ✅ |
| team:manage | | | | ✅ | ✅ | ✅ |
| user:deactivate | | | | | ✅ | ✅ |
| org:manage_members | | | | | ✅ | ✅ |
| billing:read | | | | | | ✅ |
| billing:update | | | | | | ✅ |
| settings:update | | | | | ✅ | ✅ |

*Guest access is limited to assigned projects only*

---

## Part 3: Implement in SQL

### Step 6: Create the RBAC Schema

```sql
-- Create enum for role scope
CREATE TYPE role_scope AS ENUM ('system', 'organization', 'project');

-- Permissions table
CREATE TABLE permissions (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,  -- e.g., 'project:create'
    description TEXT,
    resource    VARCHAR(50) NOT NULL,           -- e.g., 'project'
    action      VARCHAR(50) NOT NULL,           -- e.g., 'create'
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(resource, action)
);

-- Roles table
CREATE TABLE roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,          -- e.g., 'org_admin'
    display_name VARCHAR(100) NOT NULL,         -- e.g., 'Organization Admin'
    description TEXT,
    scope       role_scope NOT NULL DEFAULT 'organization',
    is_default  BOOLEAN DEFAULT FALSE,          -- Auto-assign on join?
    created_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE(name)
);

-- Role-Permission mapping
CREATE TABLE role_permissions (
    role_id       INT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User-Role assignment (scoped to organization)
CREATE TABLE user_roles (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL,
    role_id         INT REFERENCES roles(id) ON DELETE CASCADE,
    organization_id UUID,                       -- NULL for system roles
    project_id      UUID,                       -- For project-scoped roles
    assigned_by     UUID,
    assigned_at     TIMESTAMP DEFAULT NOW(),
    expires_at      TIMESTAMP,                  -- Temporary access
    UNIQUE(user_id, role_id, organization_id, project_id)
);

-- Index for fast permission lookups
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_org ON user_roles(organization_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
```

### Step 7: Seed Permissions and Roles

```sql
-- Insert permissions
INSERT INTO permissions (name, resource, action, description) VALUES
    ('project:create',  'project',  'create',  'Create new projects'),
    ('project:read',    'project',  'read',    'View projects'),
    ('project:update',  'project',  'update',  'Update project details'),
    ('project:delete',  'project',  'delete',  'Delete projects'),
    ('project:archive', 'project',  'archive', 'Archive projects'),
    ('task:create',     'task',     'create',  'Create tasks'),
    ('task:read',       'task',     'read',    'View tasks'),
    ('task:update',     'task',     'update',  'Update tasks'),
    ('task:delete',     'task',     'delete',  'Delete tasks'),
    ('task:assign',     'task',     'assign',  'Assign tasks to users'),
    ('task:close',      'task',     'close',   'Close/complete tasks'),
    ('document:create', 'document', 'create',  'Upload documents'),
    ('document:read',   'document', 'read',    'View/download documents'),
    ('document:delete', 'document', 'delete',  'Delete documents'),
    ('team:read',       'team',     'read',    'View team members'),
    ('team:manage',     'team',     'manage',  'Manage team membership'),
    ('org:manage',      'org',      'manage',  'Manage organization settings'),
    ('org:members',     'org',      'members', 'Manage org members'),
    ('billing:read',    'billing',  'read',    'View billing information'),
    ('billing:update',  'billing',  'update',  'Update billing/subscription'),
    ('settings:read',   'settings', 'read',    'View org settings'),
    ('settings:update', 'settings', 'update',  'Update org settings');

-- Insert roles
INSERT INTO roles (name, display_name, description, scope, is_default) VALUES
    ('guest',           'Guest',             'Limited read access to assigned projects',  'project',      FALSE),
    ('viewer',          'Viewer',            'Read-only access across the organization',  'organization', FALSE),
    ('member',          'Member',            'Standard member with create/edit access',    'organization', TRUE),
    ('project_manager', 'Project Manager',   'Manage projects, tasks, and team members',  'organization', FALSE),
    ('org_admin',       'Organization Admin', 'Full org management except billing',        'organization', FALSE),
    ('owner',           'Owner',             'Full control including billing',             'organization', FALSE);

-- Assign permissions to Member role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'member'
AND p.name IN (
    'project:read', 'task:create', 'task:read', 'task:update',
    'task:close', 'document:create', 'document:read', 'team:read',
    'settings:read'
);

-- Assign permissions to Project Manager role (includes all member + more)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'project_manager'
AND p.name IN (
    'project:create', 'project:read', 'project:update', 'project:archive',
    'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign', 'task:close',
    'document:create', 'document:read', 'document:delete',
    'team:read', 'team:manage', 'settings:read'
);

-- Assign permissions to Owner role (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'owner';
```

### Step 8: Write an Authorization Check Function

```sql
-- Function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION check_permission(
    p_user_id UUID,
    p_permission VARCHAR(100),
    p_org_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id
          AND p.name = p_permission
          AND (ur.organization_id = p_org_id OR ur.organization_id IS NULL)
          AND (ur.project_id = p_project_id OR ur.project_id IS NULL)
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Usage:
-- SELECT check_permission('user-uuid', 'project:create', 'org-uuid');
```

---

## Part 4: Validate Your Design

### Step 9: Test Scenarios

Test these scenarios against your model:

| Scenario | Expected Result |
|---|---|
| Guest tries to create a task | ❌ Denied |
| Member creates a task in their org | ✅ Allowed |
| PM deletes a task | ✅ Allowed |
| PM accesses billing | ❌ Denied |
| Owner manages billing | ✅ Allowed |
| Expired temporary access | ❌ Denied |
| User with no role | ❌ Denied (no permissions) |

### Step 10: Identify Edge Cases

Document and handle these edge cases:

1. **Role inheritance**: Should PM inherit all Member permissions?
2. **Conflicting permissions**: User has both "allow" and "deny" — which wins?
3. **Cross-org access**: Can a user have different roles in different orgs?
4. **Temporary elevation**: How to grant temporary admin access?
5. **Self-service**: Can users change their own roles?

---

## Validation Checklist

- [ ] All resources and actions are identified
- [ ] Permission strings follow `resource:action` convention
- [ ] Roles are hierarchical with clear boundaries
- [ ] SQL schema has proper constraints and indexes
- [ ] Authorization check function handles scope and expiry
- [ ] Edge cases are documented and handled
- [ ] No user can escalate their own privileges

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Permission check always returns false | Verify user_roles entry exists and hasn't expired |
| Role has too many permissions | Review and split into more specific roles |
| Can't assign project-scoped roles | Ensure project_id column is populated |
| Performance slow on permission checks | Add composite indexes on lookup columns |

---

## Further Exploration

- Add role inheritance (child roles inherit parent permissions)
- Implement deny rules (explicit deny overrides allow)
- Add resource-level permissions (specific document access)
- Build an API endpoint that uses this RBAC model

---

**Next Lab**: [Lab 02: Identity Lifecycle →](./lab-02-identity-lifecycle.md)
