-- Audit report queries

-- Recent login activity
SELECT user_id, action, ip_address, timestamp, success
FROM audit_log
WHERE action IN ('login', 'login_failed')
ORDER BY timestamp DESC
LIMIT 100;

-- Failed logins in last 24 hours (possible attack)
SELECT user_id, COUNT(*) as attempts, array_agg(DISTINCT ip_address) as ips
FROM audit_log
WHERE action = 'login_failed'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 5
ORDER BY attempts DESC;

-- Permission changes audit
SELECT al.timestamp, u.email, al.action, al.details
FROM audit_log al
JOIN users u ON al.user_id = u.id
WHERE al.action IN ('role_assigned', 'role_removed')
ORDER BY al.timestamp DESC;
