import { withAuthenticationRequired } from '@auth0/auth0-react';
import { ComponentType } from 'react';

interface Props {
  component: ComponentType;
}

export const ProtectedRoute = ({ component }: Props) => {
  const Component = withAuthenticationRequired(component, {
    onRedirecting: () => <div>Loading...</div>,
  });
  return <Component />;
};
