/**
 * Auth0 Action: Pre-Registration Validation
 * Trigger: Pre User Registration
 *
 * Validates registrations: blocks disposable emails, enforces domain allowlist.
 * Required Secrets: ALLOWED_DOMAINS (comma-separated, optional)
 */
exports.onExecutePreUserRegistration = async (event, api) => {
  const email = event.user.email;
  const domain = email.split("@")[1].toLowerCase();

  // Block disposable email providers
  const disposableDomains = [
    "mailinator.com", "guerrillamail.com", "tempmail.com",
    "throwaway.email", "10minutemail.com", "yopmail.com",
  ];

  if (disposableDomains.includes(domain)) {
    api.access.deny("disposable_email", "Disposable email addresses are not allowed.");
    return;
  }

  // Optional domain allowlist
  const allowedDomains = (event.secrets.ALLOWED_DOMAINS || "").split(",").filter(Boolean);
  if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
    api.access.deny("domain_not_allowed", "Registration is restricted to approved email domains.");
    return;
  }

  // Set default metadata for new users
  api.user.setAppMetadata("plan", "free");
  api.user.setAppMetadata("registered_at", new Date().toISOString());
  api.user.setAppMetadata("onboarding_complete", false);
  api.user.setUserMetadata("preferred_language", "en");
};
