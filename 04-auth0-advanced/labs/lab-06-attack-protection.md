# Lab 06: Attack Protection

## Objectives

By the end of this lab you will be able to:

- Configure bot detection to prevent automated attacks
- Set up brute-force protection with customized thresholds
- Enable suspicious IP throttling
- Configure breached password detection
- Set up alerts and notifications for security events
- Test attack protection using simulated scenarios
- Configure allow-lists for trusted IPs

## Prerequisites

- Completed Module 03 labs
- Auth0 tenant with applications and test users
- Basic understanding of common attack vectors (credential stuffing, brute force)

## Estimated Time

25-35 minutes

---

## Step 1: Configure Bot Detection

Bot detection uses CAPTCHA challenges to block automated login attempts.

### Enable Bot Detection

1. Go to **Security > Attack Protection > Bot Detection**
2. Toggle **Bot Detection** to enabled
3. Configure options:
   - **CAPTCHA Provider**: Auth0 uses CAPTCHA challenges (powered by reCAPTCHA or similar)
   - **Sensitivity**: Adjust based on your needs (higher = more challenges)

### How It Works

- Auth0 analyzes login requests for bot-like behavior
- Suspicious requests trigger a CAPTCHA challenge
- Legitimate users solve the CAPTCHA and continue
- Bots and scripts are blocked

### Test Bot Detection

1. Open your application and go to the login page
2. Try logging in rapidly with incorrect credentials
3. After several attempts, you should see a CAPTCHA challenge
4. Solve the CAPTCHA to continue

> **Note**: Bot detection may not trigger in development environments due to lower thresholds. It is more aggressive in production-tagged tenants.

---

## Step 2: Configure Brute-Force Protection

Brute-force protection blocks repeated failed login attempts for a specific user or IP address.

### Enable Brute-Force Protection

1. Go to **Security > Attack Protection > Brute-force Protection**
2. Toggle to enabled
3. Configure:

| Setting | Description | Recommended Value |
|---|---|---|
| **Max Attempts** | Failed logins before blocking | 10 |
| **Mode** | Count per identifier, per IP, or both | `count_per_identifier_and_ip` |
| **Block Duration** | How long the block lasts | Until admin unblock (or custom) |
| **Shields** | Actions to take when threshold is reached | `block`, `user_notification` |

### Via Management API

```bash
curl -s --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/attack-protection/brute-force-protection" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "enabled": true,
    "shields": ["block", "user_notification"],
    "mode": "count_per_identifier_and_ip",
    "max_attempts": 10,
    "allowlist": []
  }' | jq .
```

### Shields Explained

| Shield | Effect |
|---|---|
| `block` | Block the IP/user combination after threshold |
| `user_notification` | Send email to the user about blocked login attempts |
| `admin_notification` | Send email to tenant admins |

### Test Brute-Force Protection

1. Open your application login page
2. Enter a valid email but an incorrect password
3. Repeat 10+ times (or whatever your threshold is)
4. After exceeding the threshold, you should see an error: "Your account has been blocked after multiple consecutive login attempts"
5. Check the user's email for a notification
6. Check **Monitoring > Logs** for a `limit_wc` event

### Unblock a User

**Via Dashboard**:
1. Go to **User Management > Users**
2. Find the blocked user
3. Click **Unblock**

**Via Management API**:
```bash
# Unblock by IP
curl -s --request DELETE \
  --url "https://${AUTH0_DOMAIN}/api/v2/anomaly/blocks/ips/203.0.113.1" \
  --header "authorization: Bearer ${AUTH0_TOKEN}"
```

---

## Step 3: Configure Suspicious IP Throttling

Suspicious IP throttling detects and blocks traffic from IPs exhibiting unusual patterns.

### Enable Suspicious IP Throttling

1. Go to **Security > Attack Protection > Suspicious IP Throttling**
2. Toggle to enabled
3. Configure:

| Setting | Description | Recommended |
|---|---|---|
| **Pre-Login Stage** | Throttle login attempts from suspicious IPs | Max 100 attempts / 864000 sec (10 days) |
| **Pre-Registration Stage** | Throttle signup attempts from suspicious IPs | Max 50 attempts / 1200 sec (20 min) |
| **Shields** | Actions when threshold is hit | `admin_notification`, `block` |
| **Allow-list** | IPs excluded from throttling | Office IPs, VPN ranges |

### Via Management API

```bash
curl -s --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/attack-protection/suspicious-ip-throttling" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "enabled": true,
    "shields": ["admin_notification", "block"],
    "stage": {
      "pre-login": {
        "max_attempts": 100,
        "rate": 864000
      },
      "pre-user-registration": {
        "max_attempts": 50,
        "rate": 1200
      }
    },
    "allowlist": ["203.0.113.0/24", "198.51.100.0/24"]
  }' | jq .
```

### Add Trusted IPs to Allow-List

```bash
# Read current configuration
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/attack-protection/suspicious-ip-throttling" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .

# Update allow-list
curl -s --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/attack-protection/suspicious-ip-throttling" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "allowlist": [
      "203.0.113.0/24",
      "198.51.100.0/24",
      "10.0.0.0/8"
    ]
  }'
```

---

## Step 4: Configure Breached Password Detection

Breached password detection checks user passwords against databases of known compromised credentials.

### Enable Breached Password Detection

1. Go to **Security > Attack Protection > Breached Password Detection**
2. Toggle to enabled
3. Configure detection stages:

| Stage | When It Checks | Recommended Action |
|---|---|---|
| **Sign-up** | New user creates account with breached password | Block |
| **Login** | Existing user logs in with breached password | Admin notification + User notification |
| **Password Change** | User changes to a breached password | Block |

### Via Management API

```bash
curl -s --request PATCH \
  --url "https://${AUTH0_DOMAIN}/api/v2/attack-protection/breached-password-detection" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --header 'content-type: application/json' \
  --data '{
    "enabled": true,
    "shields": ["admin_notification", "block"],
    "admin_notification_frequency": ["immediately", "daily"],
    "method": "standard",
    "stage": {
      "pre-user-registration": {
        "shields": ["block"]
      }
    }
  }' | jq .
```

### Handle Breached Password in Your App

When a breached password is detected, Auth0 returns an error in the callback:

```javascript
// Handle the error in your app
if (error === 'access_denied' && error_description === 'password_leaked') {
  // Show a user-friendly message
  alert('Your password was found in a data breach. Please reset your password for security.');
  // Redirect to password reset
  window.location.href = '/reset-password';
}
```

### Test Breached Password Detection

1. Try to register or log in with a commonly breached password (e.g., `password123`, `123456789`)
2. Auth0 should block the attempt
3. Check **Monitoring > Logs** for a `pwd_leak` event

> **Note**: Auth0's breach database is updated regularly. Very common passwords like "password" or "123456" are typically in the database.

---

## Step 5: Set Up Security Alerts

### Email Notifications

Auth0 sends email notifications for security events. Configure the recipients:

1. Go to **Settings > General**
2. Under **Notifications**, add admin email addresses
3. These admins receive alerts for:
   - Brute-force blocks
   - Breached passwords
   - Suspicious IP activity
   - Rate limit violations

### Log Stream for Real-Time Monitoring

For production environments, set up a log stream to a SIEM or monitoring tool:

1. Go to **Monitoring > Streams**
2. Click **+ Create Stream**
3. Choose your destination:
   - **Datadog**: Real-time dashboards and alerts
   - **Splunk**: Enterprise SIEM
   - **Custom Webhook**: Any HTTP endpoint
4. Configure filters to stream security events:
   - `f` -- Failed logins
   - `limit_wc` -- Blocked accounts
   - `pwd_leak` -- Breached passwords
   - `fcoa` -- Failed cross-origin authentication

### Example: Custom Webhook for Security Events

1. Create a Webhook log stream
2. Enter your endpoint URL: `https://your-siem.example.com/auth0/events`
3. Add an authorization token
4. Filter for security-relevant events

Your webhook will receive payloads like:

```json
{
  "log_id": "90020241015...",
  "data": {
    "type": "limit_wc",
    "description": "Blocked Account",
    "ip": "203.0.113.42",
    "user_id": "auth0|123",
    "user_name": "alice@example.com",
    "date": "2026-03-15T10:30:00.000Z",
    "details": {
      "attempts": 15
    }
  }
}
```

---

## Step 6: Review Current Protection Settings

Get a complete view of your attack protection configuration:

```bash
echo "=== Bot Detection ==="
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/attack-protection/suspicious-ip-throttling" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .

echo ""
echo "=== Brute Force Protection ==="
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/attack-protection/brute-force-protection" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .

echo ""
echo "=== Breached Password Detection ==="
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/attack-protection/breached-password-detection" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" | jq .
```

---

## Step 7: Attack Protection with Actions

For custom attack protection logic, use a post-login Action:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Block logins from Tor exit nodes (example)
  const torExitNodes = await fetchTorExitNodes(); // your implementation
  if (torExitNodes.includes(event.request.ip)) {
    api.access.deny('tor_blocked', 'Logins from Tor are not permitted.');
    return;
  }

  // Block logins outside business hours (example for internal apps)
  const hour = new Date().getUTCHours();
  if (event.client.name === 'Internal Admin' && (hour < 6 || hour > 22)) {
    api.access.deny('outside_hours', 'This application is only available during business hours.');
    return;
  }

  // Rate limit by user (custom logic beyond Auth0's built-in)
  const loginCount = event.stats.logins_count;
  const lastLogin = new Date(event.user.last_login);
  const now = new Date();
  const minutesSinceLastLogin = (now - lastLogin) / 60000;

  if (minutesSinceLastLogin < 1) {
    console.warn(`Rapid re-login detected for ${event.user.email}`);
    // Optionally trigger MFA for suspicious rapid logins
    api.multifactor.enable('any', { allowRememberBrowser: false });
  }
};
```

---

## Validation Checklist

- [ ] Bot detection enabled
- [ ] Brute-force protection enabled with appropriate thresholds
- [ ] Brute-force block tested (exceeded threshold, saw block message)
- [ ] Blocked user unblocked via dashboard or API
- [ ] Suspicious IP throttling enabled with allow-list
- [ ] Breached password detection enabled for signup, login, and password change
- [ ] Breached password tested (attempted login with known breached password)
- [ ] Admin notification emails configured
- [ ] Security events visible in Monitoring > Logs
- [ ] Log stream configured for production monitoring (optional)

---

## Troubleshooting

### Brute-Force Protection Not Triggering

**Cause**: Threshold too high, or tenant is in development mode with relaxed limits.

**Fix**: Lower the max attempts for testing. Check the tenant environment tag (development vs production).

### Users Getting Blocked Unexpectedly

**Cause**: Shared IP address (e.g., corporate NAT) causing multiple users' failed attempts to count as one IP.

**Fix**: Add the corporate IP range to the allow-list. Switch brute-force mode to `count_per_identifier` instead of `count_per_identifier_and_ip`.

### Breached Password Detection Not Working

**Cause**: Feature not enabled for the relevant stage, or the password is not in Auth0's breach database.

**Fix**: Ensure detection is enabled for all three stages. Test with a very common password like `password123`.

### CAPTCHA Not Appearing

**Cause**: Bot detection sensitivity too low, or running in a development environment.

**Fix**: Increase sensitivity. Test in an incognito window. Bot detection is more aggressive on production-tagged tenants.

### Allow-List Not Working

**Cause**: IP format incorrect (not using CIDR notation) or the IP is behind a proxy.

**Fix**: Use CIDR notation (e.g., `203.0.113.0/24`). If behind a proxy, ensure the real client IP is being forwarded.

---

## Summary

You have now configured a comprehensive security layer for your Auth0 tenant:

1. **Bot Detection** -- Automated CAPTCHA for suspected bots
2. **Brute-Force Protection** -- Account lockout after repeated failures
3. **Suspicious IP Throttling** -- Rate limiting for suspicious IPs
4. **Breached Password Detection** -- Protection against known compromised credentials
5. **Monitoring** -- Log streams and email alerts for security events

These features work together to provide defense-in-depth against common identity attacks. For production environments, combine these built-in features with custom Actions for application-specific security logic.
