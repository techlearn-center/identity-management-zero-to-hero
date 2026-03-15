# Lab 03: Making Authenticated API Calls

## Objective

Connect your React frontend to a protected API backend. You'll learn how to get access tokens from Auth0, attach them to API requests, handle token expiration, and display API responses — the complete frontend-to-backend authentication flow.

## Prerequisites

- Completed Lab 01 and Lab 02 (React + Auth0 app with protected routes)
- Module 06 Express or FastAPI app running (or we'll create a simple mock)
- Auth0 API registered (from Module 03, Lab 01)

## Estimated Time

45–60 minutes

---

## Part 1: How Token-Based API Calls Work

Before writing code, understand the flow:

```
React App                        Auth0                         API Server
─────────                        ─────                         ──────────
1. User clicks action
2. getAccessTokenSilently() ──→ 3. Returns cached token
                                   (or refreshes silently)
4. Attach token to request:
   Authorization: Bearer <token>
                                                         ──→ 5. API receives request
                                                              6. Validates JWT:
                                                                 - Verify signature (JWKS)
                                                                 - Check expiry
                                                                 - Check audience
                                                                 - Check permissions
                                                              7. Returns data or 401/403
8. Display data to user ←────────────────────────────────────
```

**Key concept:** The React app never sends the user's password to the API. Instead, it sends an **access token** (a JWT) that Auth0 issued. The API trusts this token because it can verify Auth0's cryptographic signature.

---

## Part 2: Create the API Service Layer

### Step 1: Install axios

```bash
cd identity-frontend
npm install axios
```

> **Why axios over fetch?** Axios provides interceptors (perfect for adding auth headers automatically), better error handling, and request/response transformation. `fetch` works too, but requires more boilerplate.

### Step 2: Create the API service

Create `src/services/api.ts`:

```typescript
// src/services/api.ts
//
// Centralized API service. All API calls go through this module.
// The Auth0 access token is injected via an interceptor set up in ApiProvider.

import axios from "axios";

// Base URL of your API — change this to match your backend
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 second timeout
});

// --- API Methods ---

// Public endpoint (no auth required)
export async function getPublicMessage(): Promise<string> {
  const response = await api.get("/api/public");
  return response.data.message;
}

// Protected endpoint (requires authentication)
export async function getProtectedMessage(): Promise<string> {
  const response = await api.get("/api/protected");
  return response.data.message;
}

// Admin endpoint (requires admin role)
export async function getAdminMessage(): Promise<string> {
  const response = await api.get("/api/admin");
  return response.data.message;
}

// Get current user's data from the API
export async function getUserData(): Promise<any> {
  const response = await api.get("/api/me");
  return response.data;
}

export default api;
```

### Step 3: Create an ApiProvider that injects the auth token

Create `src/services/ApiProvider.tsx`:

```tsx
// src/services/ApiProvider.tsx
//
// This component sets up an axios interceptor that automatically
// attaches the Auth0 access token to every API request.

import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, ReactNode } from "react";
import api from "./api";

interface Props {
  children: ReactNode;
}

export default function ApiProvider({ children }: Props) {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  useEffect(() => {
    // Add a request interceptor that runs before every API call
    const interceptor = api.interceptors.request.use(
      async (config) => {
        if (isAuthenticated) {
          try {
            // Get the access token from Auth0
            // This uses the cached token, or silently refreshes if expired
            const token = await getAccessTokenSilently();

            // Attach it as a Bearer token in the Authorization header
            config.headers.Authorization = `Bearer ${token}`;
          } catch (error) {
            console.error("Failed to get access token:", error);
            // Let the request proceed without a token
            // The API will return 401 and the UI can handle it
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add a response interceptor to handle auth errors globally
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.warn("API returned 401 — token may be expired");
          // You could trigger a re-login here
        }
        if (error.response?.status === 403) {
          console.warn("API returned 403 — insufficient permissions");
        }
        return Promise.reject(error);
      }
    );

    // Clean up interceptors when component unmounts
    return () => {
      api.interceptors.request.eject(interceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [getAccessTokenSilently, isAuthenticated]);

  return <>{children}</>;
}
```

**What's happening:**
1. `getAccessTokenSilently()` returns the cached access token, or silently refreshes it if expired (using a hidden iframe or refresh token)
2. The axios interceptor automatically adds `Authorization: Bearer <token>` to every request
3. The response interceptor catches 401/403 errors globally

### Step 4: Add ApiProvider to your app

Update `src/App.tsx` — wrap `AppContent` with `ApiProvider`:

```tsx
// Add to imports:
import ApiProvider from "./services/ApiProvider";

// Update the App function:
export default function App() {
  return (
    <BrowserRouter>
      <Auth0ProviderWithHistory>
        <ApiProvider>
          <AppContent />
        </ApiProvider>
      </Auth0ProviderWithHistory>
    </BrowserRouter>
  );
}
```

---

## Part 3: Create a Page That Calls the API

### Step 5: Build the API Explorer page

Create `src/pages/ApiExplorer.tsx`:

```tsx
// src/pages/ApiExplorer.tsx
//
// A page that lets you test different API endpoints and see the results.
// Great for understanding how authentication and authorization work.

import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { getPublicMessage, getProtectedMessage, getAdminMessage } from "../services/api";

interface ApiResult {
  status: "idle" | "loading" | "success" | "error";
  data?: string;
  error?: string;
}

export default function ApiExplorer() {
  const { getAccessTokenSilently } = useAuth0();
  const [results, setResults] = useState<Record<string, ApiResult>>({
    public: { status: "idle" },
    protected: { status: "idle" },
    admin: { status: "idle" },
  });
  const [rawToken, setRawToken] = useState<string>("");

  const callEndpoint = async (
    name: string,
    fn: () => Promise<string>
  ) => {
    setResults((prev) => ({
      ...prev,
      [name]: { status: "loading" },
    }));

    try {
      const data = await fn();
      setResults((prev) => ({
        ...prev,
        [name]: { status: "success", data },
      }));
    } catch (err: any) {
      setResults((prev) => ({
        ...prev,
        [name]: {
          status: "error",
          error: `${err.response?.status || "Network Error"}: ${
            err.response?.data?.message || err.message
          }`,
        },
      }));
    }
  };

  const showToken = async () => {
    try {
      const token = await getAccessTokenSilently();
      setRawToken(token);
    } catch (err: any) {
      setRawToken(`Error: ${err.message}`);
    }
  };

  const resultStyle = (r: ApiResult) => ({
    padding: "12px",
    borderRadius: "4px",
    marginTop: "8px",
    background:
      r.status === "success" ? "#d4edda" :
      r.status === "error" ? "#f8d7da" :
      r.status === "loading" ? "#fff3cd" : "#e2e3e5",
  });

  return (
    <div style={{ padding: "40px", maxWidth: "800px" }}>
      <h1>API Explorer</h1>
      <p>Test different API endpoints to see authentication and authorization in action.</p>

      {/* Public Endpoint */}
      <div style={{ marginBottom: "24px" }}>
        <h3>Public Endpoint <code>GET /api/public</code></h3>
        <p>No authentication required. Anyone can call this.</p>
        <button onClick={() => callEndpoint("public", getPublicMessage)}>
          Call Public API
        </button>
        <div style={resultStyle(results.public)}>
          {results.public.status === "idle" && "Click the button to test"}
          {results.public.status === "loading" && "Loading..."}
          {results.public.status === "success" && `✅ ${results.public.data}`}
          {results.public.status === "error" && `❌ ${results.public.error}`}
        </div>
      </div>

      {/* Protected Endpoint */}
      <div style={{ marginBottom: "24px" }}>
        <h3>Protected Endpoint <code>GET /api/protected</code></h3>
        <p>Requires a valid access token (any authenticated user).</p>
        <button onClick={() => callEndpoint("protected", getProtectedMessage)}>
          Call Protected API
        </button>
        <div style={resultStyle(results.protected)}>
          {results.protected.status === "idle" && "Click the button to test"}
          {results.protected.status === "loading" && "Loading..."}
          {results.protected.status === "success" && `✅ ${results.protected.data}`}
          {results.protected.status === "error" && `❌ ${results.protected.error}`}
        </div>
      </div>

      {/* Admin Endpoint */}
      <div style={{ marginBottom: "24px" }}>
        <h3>Admin Endpoint <code>GET /api/admin</code></h3>
        <p>Requires a valid access token with <code>admin</code> role or <code>admin:all</code> permission.</p>
        <button onClick={() => callEndpoint("admin", getAdminMessage)}>
          Call Admin API
        </button>
        <div style={resultStyle(results.admin)}>
          {results.admin.status === "idle" && "Click the button to test"}
          {results.admin.status === "loading" && "Loading..."}
          {results.admin.status === "success" && `✅ ${results.admin.data}`}
          {results.admin.status === "error" && `❌ ${results.admin.error}`}
        </div>
      </div>

      {/* Token Inspector */}
      <div style={{ marginBottom: "24px" }}>
        <h3>Access Token Inspector</h3>
        <p>View your raw access token. Copy and paste it into <a href="https://jwt.io" target="_blank">jwt.io</a> to decode it.</p>
        <button onClick={showToken}>Show My Access Token</button>
        {rawToken && (
          <pre style={{
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: "16px",
            borderRadius: "4px",
            overflow: "auto",
            fontSize: "12px",
            marginTop: "8px",
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
          }}>
            {rawToken}
          </pre>
        )}
      </div>
    </div>
  );
}
```

### Step 6: Add the route

Add to your `App.tsx` routes:

```tsx
import ApiExplorer from "./pages/ApiExplorer";

// Inside Routes:
<Route path="/api-explorer" element={
  <ProtectedRoute>
    <ApiExplorer />
  </ProtectedRoute>
} />
```

And add a nav link:

```tsx
<Link to="/api-explorer" style={{ textDecoration: "none" }}>API Explorer</Link>
```

---

## Part 4: Set Up a Quick Test API (if you don't have Module 06 running)

### Step 7: Create a minimal Express API

In a **separate terminal** (outside your React project):

```bash
mkdir -p ~/identity-api && cd ~/identity-api
npm init -y
npm install express cors express-oauth2-jwt-bearer
```

Create `server.js`:

```javascript
// server.js — minimal API for testing React auth
const express = require("express");
const cors = require("cors");
const { auth, requiredScopes } = require("express-oauth2-jwt-bearer");

const app = express();

// Allow requests from the React app
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Auth0 JWT validation middleware
const checkJwt = auth({
  audience: "https://api.identity-lab.local",
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
});

// Public endpoint — no auth
app.get("/api/public", (req, res) => {
  res.json({ message: "This is public data. No authentication required." });
});

// Protected endpoint — requires valid JWT
app.get("/api/protected", checkJwt, (req, res) => {
  res.json({
    message: "You are authenticated! Here is protected data.",
    user: req.auth.payload.sub,
  });
});

// Admin endpoint — requires valid JWT + admin scope
app.get("/api/admin", checkJwt, (req, res) => {
  const permissions = req.auth.payload.permissions || [];
  if (!permissions.includes("admin:all")) {
    return res.status(403).json({ message: "Insufficient permissions. Need admin:all." });
  }
  res.json({
    message: "Welcome, admin! Here is admin-only data.",
    permissions,
  });
});

// User info endpoint
app.get("/api/me", checkJwt, (req, res) => {
  res.json({
    sub: req.auth.payload.sub,
    scope: req.auth.payload.scope,
    permissions: req.auth.payload.permissions || [],
  });
});

app.listen(3001, () => console.log("API running on http://localhost:3001"));
```

Add `.env.local` to your React project if not already:

```bash
VITE_API_URL=http://localhost:3001
```

Start the API:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com node server.js
```

---

## Part 5: Test the Full Flow

### Step 8: Test each endpoint

1. Start both the React app (`npm run dev`) and the API (`node server.js`)
2. Open `http://localhost:5173`
3. Log in and navigate to **API Explorer**
4. Click **Call Public API** — should succeed (no auth needed)
5. Click **Call Protected API** — should succeed (you're logged in)
6. Click **Call Admin API**:
   - If your user has `admin:all` permission → success
   - If not → `403: Insufficient permissions`
7. Click **Show My Access Token** — copy it and paste into [jwt.io](https://jwt.io)

### Step 9: Inspect the token at jwt.io

At jwt.io, you should see:

```json
{
  "iss": "https://your-tenant.us.auth0.com/",
  "sub": "auth0|abc123",
  "aud": "https://api.identity-lab.local",
  "iat": 1700000000,
  "exp": 1700086400,
  "scope": "openid profile email",
  "permissions": ["read:data", "write:data"],
  "https://identity-lab.local/roles": ["admin"]
}
```

Notice how the `audience` matches your API identifier, and `permissions` lists what this user can do.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| CORS error when calling API | API not allowing React origin | Verify `cors({ origin: "http://localhost:5173" })` in Express |
| 401 on protected endpoints | Token expired or invalid audience | Check `VITE_AUTH0_AUDIENCE` matches the API identifier |
| Token is undefined | Not authenticated or SDK not ready | Check `isAuthenticated` before calling `getAccessTokenSilently` |
| 403 on admin endpoint | User lacks `admin:all` permission | Assign the permission in Auth0 Dashboard → User → Permissions |
| API not receiving the token | Interceptor not set up | Verify `ApiProvider` wraps your app components |
| Network Error (no response) | API not running | Start the Express API on port 3001 |

---

## Validation Checklist

- [ ] axios instance created with base URL configuration
- [ ] ApiProvider sets up token injection interceptor
- [ ] Public endpoint works without authentication
- [ ] Protected endpoint works with authentication
- [ ] Admin endpoint correctly rejects non-admin users
- [ ] Access token visible and decodable at jwt.io
- [ ] 401/403 errors are handled gracefully in the UI
- [ ] Token automatically refreshes when expired

---

## What You Learned

- How to use `getAccessTokenSilently()` to get access tokens
- How axios interceptors automatically attach tokens to every request
- The difference between public, protected, and role-restricted endpoints
- How to inspect and decode JWTs to debug authorization issues
- Why frontend and backend security must work together

---

**Next Module**: [Module 08: PostgreSQL Identity →](../../08-postgresql-identity/README.md)
