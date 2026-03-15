/**
 * Auth0 Custom Database Script: Login
 * Used for automatic user migration from legacy PostgreSQL database.
 *
 * Configuration variables needed:
 *   LEGACY_DB_HOST, LEGACY_DB_NAME, LEGACY_DB_USER, LEGACY_DB_PASSWORD
 */
async function login(email, password, callback) {
  const { Client } = require("pg");
  const bcrypt = require("bcrypt");

  const client = new Client({
    host: configuration.LEGACY_DB_HOST,
    port: configuration.LEGACY_DB_PORT || 5432,
    database: configuration.LEGACY_DB_NAME,
    user: configuration.LEGACY_DB_USER,
    password: configuration.LEGACY_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query(
      `SELECT id, email, password_hash, first_name, last_name, department, role
       FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true`,
      [email]
    );

    if (result.rows.length === 0) {
      return callback(new WrongUsernameOrPasswordError(email));
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return callback(new WrongUsernameOrPasswordError(email));
    }

    return callback(null, {
      user_id: `legacy|${user.id}`,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      given_name: user.first_name,
      family_name: user.last_name,
      email_verified: true,
      app_metadata: {
        legacy_id: user.id,
        department: user.department,
        role: user.role,
        migrated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    return callback(err);
  } finally {
    await client.end();
  }
}
