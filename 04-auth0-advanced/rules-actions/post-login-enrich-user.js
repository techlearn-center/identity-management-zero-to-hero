/**
 * Auth0 Action: Post-Login User Enrichment
 * Trigger: Login / Post Login
 *
 * Fetches user data from external CRM and adds custom claims to tokens.
 * Required Secrets: CRM_API_URL, CRM_API_KEY
 */
exports.onExecutePostLogin = async (event, api) => {
  const NAMESPACE = "https://identity-lab.com";

  // Use cached data if enriched within last 24 hours
  if (event.user.app_metadata?.last_enriched) {
    const lastEnriched = new Date(event.user.app_metadata.last_enriched);
    const hoursSince = (Date.now() - lastEnriched.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) {
      api.idToken.setCustomClaim(`${NAMESPACE}/department`, event.user.app_metadata.department);
      api.accessToken.setCustomClaim(`${NAMESPACE}/roles`, event.user.app_metadata.roles || []);
      return;
    }
  }

  try {
    const response = await fetch(`${event.secrets.CRM_API_URL}/v1/users/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${event.secrets.CRM_API_KEY}`,
      },
      body: JSON.stringify({ email: event.user.email }),
    });

    if (!response.ok) {
      console.log(`CRM lookup failed: ${response.status}`);
      return;
    }

    const userData = await response.json();

    // Add claims to ID token (frontend)
    api.idToken.setCustomClaim(`${NAMESPACE}/department`, userData.department);
    api.idToken.setCustomClaim(`${NAMESPACE}/title`, userData.title);
    api.idToken.setCustomClaim(`${NAMESPACE}/employee_id`, userData.employee_id);

    // Add claims to access token (API)
    api.accessToken.setCustomClaim(`${NAMESPACE}/roles`, userData.roles);
    api.accessToken.setCustomClaim(`${NAMESPACE}/permissions`, userData.permissions);

    // Cache in app_metadata
    api.user.setAppMetadata("department", userData.department);
    api.user.setAppMetadata("roles", userData.roles);
    api.user.setAppMetadata("last_enriched", new Date().toISOString());
  } catch (error) {
    console.log(`CRM enrichment error: ${error.message}`);
  }
};
