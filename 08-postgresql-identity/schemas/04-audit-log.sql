-- Immutable audit log for identity events

CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id     UUID,
    action      VARCHAR(50) NOT NULL,  -- login, logout, password_change, role_change, etc.
    resource    VARCHAR(50),
    resource_id VARCHAR(255),
    ip_address  INET,
    user_agent  TEXT,
    details     JSONB DEFAULT '{}',
    success     BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_resource ON audit_log(resource, resource_id);

-- Trigger function to audit user changes
CREATE OR REPLACE FUNCTION audit_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (user_id, action, resource, resource_id, details)
        VALUES (NEW.id, 'user_updated', 'user', NEW.id::text,
            jsonb_build_object(
                'changed_fields', (
                    SELECT jsonb_object_agg(key, value)
                    FROM jsonb_each(to_jsonb(NEW))
                    WHERE to_jsonb(NEW) -> key != to_jsonb(OLD) -> key
                      AND key NOT IN ('updated_at', 'password_hash')
                )
            ));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (user_id, action, resource, resource_id, details)
        VALUES (OLD.id, 'user_deleted', 'user', OLD.id::text,
            jsonb_build_object('email', OLD.email));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_users
    AFTER UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_user_changes();
