const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/estimator3';

const pool = new Pool({ connectionString });

async function initDb() {
  await pool.query(`
    -- ============================================================
    -- AUTHENTICATION TABLES
    -- ============================================================

    -- Create users table
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

    -- Create sessions table for express-session (connect-pg-simple)
    CREATE TABLE IF NOT EXISTS sessions (
      sid VARCHAR(255) PRIMARY KEY,
      sess JSON NOT NULL,
      expire TIMESTAMPTZ NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

    -- ============================================================
    -- LEGACY SCHEMA UPDATES
    -- ============================================================

    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name='documents' AND constraint_type='UNIQUE' AND constraint_name='documents_po_number_key'
      ) THEN
        ALTER TABLE documents DROP CONSTRAINT documents_po_number_key;
      END IF;
    END$$;

    ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS service_address TEXT,
      ADD COLUMN IF NOT EXISTS client_billing_email TEXT,
      ADD COLUMN IF NOT EXISTS client_billing_address TEXT,
      ADD COLUMN IF NOT EXISTS valid_until DATE,
      ADD COLUMN IF NOT EXISTS po_number TEXT,
      ADD COLUMN IF NOT EXISTS client_phone TEXT,
      ADD COLUMN IF NOT EXISTS converted_from_estimate BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid() UNIQUE,
      ADD COLUMN IF NOT EXISTS payment_status TEXT;

    -- Migrate existing invoices: move payment statuses from status to payment_status
    -- First, handle invoices with payment statuses in the status field
    UPDATE documents
    SET payment_status = CASE
        WHEN status = 'paid' THEN 'paid'
        WHEN status = 'unpaid' THEN 'unpaid'
        WHEN status = 'partial' THEN 'partial'
        ELSE payment_status
      END,
      status = CASE
        WHEN status IN ('paid', 'unpaid', 'partial') THEN 'sent'
        ELSE status
      END
    WHERE type = 'invoice' AND status IN ('paid', 'unpaid', 'partial');

    -- Set default payment_status for invoices that don't have one
    UPDATE documents
    SET payment_status = 'unpaid'
    WHERE type = 'invoice' AND payment_status IS NULL;

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

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      default_qty NUMERIC(12,2) DEFAULT 1,
      default_rate NUMERIC(12,2) DEFAULT 0,
      default_markup NUMERIC(6,2) DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      default_qty NUMERIC(12,2) DEFAULT 1,
      default_rate NUMERIC(12,2) DEFAULT 0,
      default_markup NUMERIC(6,2) DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

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

    CREATE TABLE IF NOT EXISTS document_views (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT,
      referrer TEXT,
      client_info JSONB DEFAULT '{}'::jsonb
    );

    CREATE INDEX IF NOT EXISTS idx_document_views_document_id ON document_views(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_views_viewed_at ON document_views(viewed_at DESC);

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('document_viewed', 'payment_received', 'status_changed')),
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_document_id ON notifications(document_id);

    CREATE TABLE IF NOT EXISTS company_settings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      logo TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id SERIAL PRIMARY KEY,
      method_name TEXT NOT NULL,
      payment_url TEXT,
      qr_code_url TEXT,
      display_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- ============================================================
    -- ADD user_id COLUMNS FOR DATA ISOLATION
    -- ============================================================

    -- Add user_id to all data tables
    ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE items ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

    -- Create indexes for user_id columns (performance)
    CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
    CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
    CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON company_settings(user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
  `);

  // Clear existing data AFTER all tables are created (fresh start as requested)
  // Only run this once - you can comment it out after the first run
  // COMMENTED OUT: Data should now persist between server restarts
  /*
  try {
    await pool.query('TRUNCATE TABLE documents, clients, items, materials, payments, document_views, notifications, company_settings, payment_methods CASCADE');
    console.log('✓ Existing data cleared');
  } catch (err) {
    // Ignore error if tables don't exist yet or are already empty
    console.log('Note: Data clearing skipped (tables may be new)');
  }
  */
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
