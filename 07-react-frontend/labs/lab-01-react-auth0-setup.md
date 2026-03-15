# Lab 01: React + Auth0 Setup (From Scratch)

## Objective

Build a React application with Auth0 authentication from absolute zero. By the end of this lab, you will have a working React app where users can sign up, log in, see their profile, and log out — all powered by Auth0.

## Prerequisites

- **Node.js 18+** installed — check with `node --version`
- **npm** or **yarn** — check with `npm --version`
- **Auth0 account** — free at [https://auth0.com/signup](https://auth0.com/signup)
- **VS Code** or any code editor
- Completed Module 03 Lab 01 (you should already have an Auth0 tenant)

## Estimated Time

45–60 minutes

---

## Part 1: Create the React Project

### Step 1: Scaffold with Vite

Open your terminal and run:

```bash
npm create vite@latest identity-frontend -- --template react-ts
```

This creates a new React + TypeScript project using Vite (a fast build tool).

### Step 2: Enter the project and install dependencies

```bash
cd identity-frontend
npm install
```

### Step 3: Verify it works

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. You should see the default Vite + React page. Press `Ctrl+C` to stop the server.

### Step 4: Install Auth0 and Router packages

```bash
npm install @auth0/auth0-react react-router-dom
```

**What these do:**
- `@auth0/auth0-react` — Auth0's official React SDK. Provides hooks like `useAuth0()` for login/logout/user info
- `react-router-dom` — React Router for page navigation (so we can have `/profile`, `/dashboard`, etc.)

Your `package.json` should now include both packages under `dependencies`.

---

## Part 2: Register Your App in Auth0

### Step 5: Create a Single Page Application in Auth0

1. Log into [Auth0 Dashboard](https://manage.auth0.com)
2. Go to **Applications → Applications** in the left sidebar
3. Click **+ Create Application**
4. Enter:
   - **Name**: `Identity Lab React App`
   - **Application Type**: Select **Single Page Web Applications**
5. Click **Create**
6. Click the **Settings** tab

### Step 6: Note your credentials

You'll need two values from this page:

```
Domain:    your-tenant.us.auth0.com
Client ID: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Write these down** — you'll use them in your React code shortly.

> **Why no Client Secret?** SPAs run in the browser where code is visible to users. Auth0 uses PKCE (Proof Key for Code Exchange) instead of a secret to keep the flow secure.

### Step 7: Configure allowed URLs

Scroll down to **Application URIs** and set:

| Field | Value |
|---|---|
| Allowed Callback URLs | `http://localhost:5173` |
| Allowed Logout URLs | `http://localhost:5173` |
| Allowed Web Origins | `http://localhost:5173` |

> **Why these URLs?**
> - **Callback URL**: Where Auth0 sends users after login. Must match exactly.
> - **Logout URL**: Where Auth0 sends users after logout.
> - **Web Origins**: Allows Auth0's SDK to silently refresh tokens from this origin.

Click **Save Changes** at the bottom.

---

## Part 3: Configure Auth0 in Your React App

### Step 8: Create an environment file

Create a file called `.env.local` in your project root:

```bash
# .env.local
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id_here
VITE_AUTH0_AUDIENCE=https://api.identity-lab.local
```

Replace the values with your actual Auth0 credentials from Step 6.

> **Why `.env.local`?** Vite loads environment variables from `.env.local` automatically. The `VITE_` prefix makes them available in browser code. Never commit this file — add it to `.gitignore`.

### Step 9: Add `.env.local` to `.gitignore`

Open `.gitignore` and add:

```
.env.local
```

### Step 10: Create the Auth0 Provider wrapper

Create a new file `src/auth/Auth0ProviderWithHistory.tsx`:

```tsx
// src/auth/Auth0ProviderWithHistory.tsx
//
// This component wraps your entire app with Auth0's context provider.
// It reads config from environment variables and handles the redirect
// callback after login.

import { Auth0Provider } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function Auth0ProviderWithHistory({ children }: Props) {
  const navigate = useNavigate();

  // Read config from environment variables
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  // Safety check — crash early if misconfigured
  if (!domain || !clientId) {
    throw new Error(
      "Missing VITE_AUTH0_DOMAIN or VITE_AUTH0_CLIENT_ID in .env.local"
    );
  }

  // Called after Auth0 redirects back to your app after login
  const onRedirectCallback = (appState: any) => {
    // Navigate to where the user was trying to go, or home
    navigate(appState?.returnTo || "/");
  };

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
        scope: "openid profile email",
      }}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  );
}
```

**What's happening here:**
1. We import `Auth0Provider` which creates a React Context that shares auth state with all child components
2. `useNavigate` from React Router lets us redirect after login
3. `authorizationParams` tells Auth0 what we want:
   - `redirect_uri` — come back to our app after login
   - `audience` — the API we want an access token for
   - `scope` — what user info we want (`openid` = ID token, `profile` = name/picture, `email` = email address)

### Step 11: Create the Login button component

Create `src/components/LoginButton.tsx`:

```tsx
// src/components/LoginButton.tsx
import { useAuth0 } from "@auth0/auth0-react";

export default function LoginButton() {
  // useAuth0() gives us auth methods and state
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();

  // Don't show the button if already logged in or still loading
  if (isLoading || isAuthenticated) return null;

  return (
    <button
      onClick={() => loginWithRedirect()}
      style={{
        backgroundColor: "#0059d6",
        color: "white",
        border: "none",
        padding: "10px 20px",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "16px",
      }}
    >
      Log In
    </button>
  );
}
```

> **How `loginWithRedirect` works:** It redirects the browser to Auth0's Universal Login page. After the user logs in, Auth0 redirects back to your `redirect_uri` with an authorization code, which the SDK exchanges for tokens automatically.

### Step 12: Create the Logout button component

Create `src/components/LogoutButton.tsx`:

```tsx
// src/components/LogoutButton.tsx
import { useAuth0 } from "@auth0/auth0-react";

export default function LogoutButton() {
  const { logout, isAuthenticated, isLoading } = useAuth0();

  if (isLoading || !isAuthenticated) return null;

  return (
    <button
      onClick={() =>
        logout({
          logoutParams: {
            returnTo: window.location.origin,
          },
        })
      }
      style={{
        backgroundColor: "#dc3545",
        color: "white",
        border: "none",
        padding: "10px 20px",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "16px",
      }}
    >
      Log Out
    </button>
  );
}
```

> **How `logout` works:** It redirects to Auth0's `/v2/logout` endpoint, which clears the Auth0 session, then redirects to your `returnTo` URL. The SDK also clears the local session.

### Step 13: Create the Profile component

Create `src/components/Profile.tsx`:

```tsx
// src/components/Profile.tsx
import { useAuth0 } from "@auth0/auth0-react";

export default function Profile() {
  const { user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated || !user) return null;

  return (
    <div style={{ padding: "20px", maxWidth: "600px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {user.picture && (
          <img
            src={user.picture}
            alt={user.name}
            width={64}
            height={64}
            style={{ borderRadius: "50%" }}
          />
        )}
        <div>
          <h2 style={{ margin: 0 }}>{user.name}</h2>
          <p style={{ margin: 0, color: "#666" }}>{user.email}</p>
        </div>
      </div>

      <h3>ID Token Claims</h3>
      <p>These are the claims Auth0 put in your ID token:</p>
      <pre
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: "16px",
          borderRadius: "4px",
          overflow: "auto",
          fontSize: "13px",
        }}
      >
        {JSON.stringify(user, null, 2)}
      </pre>

      <h3>What Each Claim Means</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>Claim</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #ddd" }}>Meaning</th>
          </tr>
        </thead>
        <tbody>
          <tr><td style={{ padding: "8px" }}><code>sub</code></td><td style={{ padding: "8px" }}>Unique user ID in Auth0</td></tr>
          <tr><td style={{ padding: "8px" }}><code>name</code></td><td style={{ padding: "8px" }}>Display name</td></tr>
          <tr><td style={{ padding: "8px" }}><code>email</code></td><td style={{ padding: "8px" }}>Email address</td></tr>
          <tr><td style={{ padding: "8px" }}><code>email_verified</code></td><td style={{ padding: "8px" }}>Whether email was verified</td></tr>
          <tr><td style={{ padding: "8px" }}><code>picture</code></td><td style={{ padding: "8px" }}>Avatar URL (from Gravatar or social provider)</td></tr>
          <tr><td style={{ padding: "8px" }}><code>updated_at</code></td><td style={{ padding: "8px" }}>Last profile update timestamp</td></tr>
        </tbody>
      </table>
    </div>
  );
}
```

### Step 14: Wire everything together in App.tsx

Replace the contents of `src/App.tsx` with:

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import Auth0ProviderWithHistory from "./auth/Auth0ProviderWithHistory";
import LoginButton from "./components/LoginButton";
import LogoutButton from "./components/LogoutButton";
import Profile from "./components/Profile";

// --- Navigation Bar ---
function Navbar() {
  const { isAuthenticated, isLoading } = useAuth0();

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        borderBottom: "1px solid #e0e0e0",
        backgroundColor: "#fff",
      }}
    >
      <div style={{ display: "flex", gap: "16px" }}>
        <Link to="/" style={{ textDecoration: "none", fontWeight: "bold" }}>
          Home
        </Link>
        {isAuthenticated && (
          <Link to="/profile" style={{ textDecoration: "none" }}>
            Profile
          </Link>
        )}
      </div>
      <div>
        {isLoading ? "Loading..." : isAuthenticated ? <LogoutButton /> : <LoginButton />}
      </div>
    </nav>
  );
}

// --- Pages ---
function HomePage() {
  const { isAuthenticated, user } = useAuth0();
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>Identity Lab - React + Auth0</h1>
      {isAuthenticated ? (
        <p>Welcome back, <strong>{user?.name}</strong>! Visit your <Link to="/profile">Profile</Link>.</p>
      ) : (
        <p>Click <strong>Log In</strong> above to get started.</p>
      )}
    </div>
  );
}

// --- Main App ---
function AppContent() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/profile" element={<Profile />} />
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

**Architecture explanation:**
```
BrowserRouter          ← Enables URL-based routing
  └─ Auth0Provider     ← Makes auth state available everywhere
       └─ Navbar       ← Shows Login or Logout based on auth state
       └─ Routes       ← Maps URLs to page components
            ├─ /         → HomePage
            └─ /profile  → Profile (shows user info)
```

### Step 15: Clean up default files

Delete the files you don't need:

```bash
rm src/App.css src/index.css
```

Update `src/main.tsx` to remove the CSS import:

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Part 4: Test Your Application

### Step 16: Start the development server

```bash
npm run dev
```

Open `http://localhost:5173`.

### Step 17: Test the login flow

1. Click **Log In** in the navbar
2. You should be redirected to Auth0's Universal Login page
3. Click **Sign Up** to create a new account (or log in if you created one in Module 03)
4. After authentication, Auth0 redirects you back to your app
5. The navbar should now show **Log Out** and a **Profile** link

### Step 18: Check the Profile page

1. Click **Profile** in the navbar
2. You should see:
   - Your avatar and name
   - Your email
   - The raw JSON of all ID token claims

### Step 19: Test logout

1. Click **Log Out**
2. You should be redirected to the home page
3. The navbar should show **Log In** again
4. Navigating to `/profile` should show nothing (because you're logged out)

---

## Part 5: Understand What's Happening Under the Hood

### The Authentication Flow

When a user clicks "Log In", here's what happens step by step:

```
1. User clicks "Log In"
2. SDK generates a random code_verifier and code_challenge (PKCE)
3. Browser redirects to: https://your-tenant.auth0.com/authorize?
     response_type=code&
     client_id=YOUR_CLIENT_ID&
     redirect_uri=http://localhost:5173&
     scope=openid profile email&
     code_challenge=xxx&
     code_challenge_method=S256&
     state=random_string
4. User logs in on Auth0's page
5. Auth0 redirects back: http://localhost:5173?code=AUTH_CODE&state=random_string
6. SDK exchanges the code for tokens:
     POST https://your-tenant.auth0.com/oauth/token
     { grant_type: "authorization_code", code: AUTH_CODE, code_verifier: xxx }
7. Auth0 returns: { access_token, id_token, expires_in }
8. SDK stores tokens in memory and updates React state
9. useAuth0() now returns isAuthenticated=true and user data
```

### Where Are Tokens Stored?

By default, the Auth0 React SDK stores tokens **in memory** (JavaScript variables). This means:
- Tokens are lost on page refresh (SDK silently re-authenticates using a cookie)
- Tokens are never in localStorage (more secure against XSS)
- You can opt into `useRefreshTokens` for longer sessions

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| "Callback URL mismatch" error | Auth0 redirect URL doesn't match | Add `http://localhost:5173` to Allowed Callback URLs in Auth0 dashboard |
| Infinite redirect loop | Missing `onRedirectCallback` or wrong redirect_uri | Check Auth0ProviderWithHistory for correct config |
| `user` is undefined | SDK still loading | Check `isLoading` before accessing `user` |
| CORS error in console | Allowed Web Origins not set | Add `http://localhost:5173` to Allowed Web Origins |
| "Missing VITE_AUTH0_DOMAIN" error | `.env.local` not created or wrong prefix | Create `.env.local` with `VITE_` prefix. Restart dev server after creating it |
| Login works but profile is empty | Not requesting `profile` scope | Check `scope: "openid profile email"` in Auth0Provider |

---

## Validation Checklist

- [ ] React project created with Vite + TypeScript
- [ ] Auth0 SPA application registered in dashboard
- [ ] Callback, logout, and web origin URLs configured
- [ ] `.env.local` created with Auth0 credentials
- [ ] Auth0Provider wraps the entire app
- [ ] Login redirects to Auth0 Universal Login
- [ ] After login, user name and email display correctly
- [ ] Profile page shows all ID token claims
- [ ] Logout clears session and returns to home
- [ ] No errors in browser console

---

## What You Learned

- How to create a React + TypeScript project with Vite
- How to register an Auth0 SPA application
- How Auth0's React SDK provides authentication via React Context
- How the `useAuth0()` hook exposes login, logout, and user state
- How the Authorization Code + PKCE flow works in a browser
- Where tokens are stored and why

---

**Next Lab**: [Lab 02: Protected Routes →](./lab-02-protected-routes.md)
