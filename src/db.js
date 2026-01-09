const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/estimator3';

const pool = new Pool({ connectionString });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      email_verification_token TEXT,
      email_verification_expires TIMESTAMPTZ,
      reset_token TEXT,
      reset_token_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(email_verification_token);
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

    CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR(255) PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMPTZ NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      billing_email TEXT,
      billing_address TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('estimate', 'invoice')),
      po_number TEXT UNIQUE,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_billing_email TEXT,
      client_phone TEXT,
      client_billing_address TEXT,
      project_name TEXT,
      service_address TEXT,
      line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'draft',
      due_date DATE,
      valid_until DATE,
      notes TEXT,
      sent_via TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Add share_token column if it doesn't exist (migration for existing databases)
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='documents' AND column_name='share_token'
      ) THEN
        ALTER TABLE documents ADD COLUMN share_token TEXT;
        CREATE UNIQUE INDEX idx_documents_share_token ON documents(share_token);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      default_qty NUMERIC(12,2) DEFAULT 1,
      default_rate NUMERIC(12,2) DEFAULT 0,
      default_markup NUMERIC(6,2) DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Add category column to items if it doesn't exist (migration for existing databases)
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='items' AND column_name='category'
      ) THEN
        ALTER TABLE items ADD COLUMN category TEXT;
        CREATE INDEX idx_items_category ON items(category);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      default_qty NUMERIC(12,2) DEFAULT 1,
      default_rate NUMERIC(12,2) DEFAULT 0,
      default_markup NUMERIC(6,2) DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Add category column to materials if it doesn't exist (migration for existing databases)
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='materials' AND column_name='category'
      ) THEN
        ALTER TABLE materials ADD COLUMN category TEXT;
        CREATE INDEX idx_materials_category ON materials(category);
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      amount NUMERIC(12,2) NOT NULL,
      payment_method TEXT NOT NULL,
      check_number TEXT,
      payment_date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS company_settings (
      id SERIAL PRIMARY KEY,
      name TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      logo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Singleton pattern: ensure only one row exists
    INSERT INTO company_settings (id, name, address, phone, email, logo)
    VALUES (1, '', '', '', '', NULL)
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS payment_methods (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      qr_code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

const toCamel = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      value,
    ]),
  );

module.exports = {
  pool,
  initDb,
  toCamel,
};
