# Lab 02: Row-Level Security for Multi-Tenancy

## Objective
Implement PostgreSQL Row-Level Security to isolate tenant data.

## Steps
1. Create organizations and membership tables
2. Enable RLS on tables
3. Create policies for tenant isolation
4. Set application context with `set_config`
5. Test that users can only see their org's data
6. Verify admin bypass for super-users

## Validation
- [ ] RLS policies enabled on tenant tables
- [ ] Users can only query their own org's data
- [ ] Cross-tenant access is blocked
- [ ] Application correctly sets user context
