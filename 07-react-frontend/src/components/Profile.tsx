import { useAuth0 } from '@auth0/auth0-react';

export const Profile = () => {
  const { user, isLoading } = useAuth0();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return null;

  return (
    <div>
      <h1>User Profile</h1>
      <img src={user.picture} alt={user.name} width={100} style={{ borderRadius: '50%' }} />
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
      <p>Email Verified: {user.email_verified ? 'Yes' : 'No'}</p>
      <h3>Raw Claims:</h3>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </div>
  );
};
