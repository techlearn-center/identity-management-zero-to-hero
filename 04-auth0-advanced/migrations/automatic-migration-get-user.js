/**
 * Auth0 Custom Database Script: Get User
 * Called during password reset to check if user exists in legacy DB.
 */
async function getByEmail(email, callback) {
  const { Client } = require("pg");

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
      "SELECT id, email, first_name, last_name FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true",
      [email]
    );

    if (result.rows.length === 0) {
      return callback(null);
    }

    const user = result.rows[0];
    return callback(null, {
      user_id: `legacy|${user.id}`,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      email_verified: true,
    });
  } catch (err) {
    return callback(err);
  } finally {
    await client.end();
  }
}
