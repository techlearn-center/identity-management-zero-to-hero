import { Auth0Provider } from '@auth0/auth0-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthNav } from './components/AuthNav';
import { Profile } from './components/Profile';
import { ProtectedRoute } from './auth/ProtectedRoute';

function App() {
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: 'openid profile email',
      }}
    >
      <BrowserRouter>
        <AuthNav />
        <main style={{ padding: '2rem' }}>
          <Routes>
            <Route path="/" element={<h1>Identity Lab - Home</h1>} />
            <Route path="/profile" element={<ProtectedRoute component={Profile} />} />
          </Routes>
        </main>
      </BrowserRouter>
    </Auth0Provider>
  );
}

export default App;
