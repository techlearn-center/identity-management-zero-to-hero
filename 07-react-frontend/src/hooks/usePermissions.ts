import { useAuth0 } from '@auth0/auth0-react';
import { useState, useEffect } from 'react';

export function usePermissions() {
  const { getAccessTokenSilently } = useAuth0();
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessTokenSilently();
        const payload = JSON.parse(atob(token.split('.')[1]));
        setPermissions(payload.permissions || []);
      } catch {
        setPermissions([]);
      }
    })();
  }, [getAccessTokenSilently]);

  const hasPermission = (perm: string) => permissions.includes(perm);
  const hasAllPermissions = (perms: string[]) => perms.every((p) => permissions.includes(p));

  return { permissions, hasPermission, hasAllPermissions };
}
