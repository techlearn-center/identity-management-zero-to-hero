-- Role and permission queries

-- Assign role to user
INSERT INTO user_roles (user_id, role_id, granted_by)
SELECT 'user-uuid', id, 'admin-uuid' FROM roles WHERE name = 'editor';

-- Get all permissions for a user
SELECT DISTINCT p.name, p.resource, p.action
FROM user_roles ur
JOIN role_permissions rp ON ur.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE ur.user_id = 'user-uuid'
  AND (ur.expires_at IS NULL OR ur.expires_at > NOW());

-- Check specific permission
SELECT user_has_permission('user-uuid', 'read:data');

-- List users with admin role
SELECT u.email, u.display_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE r.name = 'admin';
