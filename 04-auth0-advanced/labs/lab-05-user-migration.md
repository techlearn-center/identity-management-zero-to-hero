# Lab 05: User Migration

## Objectives

By the end of this lab you will be able to:

- Implement automatic (trickle) migration using custom database scripts
- Perform bulk user import via the Management API
- Handle different password hashing algorithms during migration
- Monitor migration progress
- Choose the right migration strategy for your scenario

## Prerequisites

- Completed Module 03 labs
- Auth0 tenant with Management API access (M2M application)
- Python 3.8+ installed (for the bulk import script)
- `curl` and `jq` installed

## Estimated Time

40-50 minutes

---

## Step 1: Understand Migration Strategies

### Automatic (Trickle) Migration

- Users migrate transparently when they log in
- Auth0 calls your custom database scripts to validate credentials
- On success, Auth0 creates a local copy of the user
- Subsequent logins use Auth0's database
- Best for: gradual migration with no downtime

### Bulk Import

- Export all users from your legacy system
- Import via the Management API's jobs endpoint
- Users cannot log in with their old password (must reset)
- Best for: fast, predictable migration timeline

### Hybrid Approach

- Bulk import user profiles (without passwords)
- Use custom database scripts for password validation
- Users log in with existing passwords, Auth0 migrates the hash
- Best when you need all users imported immediately but want seamless password migration

---

## Step 2: Set Up Automatic Migration

### Create a Custom Database Connection

1. Go to **Authentication > Database** in the Auth0 Dashboard
2. Click **+ Create DB Connection**
3. Name: `Legacy-DB-Migration`
4. Click **Create**
5. Go to the **Custom Database** tab
6. Toggle **Use my own database** to enabled
7. Toggle **Import Users to Auth0** to enabled

> **Important**: "Import Users to Auth0" is what makes this an automatic migration. Without it, Auth0 would always call your custom scripts (proxy mode).

### Configure the Login Script

Click **Login** under Database Action Scripts and replace with:

```javascript
/**
 * Login Script - Automatic Migration
 *
 * This script validates user credentials against your legacy database.
 * When "Import Users to Auth0" is enabled, a successful login will
 * create a local copy of the user in Auth0, and subsequent logins
 * will use Auth0's database directly.
 *
 * @param {string} email    - The user's email address
 * @param {string} password - The user's password (plaintext)
 * @param {function} callback - Callback with (error, userProfile)
 */
async function login(email, password, callback) {
  const axios = require('axios');
  const bcrypt = require('bcrypt');

  try {
    // Option 1: Validate against a legacy API
    const response = await axios.post('https://legacy-api.your-company.com/auth/validate', {
      email: email,
      password: password
    }, {
      headers: { 'X-API-Key': configuration.LEGACY_API_KEY },
      timeout: 5000
    });

    if (response.data.valid) {
      return callback(null, {
        user_id: response.data.user_id.toString(),
        email: response.data.email,
        name: response.data.name,
        nickname: response.data.nickname || response.data.email.split('@')[0],
        email_verified: response.data.email_verified || false,
        // Include any metadata you want to migrate
        app_metadata: {
          legacy_id: response.data.user_id,
          migrated_at: new Date().toISOString(),
          migration_source: 'automatic'
        },
        user_metadata: {
          preferred_language: response.data.language || 'en'
        }
      });
    }

    return callback(new WrongUsernameOrPasswordError(email));

  } catch (error) {
    if (error.response && error.response.status === 401) {
      return callback(new WrongUsernameOrPasswordError(email));
    }

    // Option 2: Validate against a legacy database directly
    // (Only use if your Auth0 tenant can reach the database)
    /*
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: configuration.DB_HOST,
      user: configuration.DB_USER,
      password: configuration.DB_PASSWORD,
      database: configuration.DB_NAME
    });

    const [rows] = await connection.execute(
      'SELECT id, email, password_hash, name, email_verified FROM users WHERE email = ?',
      [email]
    );

    await connection.end();

    if (rows.length === 0) {
      return callback(new WrongUsernameOrPasswordError(email));
    }

    const user = rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return callback(new WrongUsernameOrPasswordError(email));
    }

    return callback(null, {
      user_id: user.id.toString(),
      email: user.email,
      name: user.name,
      email_verified: !!user.email_verified
    });
    */

    return callback(new Error('Legacy authentication service unavailable'));
  }
}
```

### Configure the Get User Script

Click **Get User** and replace with:

```javascript
/**
 * Get User Script - Automatic Migration
 *
 * Called during password reset and email verification flows.
 * Looks up a user in the legacy database by email.
 *
 * @param {string} email - The user's email address
 * @param {function} callback - Callback with (error, userProfile)
 */
async function getUser(email, callback) {
  const axios = require('axios');

  try {
    const response = await axios.get('https://legacy-api.your-company.com/users', {
      params: { email: email },
      headers: { 'X-API-Key': configuration.LEGACY_API_KEY },
      timeout: 5000
    });

    if (response.data && response.data.email) {
      return callback(null, {
        user_id: response.data.user_id.toString(),
        email: response.data.email,
        name: response.data.name,
        nickname: response.data.nickname || response.data.email.split('@')[0],
        email_verified: response.data.email_verified || false
      });
    }

    // User not found in legacy system
    return callback(null);

  } catch (error) {
    if (error.response && error.response.status === 404) {
      return callback(null); // User not found
    }
    return callback(new Error('Legacy user lookup service unavailable'));
  }
}
```

### Add Configuration Variables

1. In the Custom Database settings, scroll to **Settings**
2. Add configuration values:
   - `LEGACY_API_KEY`: Your legacy API authentication key
   - `DB_HOST`: Legacy database host (if using direct DB access)
   - `DB_USER`: Database username
   - `DB_PASSWORD`: Database password
   - `DB_NAME`: Database name

### Enable the Connection

1. Go to the **Applications** tab of the `Legacy-DB-Migration` connection
2. Enable it for your application
3. Click **Save**

---

## Step 3: Test Automatic Migration

1. Create a test user in your legacy system (or mock API)
2. Log in to your Auth0 application using that user's credentials
3. Auth0 should:
   - Call the Login script
   - Validate credentials against the legacy system
   - Create a local copy of the user in Auth0
4. Check **User Management > Users** -- the user should appear with:
   - Connection: `Legacy-DB-Migration`
   - app_metadata containing `migrated_at` and `legacy_id`
5. Log out and log in again -- this time Auth0 uses its own database (no custom script call)

### Monitor Migration Progress

Track how many users have migrated:

```bash
# Count users in the legacy migration connection
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/users?q=identities.connection%3A%22Legacy-DB-Migration%22&search_engine=v3&include_totals=true" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  | jq '.total'
```

---

## Step 4: Perform Bulk Import

### Prepare the Import File

Create a JSON file with users to import. The format must follow Auth0's user import schema:

```json
[
  {
    "email": "bulk-user-1@example.com",
    "email_verified": true,
    "name": "Bulk User One",
    "nickname": "bulk1",
    "app_metadata": {
      "legacy_id": "1001",
      "migrated_at": "2026-03-15T00:00:00Z",
      "migration_source": "bulk"
    },
    "user_metadata": {
      "preferred_language": "en"
    }
  },
  {
    "email": "bulk-user-2@example.com",
    "email_verified": true,
    "name": "Bulk User Two",
    "nickname": "bulk2",
    "password_hash": "$2b$10$abc123...",
    "custom_password_hash": {
      "algorithm": "bcrypt",
      "hash": {
        "value": "$2b$10$abc123..."
      }
    },
    "app_metadata": {
      "legacy_id": "1002",
      "migrated_at": "2026-03-15T00:00:00Z",
      "migration_source": "bulk"
    }
  }
]
```

### Import via Management API

```bash
# Get the connection ID
CONNECTION_ID=$(curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/connections" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  | jq -r '.[] | select(.name == "Username-Password-Authentication") | .id')

# Start the import job
curl -s --request POST \
  --url "https://${AUTH0_DOMAIN}/api/v2/jobs/users-imports" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  --form "users=@users-import.json" \
  --form "connection_id=${CONNECTION_ID}" \
  --form "upsert=false" \
  --form "send_completion_email=true" \
  | jq .
```

### Check Import Job Status

```bash
JOB_ID="job_abc123"  # From the import response

curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/jobs/${JOB_ID}" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  | jq .
```

### Import Job Errors

```bash
curl -s --request GET \
  --url "https://${AUTH0_DOMAIN}/api/v2/jobs/${JOB_ID}/errors" \
  --header "authorization: Bearer ${AUTH0_TOKEN}" \
  | jq .
```

---

## Step 5: Use the Python Bulk Import Script

See `migrations/bulk-import-script.py` in the module directory for a complete Python script that:

1. Reads users from a CSV or JSON file
2. Formats them per Auth0's import schema
3. Handles password hash conversion
4. Submits the import job via the Management API
5. Monitors the job until completion
6. Reports errors

### Run the Script

```bash
cd ../migrations

# Install dependencies
pip install requests

# Set environment variables
export AUTH0_DOMAIN="your-tenant.us.auth0.com"
export AUTH0_M2M_CLIENT_ID="your-m2m-client-id"
export AUTH0_M2M_CLIENT_SECRET="your-m2m-client-secret"
export AUTH0_CONNECTION_ID="con_abc123"

# Run with a sample CSV
python bulk-import-script.py --input users.csv --format csv

# Or with JSON
python bulk-import-script.py --input users.json --format json
```

---

## Step 6: Password Hash Migration

### Supported Hash Algorithms for Import

Auth0 supports importing users with pre-hashed passwords:

| Algorithm | Format | Notes |
|---|---|---|
| bcrypt | `$2b$10$...` | Direct import, no script needed |
| PBKDF2 | See Auth0 docs | Supported with proper parameters |
| SHA-256 | Hex or Base64 | Requires `custom_password_hash` |
| SHA-512 | Hex or Base64 | Requires `custom_password_hash` |
| Argon2 | See Auth0 docs | Supported with proper parameters |
| MD5 | Hex | Supported but highly insecure |

### Example: Importing bcrypt Hashes

```json
{
  "email": "user@example.com",
  "custom_password_hash": {
    "algorithm": "bcrypt",
    "hash": {
      "value": "$2b$10$eByL.YhKMo7lqBJSNbIFbOZaiRGcBXEXcJGKa8gYpf7ia75.1Gf4q"
    }
  }
}
```

### Example: Importing PBKDF2 Hashes

```json
{
  "email": "user@example.com",
  "custom_password_hash": {
    "algorithm": "pbkdf2",
    "hash": {
      "value": "base64-encoded-hash",
      "encoding": "base64"
    },
    "salt": {
      "value": "base64-encoded-salt",
      "encoding": "base64",
      "position": "prefix"
    },
    "password": {
      "encoding": "utf8"
    },
    "iterations": 100000,
    "keyLength": 64,
    "digest": "sha512"
  }
}
```

---

## Validation Checklist

- [ ] Custom database connection created with "Import Users to Auth0" enabled
- [ ] Login script validates credentials against legacy system
- [ ] Get User script looks up users by email
- [ ] Automatic migration tested: user logs in, migrated to Auth0
- [ ] Migrated user appears in User Management with correct metadata
- [ ] Subsequent logins use Auth0's database (no custom script call)
- [ ] Bulk import file prepared with correct schema
- [ ] Bulk import job submitted and completed
- [ ] Import errors reviewed and addressed
- [ ] Password hash migration understood for your legacy system

---

## Troubleshooting

### Login Script Returns "Wrong credentials"

**Cause**: Legacy API not reachable or returning unexpected response.

**Fix**: Test the legacy API endpoint independently. Check configuration variables. Use `console.log()` in the script for debugging (visible in Auth0 logs).

### Users Not Migrating (Still Calling Custom Script)

**Cause**: "Import Users to Auth0" not enabled on the connection.

**Fix**: Go to the connection settings > Custom Database tab > Enable "Import Users to Auth0."

### Bulk Import Job Fails

**Cause**: JSON format does not match Auth0's schema, or connection ID is wrong.

**Fix**: Validate the JSON against the Auth0 import schema. Verify the connection ID. Check job errors via the API.

### Password Hash Not Accepted

**Cause**: Hash algorithm or format not supported or incorrectly specified.

**Fix**: Review Auth0's documentation on supported hash algorithms. Ensure the `custom_password_hash` object has the correct structure.

### Duplicate Users During Migration

**Cause**: User exists in both the custom database and Auth0.

**Fix**: Use the `upsert: true` flag in bulk imports to update existing users. For automatic migration, Auth0 handles deduplication by email.

---

## Next Lab

Proceed to [Lab 06: Attack Protection](lab-06-attack-protection.md) to configure security features for your Auth0 tenant.
