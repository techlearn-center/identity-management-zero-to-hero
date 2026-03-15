# Lab 02: MFA Configuration

## Objectives

By the end of this lab you will be able to:

- Enable Multi-Factor Authentication (MFA) on your Auth0 tenant
- Configure TOTP (authenticator app), SMS, and WebAuthn factors
- Set MFA policies (always, adaptive, custom)
- Use Auth0 Actions to enforce MFA conditionally
- Test the MFA enrollment and challenge flows
- Configure recovery codes for account recovery

## Prerequisites

- Completed [Lab 01: SSO Setup](lab-01-sso-setup.md)
- Auth0 tenant with a registered application and test users
- A mobile device with an authenticator app (Google Authenticator, Authy, Microsoft Authenticator)
- (Optional) A hardware security key (YubiKey) for WebAuthn testing

## Estimated Time

30-40 minutes

---

## Step 1: Enable MFA Factors

1. Navigate to **Security > Multi-factor Auth** in the Auth0 Dashboard
2. You will see a list of available factors. Enable the following:

### One-Time Password (TOTP)

1. Toggle **One-time Password** to enabled
2. This allows users to use authenticator apps (Google Authenticator, Authy, etc.)
3. No additional configuration needed

### SMS

1. Toggle **Phone Message** to enabled
2. Auth0 uses Twilio for SMS delivery by default
3. For production, configure your own Twilio credentials:
   - Go to the **Phone Message** settings
   - Enter your Twilio Account SID, Auth Token, and Messaging Service SID
   - Or use a custom SMS provider via the **Send Phone Message** Action trigger

> **Note**: SMS-based MFA has lower security than TOTP or WebAuthn. Consider SMS as a fallback only.

### WebAuthn with Security Keys

1. Toggle **WebAuthn with Security Keys** to enabled (roaming authenticators)
2. This supports hardware keys like YubiKey, Titan Key, etc.
3. Configure attestation preferences (none, indirect, direct)

### WebAuthn with Device Biometrics

1. Toggle **WebAuthn with Device Biometrics** to enabled (platform authenticators)
2. This supports Touch ID, Face ID, Windows Hello
3. Works only on supported devices and browsers

### Recovery Codes

1. Toggle **Recovery Code** to enabled
2. Users will receive a set of one-time recovery codes during MFA enrollment
3. Each code can be used once as a backup when the primary MFA factor is unavailable

---

## Step 2: Set MFA Policy

### Always

1. Under **Define policies**, select **Always**
2. Every login will require MFA after the first factor (password/social)
3. Users will be prompted to enroll on their next login

### Adaptive (Recommended for Production)

1. Select **Adaptive**
2. MFA is triggered based on risk signals:
   - New device or browser
   - New geographic location
   - Impossible travel detected
   - Login from a suspicious IP
3. Low-risk logins skip MFA for better user experience

### Never

1. Select **Never** to disable MFA globally
2. You can still enforce MFA per-application or per-user using Actions

### Custom via Actions

For the most flexibility, set the policy to **Never** and use a post-login Action:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Skip MFA for non-interactive flows (M2M)
  if (event.client.name === 'Management API Client') return;

  // Always require MFA for admin users
  if (event.user.app_metadata?.role === 'admin') {
    api.multifactor.enable('any', { allowRememberBrowser: false });
    return;
  }

  // Require MFA for specific applications
  const sensitiveApps = ['Admin Dashboard', 'Payment Portal'];
  if (sensitiveApps.includes(event.client.name)) {
    api.multifactor.enable('any', { allowRememberBrowser: true });
    return;
  }

  // Require MFA for unverified emails
  if (!event.user.email_verified) {
    api.multifactor.enable('any');
    return;
  }

  // Optional: Require MFA for first login from a new device
  // (Adaptive MFA handles this automatically if enabled)
};
```

---

## Step 3: Test MFA Enrollment

### Set Policy to "Always" for Testing

1. Set the MFA policy to **Always**
2. Ensure TOTP (One-time Password) is enabled
3. Click **Save**

### Trigger MFA Enrollment

1. Open your test application
2. Log in with a test user who has not yet enrolled in MFA
3. After entering the password, Auth0 will present the MFA enrollment screen
4. You will see options for the enabled factors (e.g., "Authenticator App")

### Enroll with Authenticator App (TOTP)

1. Select **Authenticator App**
2. Auth0 displays a QR code
3. Open your authenticator app on your mobile device
4. Scan the QR code
5. Enter the 6-digit code from the authenticator app
6. Click **Continue**
7. Auth0 presents recovery codes -- **save these securely**
8. Click **Continue** to complete enrollment

### Verify MFA Challenge

1. Log out of your application
2. Log in again with the same user
3. After entering the password, Auth0 prompts for the MFA code
4. Open your authenticator app and enter the current 6-digit code
5. You should be authenticated successfully

---

## Step 4: Test Additional Factors

### SMS Factor

1. Log in with a different test user
2. On the MFA enrollment screen, select **SMS**
3. Enter a phone number
4. Auth0 sends an SMS with a verification code
5. Enter the code to complete enrollment

### WebAuthn (Security Key)

1. Log in with another test user
2. Select **Security Key**
3. Your browser will prompt you to insert and activate your security key
4. Touch the security key to complete enrollment

### WebAuthn (Biometrics)

1. On a device with biometric support (MacBook with Touch ID, Windows with Hello)
2. Log in with a test user
3. Select **Device Biometrics**
4. Complete the biometric challenge (fingerprint, face scan)

---

## Step 5: Configure Remember Browser

The "Remember this browser" option allows users to skip MFA for a configurable period:

1. In the MFA settings, find **Remember Browser**
2. Set the duration (e.g., 30 days)
3. When users complete MFA, they can check "Remember this browser"
4. Subsequent logins from the same browser skip MFA until the period expires

### Override via Actions

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // For admin users, never allow "remember browser"
  if (event.user.app_metadata?.role === 'admin') {
    api.multifactor.enable('any', { allowRememberBrowser: false });
  } else {
    api.multifactor.enable('any', { allowRememberBrowser: true });
  }
};
```

---

## Step 6: Configure Custom SMS Provider (Optional)

If you want to use a provider other than Twilio:

1. Go to **Actions > Flows > Send Phone Message**
2. Create a custom Action:

```javascript
const axios = require('axios');

exports.onExecuteSendPhoneMessage = async (event, api) => {
  const { recipient, text, message_type, code } = event;

  // Example: Using a custom SMS API
  await axios.post('https://api.your-sms-provider.com/send', {
    to: recipient,
    message: text,
    // Or construct your own message:
    // message: `Your verification code is: ${code}`
  }, {
    headers: {
      'Authorization': `Bearer ${event.secrets.SMS_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
};
```

---

## Step 7: MFA for Specific Scenarios

### Step-Up Authentication

Require MFA only when accessing sensitive resources:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const audience = event.request.query?.audience;

  // Step-up: Require MFA for the admin API
  if (audience === 'https://api.admin.example.com') {
    api.multifactor.enable('any', { allowRememberBrowser: false });
  }
};
```

### MFA Based on IP

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const trustedIPs = ['203.0.113.0/24', '198.51.100.0/24'];
  const clientIP = event.request.ip;

  // Skip MFA for trusted office IPs
  const isTrusted = trustedIPs.some(cidr => isIPInCIDR(clientIP, cidr));

  if (!isTrusted) {
    api.multifactor.enable('any', { allowRememberBrowser: true });
  }
};
```

---

## Step 8: View MFA Enrollment Status

### Via Dashboard

1. Go to **User Management > Users**
2. Click on a user
3. Under **Multi-factor Authentication**, you can see:
   - Enrolled factors
   - Enrollment date
   - Option to reset MFA enrollment

### Via Management API

```bash
# List a user's MFA enrollments
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${USER_ID}/enrollments" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .

# Delete an MFA enrollment (force re-enrollment)
curl -s --request DELETE \
  --url "https://${AUTH0_DOMAIN}/api/v2/users/${USER_ID}/enrollments/${ENROLLMENT_ID}" \
  --header "authorization: Bearer ${AUTH0_TOKEN}"
```

---

## Validation Checklist

- [ ] MFA factors enabled (TOTP, SMS, WebAuthn, Recovery Codes)
- [ ] MFA policy set (Always for testing, Adaptive for production)
- [ ] TOTP enrollment completed with authenticator app
- [ ] MFA challenge works on subsequent logins
- [ ] Recovery codes generated and saved
- [ ] Remember Browser functionality verified
- [ ] MFA enrollment visible in user profile (dashboard)
- [ ] Custom MFA Action created for conditional enforcement

---

## Troubleshooting

### MFA Enrollment Screen Not Appearing

**Cause**: MFA policy set to "Never" or the user is already enrolled.

**Fix**: Set policy to "Always" and use a user who has not yet enrolled. Check the user's MFA enrollments in the dashboard.

### SMS Code Not Received

**Cause**: Twilio configuration issue or phone number format incorrect.

**Fix**: Verify Twilio credentials. Ensure the phone number includes the country code (e.g., +1 for US). Check Twilio logs for delivery errors.

### "MFA is required but not configured" Error

**Cause**: MFA policy requires a factor that is not enabled.

**Fix**: Enable at least one MFA factor in Security > Multi-factor Auth.

### WebAuthn Not Working

**Cause**: Browser or device does not support WebAuthn.

**Fix**: Use a modern browser (Chrome 67+, Firefox 60+, Safari 14+, Edge 79+). For platform authenticators, ensure the device has biometric hardware.

### Recovery Code Not Accepted

**Cause**: Recovery code already used (each code is single-use) or entered incorrectly.

**Fix**: Recovery codes are one-time use. If all codes are exhausted, an admin must reset the user's MFA enrollment via the dashboard or Management API.

---

## Next Lab

Proceed to [Lab 03: Actions Pipeline](lab-03-actions-pipeline.md) to build custom Auth0 Actions for login enrichment and policy enforcement.
