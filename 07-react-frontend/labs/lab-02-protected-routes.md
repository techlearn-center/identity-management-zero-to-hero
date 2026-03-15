# Lab 02: Protected Routes

## Objective
Implement protected routes that require authentication and role-based navigation.

## Steps
1. Create `ProtectedRoute` component using `withAuthenticationRequired`
2. Set up React Router with public and protected routes
3. Create `RoleGuard` component for conditional rendering
4. Build navigation that adapts to auth state

## Validation
- [ ] Unauthenticated users are redirected to login
- [ ] Authenticated users can access protected pages
- [ ] RoleGuard hides/shows content based on roles
