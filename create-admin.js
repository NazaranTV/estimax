// Script to create admin user in Railway PostgreSQL
// Only load .env for local development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createAdminUser() {
  try {
    console.log('Creating admin user...');

    // Hash the password "admin"
    const passwordHash = await bcrypt.hash('admin', 10);

    // Insert admin user
    const result = await pool.query(`
      INSERT INTO users (email, password_hash, email_verified, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE
      SET password_hash = $2, updated_at = NOW()
      RETURNING id, email;
    `, ['admin@admin.com', passwordHash, true]);

    console.log('✓ Admin user created successfully!');
    console.log('  Email: admin@admin.com');
    console.log('  Password: admin');
    console.log('  User ID:', result.rows[0].id);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error creating admin user:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createAdminUser();
