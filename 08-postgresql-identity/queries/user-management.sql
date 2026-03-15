-- Common user management queries

-- Find user by email
SELECT * FROM users WHERE email = 'alice@example.com';

-- List active users with their roles
SELECT u.email, u.display_name, u.status, array_agg(r.name) AS roles
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.status = 'active'
GROUP BY u.id;

-- Users who haven't logged in for 90 days
SELECT email, display_name, last_login_at
FROM users
WHERE last_login_at < NOW() - INTERVAL '90 days'
  AND status = 'active'
ORDER BY last_login_at;

-- Lock user after failed attempts
UPDATE users SET
    locked_until = NOW() + INTERVAL '30 minutes',
    failed_login_attempts = failed_login_attempts + 1
WHERE id = 'user-uuid' AND failed_login_attempts >= 5;

-- Record successful login
UPDATE users SET
    last_login_at = NOW(),
    last_login_ip = '192.168.1.1',
    failed_login_attempts = 0,
    locked_until = NULL
WHERE id = 'user-uuid';
