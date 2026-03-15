-- V001: Initial Identity Schema
-- Creates core tables: users, roles, permissions, sessions

-- Run schemas in order
-- \i schemas/01-users.sql
-- \i schemas/02-roles-permissions.sql
-- \i schemas/03-sessions.sql

-- Seed default roles
INSERT INTO roles (name, display_name, description, is_system) VALUES
    ('admin', 'Administrator', 'Full system access', true),
    ('editor', 'Editor', 'Can create and edit content', true),
    ('viewer', 'Viewer', 'Read-only access', true);

-- Seed default permissions
INSERT INTO permissions (name, resource, action, description) VALUES
    ('read:users', 'users', 'read', 'View user profiles'),
    ('write:users', 'users', 'write', 'Create and edit users'),
    ('delete:users', 'users', 'delete', 'Delete users'),
    ('read:data', 'data', 'read', 'View data'),
    ('write:data', 'data', 'write', 'Create and edit data'),
    ('delete:data', 'data', 'delete', 'Delete data'),
    ('admin:all', 'system', 'admin', 'Full admin access');

-- Assign permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'admin';
