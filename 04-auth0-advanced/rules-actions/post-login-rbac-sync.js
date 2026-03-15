/**
 * Auth0 Action: Post-Login RBAC Sync
 * Trigger: Login / Post Login
 *
 * Syncs roles from external HR system into Auth0 token claims.
 * Required Secrets: HR_API_URL, HR_API_KEY
 */
exports.onExecutePostLogin = async (event, api) => {
  // Only sync every 8 hours
  const lastSync = event.user.app_metadata?.last_role_sync;
  if (lastSync) {
    const hoursSince = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 8) return;
  }

  try {
    const resp = await fetch(
      `${event.secrets.HR_API_URL}/employees/${event.user.email}/roles`,
      { headers: { Authorization: `Bearer ${event.secrets.HR_API_KEY}` } }
    );

    if (!resp.ok) return;
    const data = await resp.json();

    const NS = "https://identity-lab.com";
    api.accessToken.setCustomClaim(`${NS}/hr_roles`, data.roles);
    api.user.setAppMetadata("last_role_sync", new Date().toISOString());
    api.user.setAppMetadata("hr_roles", data.roles);
  } catch (error) {
    console.log(`RBAC sync failed: ${error.message}`);
  }
};
