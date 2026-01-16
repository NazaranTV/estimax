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

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

    -- Add approval_status and approved_at columns to documents if they don't exist
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='documents' AND column_name='approval_status'
      ) THEN
        ALTER TABLE documents ADD COLUMN approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'declined'));
        ALTER TABLE documents ADD COLUMN approved_at TIMESTAMPTZ;
        ALTER TABLE documents ADD COLUMN declined_at TIMESTAMPTZ;
        ALTER TABLE documents ADD COLUMN customer_notes TEXT;
      END IF;
    END $$;

    -- Ensure all existing documents have a valid approval_status
    UPDATE documents SET approval_status = 'pending' WHERE approval_status IS NULL;

    -- Add slot_time_end column to availability_slots if it doesn't exist
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='availability_slots') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name='availability_slots' AND column_name='slot_time_end') THEN
          ALTER TABLE availability_slots ADD COLUMN slot_time_end TEXT;
        END IF;
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS availability_slots (
      id SERIAL PRIMARY KEY,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      slot_date DATE NOT NULL,
      slot_time TEXT NOT NULL,
      slot_time_end TEXT,
      is_booked BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_availability_slots_document ON availability_slots(document_id);
    CREATE INDEX IF NOT EXISTS idx_availability_slots_date ON availability_slots(slot_date);

    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      po_number TEXT,
      client_name TEXT NOT NULL,
      client_email TEXT,
      client_phone TEXT,
      service_address TEXT,
      appointment_date DATE NOT NULL,
      appointment_time TEXT NOT NULL,
      duration_hours NUMERIC(4,2) DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_appointments_document ON appointments(document_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
    CREATE INDEX IF NOT EXISTS idx_appointments_po ON appointments(po_number);

    -- Add new calendar event fields if they don't exist
    DO $$
    BEGIN
      -- Add event_type column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='appointments' AND column_name='event_type'
      ) THEN
        ALTER TABLE appointments ADD COLUMN event_type TEXT DEFAULT 'appointment' CHECK (event_type IN ('appointment', 'holiday', 'task', 'reminder', 'personal'));
      END IF;

      -- Add title column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='appointments' AND column_name='title'
      ) THEN
        ALTER TABLE appointments ADD COLUMN title TEXT;
      END IF;

      -- Add description column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='appointments' AND column_name='description'
      ) THEN
        ALTER TABLE appointments ADD COLUMN description TEXT;
      END IF;

      -- Add location column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='appointments' AND column_name='location'
      ) THEN
        ALTER TABLE appointments ADD COLUMN location TEXT;
      END IF;

      -- Add all_day column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='appointments' AND column_name='all_day'
      ) THEN
        ALTER TABLE appointments ADD COLUMN all_day BOOLEAN DEFAULT FALSE;
      END IF;

      -- Add end_time column
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='appointments' AND column_name='end_time'
      ) THEN
        ALTER TABLE appointments ADD COLUMN end_time TEXT;
      END IF;

      -- Make client_name nullable for non-appointment events
      ALTER TABLE appointments ALTER COLUMN client_name DROP NOT NULL;
    END $$;

    -- Create index on event_type for filtering
    CREATE INDEX IF NOT EXISTS idx_appointments_event_type ON appointments(event_type);
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
