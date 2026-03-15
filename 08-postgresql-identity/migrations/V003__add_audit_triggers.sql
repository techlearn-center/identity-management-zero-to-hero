-- V003: Add comprehensive audit triggers
-- See schemas/04-audit-log.sql for the audit_log table and trigger function

-- Add audit triggers to role assignments
CREATE OR REPLACE FUNCTION audit_role_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (user_id, action, resource, resource_id, details)
        VALUES (NEW.user_id, 'role_assigned', 'role', NEW.role_id::text,
            jsonb_build_object('granted_by', NEW.granted_by));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (user_id, action, resource, resource_id, details)
        VALUES (OLD.user_id, 'role_removed', 'role', OLD.role_id::text, '{}');
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_user_roles
    AFTER INSERT OR DELETE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION audit_role_changes();
