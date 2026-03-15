-- Performance tuning for identity queries

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Find slow queries related to auth
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%users%' OR query ILIKE '%session%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Analyze table statistics
ANALYZE users;
ANALYZE sessions;
ANALYZE audit_log;

-- Partial index for active sessions only
CREATE INDEX idx_active_sessions ON sessions(user_id, expires_at)
WHERE revoked = FALSE AND expires_at > NOW();

-- GIN index for JSONB metadata queries
CREATE INDEX idx_users_metadata ON users USING GIN (metadata);
