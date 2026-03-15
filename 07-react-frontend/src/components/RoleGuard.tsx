import { useAuth0 } from '@auth0/auth0-react';
import { ReactNode } from 'react';

interface Props {
  roles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const RoleGuard = ({ roles, children, fallback = null }: Props) => {
  const { user } = useAuth0();
  const namespace = import.meta.env.VITE_AUTH0_NAMESPACE || 'https://identity-lab.com';
  const userRoles: string[] = user?.[`${namespace}/roles`] || [];
  const hasRole = roles.some((role) => userRoles.includes(role));

  return hasRole ? <>{children}</> : <>{fallback}</>;
};
