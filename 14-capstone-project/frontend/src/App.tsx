import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function Nav() {
  const { isAuthenticated, loginWithRedirect, logout, user } = useAuth0();
  return (
    <nav style={{ padding: '1rem', background: '#1a56db', color: 'white', display: 'flex', gap: '1rem' }}>
      <Link to="/" style={{ color: 'white' }}>Home</Link>
      {isAuthenticated && <Link to="/dashboard" style={{ color: 'white' }}>Dashboard</Link>}
      <div style={{ marginLeft: 'auto' }}>
        {isAuthenticated ? (
          <>
            <span>{user?.name} </span>
            <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>Logout</button>
          </>
        ) : (
          <button onClick={() => loginWithRedirect()}>Login</button>
        )}
      </div>
    </nav>
  );
}

function Home() { return <h1>Identity Platform - Capstone Project</h1>; }
function Dashboard() {
  const { user } = useAuth0();
  return (<div><h1>Dashboard</h1><p>Welcome, {user?.name}</p><pre>{JSON.stringify(user, null, 2)}</pre></div>);
}

export default function App() {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: window.location.origin, audience: import.meta.env.VITE_AUTH0_AUDIENCE }}
    >
      <BrowserRouter>
        <Nav />
        <main style={{ padding: '2rem' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
      </BrowserRouter>
    </Auth0Provider>
  );
}
