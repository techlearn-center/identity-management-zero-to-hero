import { useAuth0 } from '@auth0/auth0-react';
import { LoginButton } from './LoginButton';
import { LogoutButton } from './LogoutButton';
import { Link } from 'react-router-dom';

export const AuthNav = () => {
  const { isAuthenticated, user } = useAuth0();

  return (
    <nav style={{ display: 'flex', gap: '1rem', padding: '1rem', background: '#f0f4f8' }}>
      <Link to="/">Home</Link>
      {isAuthenticated && <Link to="/profile">Profile</Link>}
      <div style={{ marginLeft: 'auto' }}>
        {isAuthenticated ? (
          <>
            <span>{user?.name}</span>
            <LogoutButton />
          </>
        ) : (
          <LoginButton />
        )}
      </div>
    </nav>
  );
};
