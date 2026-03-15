import { type ReactNode } from "react";
import { Auth0Provider, type AppState } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------------------
// Environment variable helpers
// ---------------------------------------------------------------------------
function getEnvVar(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${key}. ` +
        `Create a .env.local file with ${key}=<value>.`
    );
  }
  return value as string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Auth0ProviderWithHistoryProps {
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Auth0ProviderWithHistory
// ---------------------------------------------------------------------------
// Wraps the Auth0Provider and handles the redirect callback by pushing the
// user back to the route they originally requested (stored in appState).
//
// This component MUST be rendered inside a <BrowserRouter> so that the
// useNavigate hook has access to the router context.
// ---------------------------------------------------------------------------
export function Auth0ProviderWithHistory({
  children,
}: Auth0ProviderWithHistoryProps) {
  const navigate = useNavigate();

  const domain = getEnvVar("VITE_AUTH0_DOMAIN");
  const clientId = getEnvVar("VITE_AUTH0_CLIENT_ID");
  const audience = getEnvVar("VITE_AUTH0_AUDIENCE");
  const redirectUri = window.location.origin;

  // Called by the Auth0 SDK after the user is redirected back from the
  // Auth0 Universal Login page.
  const onRedirectCallback = (appState?: AppState) => {
    // Navigate to the route that was requested before the login redirect,
    // or fall back to the dashboard.
    navigate(appState?.returnTo ?? "/dashboard", { replace: true });
  };

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience,
        scope: "openid profile email",
      }}
      onRedirectCallback={onRedirectCallback}
      // Enable refresh token rotation for better UX (no hidden iframe needed).
      // Requires "Refresh Token Rotation" to be enabled in the Auth0 Dashboard
      // under Application > Settings > Refresh Token Rotation.
      useRefreshTokens={true}
      // Cache tokens in memory (default). Switch to "localstorage" only when
      // refresh token rotation is enabled, so stolen tokens are detected.
      cacheLocation="memory"
    >
      {children}
    </Auth0Provider>
  );
}
