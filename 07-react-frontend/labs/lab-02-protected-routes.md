# Lab 02: Protected Routes and Role-Based UI

## Objective

Add route protection to your React app so that certain pages are only accessible to logged-in users, and some UI elements are only visible to users with specific roles. This is how real applications control who sees what.

## Prerequisites

- Completed Lab 01 (React + Auth0 app running)
- Auth0 tenant with RBAC enabled (Module 03-04)
- A test user in Auth0

## Estimated Time

40–50 minutes

---

## Part 1: Understanding Route Protection

### Why Protect Routes?

In a React SPA, **all code is sent to the browser**. Route protection doesn't hide code — it controls what renders. The real security is on your API (Module 06). But protected routes:
- Prevent confusion (users don't see pages they can't use)
- Redirect to login when needed
- Show appropriate loading states

### How It Works

```
User visits /dashboard
  → Is user authenticated?
    → YES: Render Dashboard component
    → NO: Redirect to Auth0 login
      → After login, redirect back to /dashboard
```

---

## Part 2: Create the ProtectedRoute Component

### Step 1: Create the route guard

Create `src/auth/ProtectedRoute.tsx`:

```tsx
// src/auth/ProtectedRoute.tsx
//
// This component wraps any route that requires authentication.
// If the user is not logged in, it triggers the Auth0 login flow.
// If the user is logged in but lacks required roles, it shows an error.

import { useAuth0 } from "@auth0/auth0-react";
import { ReactNode, useEffect } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];   // Optional: only allow users with these roles
}

export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, loginWithRedirect, user } = useAuth0();

  useEffect(() => {
    // If not loading and not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect({
        appState: {
          // Remember where the user was trying to go
          returnTo: window.location.pathname,
        },
      });
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  // Show loading while Auth0 checks the session
  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
        <div>
          <h2>Loading...</h2>
          <p>Checking your authentication status...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — the useEffect above will redirect
  if (!isAuthenticated) {
    return null;
  }

  // Check roles if required
  if (requiredRoles && requiredRoles.length > 0) {
    // Auth0 stores roles in a custom claim namespace
    // You set this up in Auth0 Actions (Module 04)
    const userRoles: string[] =
      (user?.["https://identity-lab.local/roles"] as string[]) || [];

    const hasRequiredRole = requiredRoles.some((role) =>
      userRoles.includes(role)
    );

    if (!hasRequiredRole) {
      return (
        <div style={{ padding: "40px", textAlign: "center" }}>
          <h1>Access Denied</h1>
          <p>You need one of these roles: <strong>{requiredRoles.join(", ")}</strong></p>
          <p>Your roles: <strong>{userRoles.length > 0 ? userRoles.join(", ") : "none"}</strong></p>
          <p>Contact your administrator to request access.</p>
        </div>
      );
    }
  }

  // All checks passed — render the protected content
  return <>{children}</>;
}
```

**How this works step by step:**
1. `useAuth0()` tells us if the user is authenticated
2. If not, `loginWithRedirect()` sends them to Auth0, remembering where they were going
3. If roles are required, we check the custom claim in the ID token
4. Only if everything passes do we render the children

### Step 2: Create pages that need protection

Create `src/pages/Dashboard.tsx`:

```tsx
// src/pages/Dashboard.tsx
import { useAuth0 } from "@auth0/auth0-react";

export default function Dashboard() {
  const { user } = useAuth0();

  return (
    <div style={{ padding: "40px" }}>
      <h1>Dashboard</h1>
      <p>Welcome to your personal dashboard, {user?.name}.</p>
      <p>This page is only visible to authenticated users.</p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginTop: "24px"
      }}>
        {[
          { title: "Profile", value: user?.email },
          { title: "Logged in via", value: user?.sub?.split("|")[0] },
          { title: "Email verified", value: user?.email_verified ? "Yes" : "No" },
          { title: "Last updated", value: new Date(user?.updated_at || "").toLocaleDateString() },
        ].map((card) => (
          <div key={card.title} style={{
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}>
            <h3 style={{ margin: "0 0 8px" }}>{card.title}</h3>
            <p style={{ margin: 0, color: "#666" }}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Create `src/pages/AdminPanel.tsx`:

```tsx
// src/pages/AdminPanel.tsx
import { useAuth0 } from "@auth0/auth0-react";

export default function AdminPanel() {
  const { user } = useAuth0();

  // Get roles from the custom claim
  const roles: string[] = user?.["https://identity-lab.local/roles"] || [];

  return (
    <div style={{ padding: "40px" }}>
      <h1>Admin Panel</h1>
      <p>This page is only visible to users with the <code>admin</code> role.</p>

      <h2>Your Permissions</h2>
      <ul>
        {roles.map((role) => (
          <li key={role}>{role}</li>
        ))}
      </ul>

      <h2>Admin Actions</h2>
      <p>In a real app, this would contain user management, system settings, etc.</p>
      <div style={{
        background: "#fff3cd",
        border: "1px solid #ffc107",
        padding: "16px",
        borderRadius: "4px",
        marginTop: "16px",
      }}>
        <strong>Note:</strong> This is a UI-only restriction. The real authorization
        happens on the API side (Module 06). Never trust the frontend alone for security.
      </div>
    </div>
  );
}
```

### Step 3: Update App.tsx with protected routes

Replace `src/App.tsx`:

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Auth0ProviderWithHistory from "./auth/Auth0ProviderWithHistory";
import ProtectedRoute from "./auth/ProtectedRoute";
import LoginButton from "./components/LoginButton";
import LogoutButton from "./components/LogoutButton";
import Profile from "./components/Profile";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";

function Navbar() {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const roles: string[] = user?.["https://identity-lab.local/roles"] || [];

  return (
    <nav style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 24px",
      borderBottom: "1px solid #e0e0e0",
      backgroundColor: "#fff",
    }}>
      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <Link to="/" style={{ textDecoration: "none", fontWeight: "bold" }}>Home</Link>
        {isAuthenticated && (
          <>
            <Link to="/dashboard" style={{ textDecoration: "none" }}>Dashboard</Link>
            <Link to="/profile" style={{ textDecoration: "none" }}>Profile</Link>
            {/* Only show Admin link if user has admin role */}
            {roles.includes("admin") && (
              <Link to="/admin" style={{ textDecoration: "none", color: "#dc3545" }}>
                Admin
              </Link>
            )}
          </>
        )}
      </div>
      <div>
        {isLoading ? "Loading..." : isAuthenticated ? <LogoutButton /> : <LoginButton />}
      </div>
    </nav>
  );
}

function HomePage() {
  const { isAuthenticated, user } = useAuth0();
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Identity Lab - React + Auth0</h1>
      {isAuthenticated ? (
        <p>Welcome, <strong>{user?.name}</strong>! Visit your <Link to="/dashboard">Dashboard</Link>.</p>
      ) : (
        <div>
          <p>Click <strong>Log In</strong> to access protected pages.</p>
          <p style={{ color: "#666" }}>
            Try visiting <code>/dashboard</code> directly — you'll be redirected to login first.
          </p>
        </div>
      )}
    </div>
  );
}

function AppContent() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* Protected: requires authentication */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />

        {/* Protected: requires authentication + admin role */}
        <Route path="/admin" element={
          <ProtectedRoute requiredRoles={["admin"]}>
            <AdminPanel />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Auth0ProviderWithHistory>
        <AppContent />
      </Auth0ProviderWithHistory>
    </BrowserRouter>
  );
}
```

---

## Part 3: Set Up Roles in Auth0

To test role-based access, you need to add roles to your Auth0 users and include them in tokens.

### Step 4: Create an Auth0 Action to add roles to tokens

1. In Auth0 Dashboard, go to **Actions → Library**
2. Click **Build Custom**
3. Name it: `Add Roles to Tokens`
4. Trigger: **Login / Post Login**
5. Click **Create**
6. Replace the code with:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = "https://identity-lab.local";

  // Get the user's assigned roles from Auth0
  const assignedRoles = event.authorization?.roles || [];

  // Add roles to both the ID token and access token
  api.idToken.setCustomClaim(`${namespace}/roles`, assignedRoles);
  api.accessToken.setCustomClaim(`${namespace}/roles`, assignedRoles);
};
```

7. Click **Deploy**
8. Go to **Actions → Triggers → Post Login**
9. Drag your `Add Roles to Tokens` action into the flow
10. Click **Apply**

> **Why a namespace?** Auth0 requires custom claims to use a URL-like namespace to avoid collisions with standard OIDC claims like `sub` or `email`.

### Step 5: Create roles and assign to users

1. Go to **User Management → Roles**
2. Create a role called `admin` with description "Full admin access"
3. Create a role called `viewer` with description "Read-only access"
4. Go to **User Management → Users**
5. Click on your test user
6. Go to the **Roles** tab
7. Click **Assign Roles** and assign the `admin` role

---

## Part 4: Test Everything

### Step 6: Test protected routes

1. Start your app: `npm run dev`
2. Open `http://localhost:5173` (make sure you're logged out first)
3. Try visiting `http://localhost:5173/dashboard` directly
4. You should be redirected to Auth0 login
5. After logging in, you should land on the Dashboard (not the home page)

### Step 7: Test role-based access

1. Log in with your admin user
2. The "Admin" link should appear in the navbar
3. Click it — the Admin Panel should render
4. Now, create a second user WITHOUT the admin role
5. Log out and log in as the second user
6. The "Admin" link should NOT appear in the navbar
7. Try visiting `/admin` directly — you should see "Access Denied"

### Step 8: Test the RoleGuard component (optional enhancement)

Create `src/components/RoleGuard.tsx` for conditional rendering within pages:

```tsx
// src/components/RoleGuard.tsx
import { useAuth0 } from "@auth0/auth0-react";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  roles: string[];
  fallback?: ReactNode; // What to show if role check fails
}

export default function RoleGuard({ children, roles, fallback = null }: Props) {
  const { user } = useAuth0();
  const userRoles: string[] = user?.["https://identity-lab.local/roles"] || [];
  const hasRole = roles.some((r) => userRoles.includes(r));

  return hasRole ? <>{children}</> : <>{fallback}</>;
}
```

Usage example:

```tsx
<RoleGuard roles={["admin"]} fallback={<p>Admin-only content hidden</p>}>
  <button onClick={deleteUser}>Delete User</button>
</RoleGuard>
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Protected route shows loading forever | Auth0 SDK stuck initializing | Check browser console for errors. Verify `.env.local` values are correct |
| User has role in Auth0 but not in token | Action not deployed or not in flow | Go to Actions → Triggers → Post Login and verify your action is in the flow |
| `user["https://identity-lab.local/roles"]` is undefined | Custom claim not set | Check the Action code. Log `event.authorization.roles` to debug |
| Redirect after login goes to wrong page | `returnTo` not preserved | Check `onRedirectCallback` in Auth0ProviderWithHistory |
| Admin page shows "Access Denied" for admin user | Role name mismatch | Auth0 roles are case-sensitive. Verify exact role name matches |

---

## Validation Checklist

- [ ] ProtectedRoute component redirects unauthenticated users to login
- [ ] After login, user returns to the page they originally requested
- [ ] Dashboard page only renders for authenticated users
- [ ] Admin Panel only renders for users with `admin` role
- [ ] Non-admin users see "Access Denied" on `/admin`
- [ ] Navbar conditionally shows links based on authentication and roles
- [ ] RoleGuard component hides/shows content based on roles
- [ ] No security-sensitive logic relies solely on frontend checks

---

## Key Takeaway

**Frontend route protection is a UX feature, not a security feature.** Anyone can open browser DevTools and see your React code. The real authorization must happen on your API server (Module 06). Protected routes just make the app user-friendly by not showing pages that won't work without the right permissions.

---

**Next Lab**: [Lab 03: API Calls with Auth0 Tokens →](./lab-03-api-calls.md)
