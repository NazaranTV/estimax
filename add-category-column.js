require('dotenv').config();
const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/estimator3';

const pool = new Pool({ connectionString });

async function addCategoryColumn() {
  const client = await pool.connect();
  try {
    // Add category column to items table if it doesn't exist
    await client.query(`
      ALTER TABLE items
      ADD COLUMN IF NOT EXISTS category TEXT;
    `);
    console.log('✓ Added category column to items table');

    // Add category column to materials table if it doesn't exist
    await client.query(`
      ALTER TABLE materials
      ADD COLUMN IF NOT EXISTS category TEXT;
    `);
    console.log('✓ Added category column to materials table');

    console.log('\n✓ Migration completed successfully!');
  } catch (err) {
    console.error('Error adding category columns:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addCategoryColumn();
