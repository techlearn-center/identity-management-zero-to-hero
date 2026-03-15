# Lab 03: Audit Logging with Triggers

## Objective
Set up comprehensive audit logging using PostgreSQL triggers.

## Steps
1. Create audit_log table (immutable)
2. Create trigger functions for user changes
3. Create trigger functions for role changes
4. Test that all changes are logged
5. Write audit report queries
6. Verify audit trail completeness

## Validation
- [ ] User updates are logged with changed fields
- [ ] User deletions are logged
- [ ] Role assignments and removals are logged
- [ ] Audit queries return correct results
