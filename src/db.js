const mysql = require('mysql2/promise');

const connectionString =
  process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/estimator3';

// Parse MySQL connection string
const parseConnectionString = (connStr) => {
  try {
    console.log('[db.js] Parsing connection string...');
    const url = new URL(connStr);
    const config = {
      host: url.hostname,
      port: url.port || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    };
    console.log('[db.js] Config parsed:', {
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database
    });
    return config;
  } catch (err) {
    console.error('[db.js] ERROR: Invalid DATABASE_URL format');
    console.error('[db.js] Error:', err.message);
    console.error('[db.js] Expected format: mysql://user:pass@host:port/database');
    throw err;
  }
};

console.log('[db.js] Creating MySQL connection pool...');
const pool = mysql.createPool(parseConnectionString(connectionString));
console.log('[db.js] Pool created successfully');

async function initDb() {
  const connection = await pool.getConnection();

  try {
    // ============================================================
    // AUTHENTICATION TABLES
    // ============================================================

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        email_verification_token VARCHAR(255),
        email_verification_expires DATETIME,
        reset_token VARCHAR(255),
        reset_token_expires DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login_at DATETIME,
        INDEX idx_users_email (email),
        INDEX idx_users_verification_token (email_verification_token),
        INDEX idx_users_reset_token (reset_token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Create sessions table for express-mysql-session
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(128) PRIMARY KEY,
        expires INT UNSIGNED NOT NULL,
        data MEDIUMTEXT,
        INDEX idx_sessions_expires (expires)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name TEXT NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        company TEXT,
        billing_email VARCHAR(255),
        billing_address TEXT,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_clients_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        type VARCHAR(50) NOT NULL CHECK (type IN ('estimate', 'invoice')),
        po_number VARCHAR(100),
        client_id INT,
        client_name TEXT NOT NULL,
        client_email VARCHAR(255),
        client_billing_email VARCHAR(255),
        client_phone VARCHAR(50),
        client_billing_address TEXT,
        project_name TEXT,
        service_address TEXT,
        line_items JSON NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'draft',
        due_date DATE,
        valid_until DATE,
        notes TEXT,
        sent_via VARCHAR(50),
        sent_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        converted_from_estimate BOOLEAN DEFAULT FALSE,
        share_token VARCHAR(36),
        payment_status VARCHAR(50),
        INDEX idx_documents_user_id (user_id),
        INDEX idx_documents_po_number (po_number),
        INDEX idx_documents_share_token (share_token),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add share_token for existing rows that don't have it
    await connection.query(`
      UPDATE documents
      SET share_token = UUID()
      WHERE share_token IS NULL
    `);

    // Migrate payment statuses from status to payment_status
    await connection.query(`
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
      WHERE type = 'invoice' AND status IN ('paid', 'unpaid', 'partial')
    `);

    // Set default payment_status for invoices
    await connection.query(`
      UPDATE documents
      SET payment_status = 'unpaid'
      WHERE type = 'invoice' AND payment_status IS NULL
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name TEXT NOT NULL,
        description TEXT,
        default_qty DECIMAL(12,2) DEFAULT 1,
        default_rate DECIMAL(12,2) DEFAULT 0,
        default_markup DECIMAL(6,2) DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_items_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name TEXT NOT NULL,
        description TEXT,
        default_qty DECIMAL(12,2) DEFAULT 1,
        default_rate DECIMAL(12,2) DEFAULT 0,
        default_markup DECIMAL(6,2) DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_materials_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_id INT,
        user_id INT,
        amount DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(100) NOT NULL,
        check_number VARCHAR(100),
        payment_date DATE NOT NULL,
        notes TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payments_user_id (user_id),
        INDEX idx_payments_document_id (document_id),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS document_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_id INT NOT NULL,
        viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(100),
        user_agent TEXT,
        referrer TEXT,
        client_info JSON,
        INDEX idx_document_views_document_id (document_id),
        INDEX idx_document_views_viewed_at (viewed_at),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        type VARCHAR(50) NOT NULL CHECK (type IN ('document_viewed', 'payment_received', 'status_changed')),
        document_id INT,
        title TEXT NOT NULL,
        message TEXT,
        metadata JSON,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_created_at (created_at),
        INDEX idx_notifications_is_read (is_read),
        INDEX idx_notifications_document_id (document_id),
        INDEX idx_notifications_user_id (user_id),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name TEXT NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        logo TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_company_settings_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        method_name VARCHAR(255) NOT NULL,
        payment_url TEXT,
        qr_code_url TEXT,
        display_url TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payment_methods_user_id (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ MySQL database schema ready');
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  } finally {
    connection.release();
  }
}

// MySQL query helper that returns results in format similar to pg
const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return { rows };
};

const toCamel = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      value,
    ]),
  );

module.exports = {
  pool: { query },
  initDb,
  toCamel,
};
