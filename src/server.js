// Only load .env for local development (Railway provides env vars directly)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

console.log('=== SERVER STARTING ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'SET' : 'NOT SET');

const express = require('express');
const path = require('path');
const cors = require('cors');
const { Resend } = require('resend');
const { pool, initDb, toCamel } = require('./db');
const { getMaterialData } = require('./priceScraperValueSerp');

const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Express app created');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Early health check before any DB dependencies
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running',
    env: {
      nodeEnv: process.env.NODE_ENV,
      port: PORT,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasSessionSecret: !!process.env.SESSION_SECRET
    }
  });
});

// Session middleware (MUST be before routes)
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

// MySQL session store options
const sessionStoreOptions = {
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 minutes
  expiration: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000,
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
};

// Get connection options from DATABASE_URL
const parseConnectionString = (connStr) => {
  try {
    console.log('Parsing DATABASE_URL...');
    const url = new URL(connStr || 'mysql://root:password@localhost:3306/estimator3');
    const config = {
      host: url.hostname,
      port: url.port || 3306,
      user: url.username,
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1)
    };
    console.log('Database config:', {
      host: config.host,
      port: config.port,
      user: config.user,
      database: config.database,
      passwordLength: config.password.length
    });
    return config;
  } catch (err) {
    console.error('Failed to parse DATABASE_URL:', err.message);
    throw new Error('Invalid DATABASE_URL format');
  }
};

let sessionStore;
try {
  console.log('Creating MySQL session store...');
  sessionStore = new MySQLStore(sessionStoreOptions, parseConnectionString(process.env.DATABASE_URL));
  console.log('✓ Session store created');
} catch (err) {
  console.error('✗ Failed to create session store:', err.message);
  process.exit(1);
}

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// Disable caching for development
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));

console.log('Initializing database...');
initDb()
  .then(() => {
    console.log('✓ Database ready');
  })
  .catch((err) => {
    console.error('✗ FATAL: Failed to initialize database');
    console.error('Error details:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  });

const sanitizeLineItems = (items = []) =>
  Array.isArray(items)
    ? items
        .map((item) => ({
          description: item.description?.toString().trim() || '',
          qty: Number(item.qty) || 0,
          rate: Number(item.rate) || 0,
          markup: Number(item.markup) || 0,
          notes: item.notes?.toString().trim() || '',
          photoData: item.photoData || '',
        }))
        .filter((item) => item.description || item.qty || item.rate)
    : [];

const computeTotals = (items, taxRate = 0) => {
  const subtotal = items.reduce((sum, item) => {
    const markup = Number(item.markup) || 0;
    return sum + ((item.qty * item.rate) + markup);
  }, 0);
  const rate = Number(taxRate) || 0;
  const total = subtotal + subtotal * (rate / 100);
  return { subtotal, total, taxRate: rate };
};

const generatePoNumber = async (type = 'estimate') => {
  const prefix = type === 'invoice' ? 'INV' : 'EST';

  // Get all existing PO numbers for this type
  const { rows } = await pool.query(
    'SELECT po_number FROM documents WHERE po_number LIKE ? ORDER BY po_number DESC LIMIT 1',
    [`${prefix}-%`]
  );

  // Extract the number from the last PO and increment
  let nextNum = 1;
  if (rows.length > 0) {
    const lastPo = rows[0].po_number;
    const match = lastPo.match(/\d+$/);
    if (match) {
      nextNum = parseInt(match[0], 10) + 1;
    }
  }

  // Pad with zeros (e.g., EST-001, EST-002)
  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
};

// Authentication routes
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');
app.use('/api/auth', authRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Debug endpoint to check invoice statuses
app.get('/api/debug/invoices', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, type, po_number, status, payment_status FROM documents WHERE type = ? LIMIT 10',
      ['invoice']
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents', requireAuth, async (req, res) => {
  try {
    const { type } = req.query;
    const params = [req.session.userId];
    let query = 'SELECT * FROM documents WHERE user_id = ?';
    if (type) {
      params.push(type);
      query += ' AND type = ?';
    }
    query += ' ORDER BY updated_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

app.get('/api/documents/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load document' });
  }
});

app.post('/api/documents', requireAuth, async (req, res) => {
  try {
    const {
      type,
      clientId,
      clientName,
      clientEmail,
      clientBillingEmail,
      clientPhone,
      clientBillingAddress,
      projectName,
      serviceAddress,
      lineItems,
      taxRate = 0,
      poNumber,
      notes,
      dueDate,
      validUntil,
      convertedFromEstimate = false,
    } = req.body;

    if (!type || !['estimate', 'invoice'].includes(type)) {
      return res.status(400).json({ error: 'type must be estimate or invoice' });
    }
    let resolvedClient = null;
    if (clientId) {
      const { rows } = await pool.query('SELECT * FROM clients WHERE id = ? AND user_id = ?', [clientId, req.session.userId]);
      resolvedClient = rows[0] || null;
    }

    const finalClientName = clientName || resolvedClient?.name;
    if (!finalClientName) return res.status(400).json({ error: 'clientName is required' });

    const items = sanitizeLineItems(lineItems);
    const totals = computeTotals(items, taxRate);
    const finalPo = poNumber || await generatePoNumber(type);

    const finalValidUntil =
      validUntil ||
      (type === 'estimate'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null);

    // Set default payment status for invoices
    const defaultPaymentStatus = type === 'invoice' ? 'unpaid' : null;

    const { rows } = await pool.query(
      `
      INSERT INTO documents (
        user_id, type, po_number, client_id, client_name, client_email, client_billing_email, client_phone, client_billing_address, project_name,
        service_address, line_items, subtotal, tax_rate, total, status, due_date, valid_until, notes, converted_from_estimate, payment_status, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?0,?1,?2,?3,?4,?5,?6,?7,?8,?9,?0,?1,NOW())
     
    `,
      [
        req.session.userId,
        type,
        finalPo,
        clientId || null,
        finalClientName,
        clientEmail || resolvedClient?.email || null,
        clientBillingEmail || resolvedClient?.billing_email || null,
        clientPhone || resolvedClient?.phone || null,
        clientBillingAddress || resolvedClient?.billing_address || null,
        projectName || null,
        serviceAddress || null,
        JSON.stringify(items),
        totals.subtotal,
        totals.taxRate,
        totals.total,
        'draft',
        dueDate || null,
        finalValidUntil || null,
        notes || null,
        convertedFromEstimate,
        defaultPaymentStatus,
      ],
    );

    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error('Save document error', err);
    res.status(500).json({ error: 'Failed to save document', detail: err.message });
  }
});

app.put('/api/documents/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const { rows: check } = await pool.query(
      'SELECT id FROM documents WHERE id = ? AND user_id = ?',
      [id, req.session.userId]
    );
    if (check.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const {
      type,
      clientId,
      clientName,
      clientEmail,
      clientBillingEmail,
      clientPhone,
      clientBillingAddress,
      projectName,
      serviceAddress,
      lineItems,
      taxRate = 0,
      poNumber,
      notes,
      dueDate,
      validUntil,
      status,
      paymentStatus,
    } = req.body;

    const items = Array.isArray(lineItems) ? sanitizeLineItems(lineItems) : null;
    const totals = items ? computeTotals(items, taxRate) : null;

    const { rows } = await pool.query(
      `
      UPDATE documents SET
        type = COALESCE(?, type),
        po_number = COALESCE(?, po_number),
        client_id = COALESCE(?, client_id),
        client_name = COALESCE(?, client_name),
        client_email = COALESCE(?, client_email),
        client_billing_email = COALESCE(?, client_billing_email),
        client_phone = COALESCE(?, client_phone),
        client_billing_address = COALESCE(?, client_billing_address),
        project_name = COALESCE(?, project_name),
        service_address = COALESCE(?0, service_address),
        line_items = COALESCE(?1, line_items),
        subtotal = COALESCE(?2, subtotal),
        tax_rate = COALESCE(?3, tax_rate),
        total = COALESCE(?4, total),
        status = COALESCE(?5, status),
        due_date = COALESCE(?6, due_date),
        valid_until = COALESCE(?7, valid_until),
        notes = COALESCE(?8, notes),
        payment_status = COALESCE(?9, payment_status),
        updated_at = NOW()
      WHERE id = ?0
     
    `,
      [
        type || null,
        poNumber || null,
        clientId || null,
        clientName || null,
        clientEmail || null,
        clientBillingEmail || null,
        clientPhone || null,
        clientBillingAddress || null,
        projectName || null,
        serviceAddress || null,
        items ? JSON.stringify(items) : null,
        totals ? totals.subtotal : null,
        totals ? totals.taxRate : null,
        totals ? totals.total : null,
        status || null,
        dueDate || null,
        validUntil || null,
        notes || null,
        paymentStatus || null,
        id,
      ],
    );

    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error('Update document error', err);
    res.status(500).json({ error: 'Failed to update document', detail: err.message });
  }
});

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount || 0);
};

// Helper function to build email HTML with link
const buildDocumentEmail = (doc) => {
  const viewUrl = `${process.env.PUBLIC_URL || 'http://localhost:3000'}/view/${doc.shareToken}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${doc.type === 'estimate' ? 'Estimate' : 'Invoice'} ${doc.poNumber}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f9fafb;">
      <div style="background: linear-gradient(135deg, #ff6b35 0%, #ff8555 100%); color: white; padding: 32px; border-radius: 12px; margin-bottom: 32px; text-align: center;">
        <h1 style="margin: 0 0 8px 0; font-size: 32px;">You've received a ${doc.type === 'estimate' ? 'new estimate' : 'new invoice'}</h1>
        <p style="margin: 0; font-size: 18px; opacity: 0.9;">${doc.poNumber}</p>
      </div>

      <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <p style="margin: 0 0 16px 0; font-size: 16px;">Hi ${doc.clientName},</p>
        <p style="margin: 0 0 24px 0; color: #6b7280;">
          ${doc.projectName ? `Your ${doc.type} for ${doc.projectName} is ready to view.` : `Your ${doc.type} is ready to view.`}
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${viewUrl}" style="display: inline-block; background: #ff6b35; color: white; padding: 16px 48px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 18px; box-shadow: 0 4px 6px rgba(255, 107, 53, 0.3);">
            View ${doc.type === 'estimate' ? 'Estimate' : 'Invoice'}
          </a>
        </div>

        <p style="margin: 24px 0 0 0; font-size: 14px; color: #9ca3af; text-align: center;">
          Or copy and paste this link into your browser:<br>
          <a href="${viewUrl}" style="color: #ff6b35; word-break: break-all;">${viewUrl}</a>
        </p>
      </div>

      ${doc.type === 'invoice' && doc.dueDate ? `
      <div style="background: #fef3f0; border: 2px solid #ff6b35; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px;">
        <p style="margin: 0; font-weight: 600; color: #ff6b35;">
          Due Date: ${new Date(doc.dueDate).toLocaleDateString()}
        </p>
      </div>
      ` : ''}

      <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px;">
        <p style="margin: 0;">Thank you for your business!</p>
      </div>
    </body>
    </html>
  `;
};

// Helper function to build public client view HTML
const buildPublicClientView = (doc, companySettings, paymentMethods = []) => {
  const lineItemsHtml = doc.lineItems.map(item => {
    const markup = Number(item.markup) || 0;
    const lineTotal = (item.qty * item.rate) + markup;
    return `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #000;">
          <div style="font-weight: 600; color: #000; margin-bottom: 4px;">${item.description || 'Untitled Item'}</div>
          ${item.notes ? `<div style="font-size: 13px; color: #000; line-height: 1.5;">${item.notes}</div>` : ''}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #000; text-align: center; color: #000;">${formatCurrency(item.rate)}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #000; text-align: center; color: #000;">${item.qty}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #000; text-align: right; color: #000;">${formatCurrency(lineTotal)}</td>
      </tr>
    `;
  }).join('');

  const subtotal = doc.lineItems.reduce((sum, item) => {
    const markup = Number(item.markup) || 0;
    return sum + ((item.qty * item.rate) + markup);
  }, 0);
  const total = subtotal;

  // Use company settings from database
  const companyName = companySettings.name || 'Karlo Electric';
  const companyAddress = companySettings.address || '1721 Colbert Hollow Rd\nLewisburg, TN 37091';
  const companyPhone = companySettings.phone || '(931) 982-8500';
  const companyEmail = companySettings.email || 'karloelectric@gmail.com';
  const companyLogo = companySettings.logo;

  // Parse address into lines
  const addressLines = companyAddress.split('\n').map(line => line.trim()).filter(line => line);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${doc.type === 'estimate' ? 'Estimate' : 'Invoice'} ${doc.poNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          line-height: 1.5;
          color: #000;
          background: #fff;
          font-size: 14px;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .doc-type {
          text-align: center;
          font-size: 18px;
          color: #999;
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding-bottom: 20px;
        }
        .company-info {
          flex: 1;
        }
        .company-logo {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 10px;
          color: #000;
        }
        .company-info p {
          font-size: 13px;
          line-height: 1.6;
          color: #000;
        }
        .client-info {
          flex: 1;
          text-align: right;
        }
        .client-info h3 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 10px;
          color: #000;
        }
        .client-info p {
          font-size: 13px;
          line-height: 1.6;
          color: #000;
        }
        .metadata {
          text-align: right;
          margin-top: 15px;
        }
        .metadata p {
          font-size: 13px;
          margin-bottom: 3px;
          color: #000;
        }
        .metadata strong {
          display: inline-block;
          min-width: 120px;
          text-align: right;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 30px 0;
        }
        thead {
          border-bottom: 2px solid #000;
        }
        th {
          padding: 10px 8px;
          text-align: left;
          font-weight: 700;
          font-size: 14px;
          color: #000;
        }
        th:nth-child(2), th:nth-child(3) {
          text-align: center;
        }
        th:nth-child(4) {
          text-align: right;
        }
        tbody tr {
          border-bottom: 1px solid #000;
        }
        .totals-section {
          margin: 30px 0;
          padding-top: 20px;
          border-top: 2px solid #000;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }
        .totals-row.subtotal {
          font-weight: 400;
        }
        .totals-row.total {
          font-weight: 700;
          font-size: 16px;
          padding-top: 12px;
        }
        .totals-row span:last-child {
          text-align: right;
          min-width: 120px;
        }
        .payment-methods {
          margin-top: 50px;
          padding: 30px;
          background: #f9f9f9;
          border-radius: 8px;
        }
        .payment-methods h3 {
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 25px;
          color: #000;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .payment-methods-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 30px;
          max-width: 100%;
        }
        .payment-method {
          text-align: center;
          padding: 20px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }
        .payment-method-name {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 15px;
          color: #000;
        }
        .payment-qr {
          width: 150px;
          height: 150px;
          object-fit: contain;
          margin: 0 auto 10px;
          display: block;
        }
        .payment-url {
          font-size: 12px;
          color: #666;
          word-break: break-all;
          margin-top: 10px;
        }
        .text-payment-methods {
          margin-top: 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          justify-content: center;
          padding: 20px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }
        .text-payment-method {
          display: flex;
          align-items: center;
          font-size: 14px;
          color: #000;
        }
        .text-payment-icon {
          font-size: 20px;
          margin-right: 8px;
          color: #666;
        }
        .text-payment-name {
          font-weight: 600;
        }
        .text-payment-detail {
          font-weight: 400;
          color: #666;
          margin-left: 4px;
        }
        @media print {
          .container { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="doc-type">${doc.type === 'estimate' ? 'ESTIMATE' : 'INVOICE'}</div>

        <div class="header">
          <div class="company-info">
            ${companyLogo ? `
              <img src="${companyLogo}" alt="Company Logo" style="max-width: 300px; max-height: 120px; object-fit: contain; margin-bottom: 15px;">
            ` : ''}
            <p><strong>${companyName}</strong></p>
            ${addressLines.map(line => `<p>${line}</p>`).join('')}
            <p>Phone: ${companyPhone}</p>
            <p>Email: ${companyEmail}</p>
          </div>

          <div class="client-info">
            <h3>Prepared For</h3>
            <p>${doc.clientName}</p>
            ${doc.clientBillingAddress ? `<p>${doc.clientBillingAddress}</p>` : ''}
            ${doc.serviceAddress ? `<p>${doc.serviceAddress}</p>` : ''}
            ${doc.clientPhone ? `<p>${doc.clientPhone}</p>` : ''}

            <div class="metadata">
              <p><strong>${doc.type === 'estimate' ? 'Estimate #' : 'Invoice #'}</strong> ${doc.poNumber}</p>
              <p><strong>Date</strong> ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>
              ${doc.validUntil ? `<p><strong>Expiration Date</strong> ${new Date(doc.validUntil).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>` : ''}
              ${doc.type === 'invoice' && doc.dueDate ? `<p><strong>Due Date</strong> ${new Date(doc.dueDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</p>` : ''}
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Rate</th>
              <th>Quantity</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHtml}
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-row subtotal">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotal)}</span>
          </div>
          <div class="totals-row total">
            <span>Total</span>
            <span>${formatCurrency(total)}</span>
          </div>
        </div>

        ${doc.notes ? `
        <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-left: 4px solid #000;">
          <h3 style="font-size: 14px; margin-bottom: 10px;">Notes</h3>
          <p style="font-size: 13px; white-space: pre-wrap;">${doc.notes}</p>
        </div>
        ` : ''}

        ${paymentMethods.length > 0 ? `
        <div class="payment-methods">
          <h3>Accepted Payment Methods</h3>

          ${paymentMethods.filter(m => m.qrCodeUrl).length > 0 ? `
          <div class="payment-methods-grid">
            ${paymentMethods.filter(m => m.qrCodeUrl).map(method => `
              <div class="payment-method">
                <div class="payment-method-name">${method.methodName}</div>
                <img src="${method.qrCodeUrl}" alt="${method.methodName} QR Code" class="payment-qr">
                ${method.paymentUrl ? `<div class="payment-url">${method.paymentUrl}</div>` : ''}
              </div>
            `).join('')}
          </div>
          ` : ''}

          ${paymentMethods.filter(m => !m.qrCodeUrl).length > 0 ? `
          <div class="text-payment-methods">
            ${paymentMethods.filter(m => !m.qrCodeUrl).map(method => `
              <div class="text-payment-method">
                <span class="text-payment-icon">•</span>
                <span class="text-payment-name">${method.methodName}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
};

app.post('/api/documents/:id/send', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const { rows: ownerCheck } = await pool.query(
      'SELECT id FROM documents WHERE id = ? AND user_id = ?',
      [id, req.session.userId]
    );
    if (ownerCheck.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const { sendMethod } = req.body;

    // Get the document
    const { rows: docRows } = await pool.query('SELECT * FROM documents WHERE id = ?', [id]);
    if (!docRows.length) return res.status(404).json({ error: 'Document not found' });

    const doc = toCamel(docRows[0]);

    // Send email if method is email
    if (sendMethod === 'email') {
      if (!doc.clientEmail) {
        return res.status(400).json({ error: 'Client email is required to send via email' });
      }

      try {
        const emailHtml = buildDocumentEmail(doc);
        const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';

        // Normalize email to lowercase (Resend validation is case-sensitive)
        const normalizedEmail = doc.clientEmail.toLowerCase().trim();

        // Warn if using test email
        if (fromEmail === 'onboarding@resend.dev') {
          console.warn('⚠️  WARNING: Using onboarding@resend.dev test email - emails only send to your Resend signup address!');
          console.warn('   To send to real clients, verify your sender email at https://resend.com/emails');
        }

        const result = await resend.emails.send({
          from: fromEmail,
          to: normalizedEmail,
          subject: `${doc.type === 'estimate' ? 'Estimate' : 'Invoice'} ${doc.poNumber}`,
          html: emailHtml,
        });

        console.log(`✅ Email sent successfully to ${normalizedEmail} for ${doc.type} ${doc.poNumber}`);
        console.log(`   Resend Email ID: ${result.data?.id || 'N/A'}`);
        console.log(`   From: ${fromEmail}`);
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        return res.status(500).json({ error: 'Failed to send email', detail: emailError.message });
      }
    }

    // Mark as sent
    const { rows } = await pool.query(
      `
      UPDATE documents
      SET status = 'sent', sent_at = NOW(), sent_via = ?, updated_at = NOW()
      WHERE id = ?
     
    `,
      [id, sendMethod || 'manual'],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark as sent' });
  }
});

app.delete('/api/documents/:id', requireAuth, async (req, res) => {
  try {
    const { id} = req.params;
    const { rows } = await pool.query('DELETE FROM documents WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Public view endpoint - NO authentication required
app.get('/view/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Fetch document by share token
    const { rows: docRows } = await pool.query(
      'SELECT * FROM documents WHERE share_token = ?',
      [token]
    );

    if (!docRows.length) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Document Not Found</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1>Document Not Found</h1>
          <p>This document link is invalid or has been removed.</p>
        </body>
        </html>
      `);
    }

    const doc = toCamel(docRows[0]);

    // Track the view
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referrer = req.headers['referer'] || req.headers['referrer'];

    // Insert view record
    await pool.query(
      `INSERT INTO document_views (document_id, ip_address, user_agent, referrer)
       VALUES (?, ?, ?, ?)`,
      [doc.id, ipAddress, userAgent, referrer]
    );

    // Create notification for this view
    await pool.query(
      `INSERT INTO notifications (type, document_id, title, message, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'document_viewed',
        doc.id,
        `${doc.type === 'estimate' ? 'Estimate' : 'Invoice'} Viewed`,
        `${doc.clientName} viewed ${doc.poNumber || 'document'}`,
        JSON.stringify({
          clientName: doc.clientName,
          poNumber: doc.poNumber,
          type: doc.type,
          viewedAt: new Date().toISOString()
        })
      ]
    );

    // Update document status to 'viewed' if currently 'sent'
    if (doc.status === 'sent') {
      await pool.query(
        `UPDATE documents SET status = 'viewed', updated_at = NOW() WHERE id = ?`,
        [doc.id]
      );
    }

    console.log(`📄 Document ${doc.poNumber} viewed by ${doc.clientName} from ${ipAddress}`);

    // Get company settings for the view
    const { rows: companyRows } = await pool.query('SELECT * FROM company_settings ORDER BY id LIMIT 1');
    const companySettings = companyRows.length > 0 ? toCamel(companyRows[0]) : {
      name: 'Karlo Electric',
      address: '1721 Colbert Hollow Rd\nLewisburg, TN 37091',
      phone: '(931) 982-8500',
      email: 'karloelectric@gmail.com',
      logo: null
    };

    // Get payment methods for the view
    const { rows: paymentRows } = await pool.query('SELECT * FROM payment_methods ORDER BY id');
    const paymentMethods = paymentRows.map(toCamel);

    // Serve the public client view HTML
    res.send(buildPublicClientView(doc, companySettings, paymentMethods));
  } catch (err) {
    console.error('View tracking error:', err);
    res.status(500).send('Error loading document');
  }
});

// Payments
app.get('/api/documents/:id/payments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Verify document ownership
    const { rows: docCheck } = await pool.query(
      'SELECT id FROM documents WHERE id = ? AND user_id = ?',
      [id, req.session.userId]
    );
    if (docCheck.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE document_id = ? AND user_id = ? ORDER BY payment_date DESC',
      [id, req.session.userId]
    );
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load payments' });
  }
});

app.post('/api/documents/:id/payments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // Verify document ownership
    const { rows: docCheck } = await pool.query(
      'SELECT id FROM documents WHERE id = ? AND user_id = ?',
      [id, req.session.userId]
    );
    if (docCheck.length === 0) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const { amount, paymentMethod, checkNumber, paymentDate, notes } = req.body;

    const { rows } = await pool.query(
      `
      INSERT INTO payments (document_id, amount, payment_method, check_number, payment_date, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
     
      `,
      [id, amount, paymentMethod, checkNumber, paymentDate, notes || null, req.session.userId]
    );
    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Notifications
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const { limit = 50, unreadOnly = false } = req.query;

    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [req.session.userId];

    if (unreadOnly === 'true') {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const { rows } = await pool.query(query, params);
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load notifications' });
  }
});

app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE is_read = false AND user_id = ?',
      [req.session.userId]
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    const { rows } = await pool.query(
      'UPDATE notifications SET is_read = ? WHERE id = ? AND user_id = ?',
      [isRead !== false, id, req.session.userId]
    );

    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

app.put('/api/notifications/mark-all-read', requireAuth, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE is_read = false AND user_id = ?', [req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Clients
app.get('/api/clients', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load clients' });
  }
});

app.post('/api/clients', requireAuth, async (req, res) => {
  try {
    const { name, email, phone, company, billingEmail, billingAddress, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `
      INSERT INTO clients (user_id, name, email, phone, company, billing_email, billing_address, notes)
      VALUES (?,?,?,?,?,?,?,?)
     
    `,
      [req.session.userId, name, email || null, phone || null, company || null, billingEmail || null, billingAddress || null, notes || null],
    );
    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save client' });
  }
});

app.put('/api/clients/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, billingEmail, billingAddress, notes } = req.body;
    const { rows } = await pool.query(
      `
      UPDATE clients SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        company = COALESCE(?, company),
        billing_email = COALESCE(?, billing_email),
        billing_address = COALESCE(?, billing_address),
        notes = COALESCE(?, notes)
      WHERE id = ? AND user_id = ?
     
    `,
      [name || null, email || null, phone || null, company || null, billingEmail || null, billingAddress || null, notes || null, id, req.session.userId],
    );
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM clients WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// Items
app.get('/api/items', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load items' });
  }
});

app.post('/api/items', requireAuth, async (req, res) => {
  try {
    const { name, description, defaultQty, defaultRate, defaultMarkup } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `
      INSERT INTO items (user_id, name, description, default_qty, default_rate, default_markup)
      VALUES (?,?,?,?,?,?)
     
    `,
      [req.session.userId, name, description || null, defaultQty || 1, defaultRate || 0, defaultMarkup || 0],
    );
    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save item' });
  }
});

app.put('/api/items/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, defaultQty, defaultRate, defaultMarkup } = req.body;
    const { rows } = await pool.query(
      `
      UPDATE items SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        default_qty = COALESCE(?, default_qty),
        default_rate = COALESCE(?, default_rate),
        default_markup = COALESCE(?, default_markup)
      WHERE id = ? AND user_id = ?
     
    `,
      [name || null, description || null, defaultQty || null, defaultRate || null, defaultMarkup || null, id, req.session.userId],
    );
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/items/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM items WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Price Scraping Endpoint
app.post('/api/scrape-prices', requireAuth, async (req, res) => {
  try {
    const { materials } = req.body;

    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: 'materials array is required' });
    }

    console.log(`\n🔍 Scraping ${materials.length} materials from Google Shopping...`);
    console.log(`Materials: ${materials.join(', ')}\n`);

    // Process materials ONE AT A TIME sequentially
    const results = [];

    for (let i = 0; i < materials.length; i++) {
      const materialName = materials[i];
      console.log(`\n[${i + 1}/${materials.length}] Processing: "${materialName}"`);

      try {
        // Get full material data (price + description)
        const materialData = await getMaterialData(materialName);

        // Store result with ORIGINAL material name
        results.push({
          name: materialName,  // Preserve exact input
          price: materialData.price,
          description: materialData.description,
          success: materialData.found,
          products: materialData.products || 0
        });

        console.log(`✓ Result for "${materialName}": $${materialData.price}\n`);

        // Delay between searches to avoid rate limits
        if (i < materials.length - 1) {
          console.log(`⏳ Waiting 2 seconds before next search...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Error pricing "${materialName}":`, error.message);
        results.push({
          name: materialName,  // Preserve exact input even on error
          price: 0,
          description: '',
          success: false,
          error: error.message
        });
      }
    }

    console.log(`\n✅ Completed scraping ${results.length} materials`);
    res.json({ results });
  } catch (err) {
    console.error('Price scraping error:', err);
    res.status(500).json({ error: 'Failed to scrape prices' });
  }
});

// Materials
app.get('/api/materials', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM materials WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load materials' });
  }
});

app.post('/api/materials', requireAuth, async (req, res) => {
  try {
    const { name, description, defaultQty, defaultRate, defaultMarkup } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `
      INSERT INTO materials (user_id, name, description, default_qty, default_rate, default_markup)
      VALUES (?,?,?,?,?,?)
     
    `,
      [req.session.userId, name, description || null, defaultQty || 1, defaultRate || 0, defaultMarkup || 0],
    );
    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save material' });
  }
});

app.put('/api/materials/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, defaultQty, defaultRate, defaultMarkup } = req.body;
    const { rows } = await pool.query(
      `
      UPDATE materials SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        default_qty = COALESCE(?, default_qty),
        default_rate = COALESCE(?, default_rate),
        default_markup = COALESCE(?, default_markup)
      WHERE id = ? AND user_id = ?
     
    `,
      [name || null, description || null, defaultQty || null, defaultRate || null, defaultMarkup || null, id, req.session.userId],
    );
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

app.delete('/api/materials/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM materials WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

// Company Settings endpoints
app.get('/api/company-settings', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM company_settings WHERE user_id = ? ORDER BY id LIMIT 1', [req.session.userId]);
    if (rows.length === 0) {
      // Return defaults if no settings exist
      return res.json({
        name: 'Karlo Electric',
        address: '1721 Colbert Hollow Rd\nLewisburg, TN 37091',
        phone: '(931) 982-8500',
        email: 'karloelectric@gmail.com',
        logo: null
      });
    }
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error('Get company settings error:', err);
    res.status(500).json({ error: 'Failed to get company settings' });
  }
});

app.put('/api/company-settings', requireAuth, async (req, res) => {
  try {
    const { name, address, phone, email, logo } = req.body;

    // Check if settings exist for this user
    const { rows: existing } = await pool.query('SELECT id FROM company_settings WHERE user_id = ? LIMIT 1', [req.session.userId]);

    if (existing.length === 0) {
      // Insert new settings
      const { rows } = await pool.query(
        `INSERT INTO company_settings (user_id, name, address, phone, email, logo, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
        `,
        [req.session.userId, name, address, phone, email, logo]
      );
      return res.json(toCamel(rows[0]));
    } else {
      // Update existing settings
      const { rows } = await pool.query(
        `UPDATE company_settings
         SET name = ?, address = ?, phone = ?, email = ?, logo = ?, updated_at = NOW()
         WHERE id = ? AND user_id = ?
        `,
        [name, address, phone, email, logo, existing[0].id, req.session.userId]
      );
      return res.json(toCamel(rows[0]));
    }
  } catch (err) {
    console.error('Update company settings error:', err);
    res.status(500).json({ error: 'Failed to update company settings' });
  }
});

// Payment Methods endpoints
app.get('/api/payment-methods', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM payment_methods WHERE user_id = ? ORDER BY id', [req.session.userId]);
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error('Get payment methods error:', err);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
});

app.post('/api/payment-methods', requireAuth, async (req, res) => {
  try {
    const { methodName, paymentUrl, qrCodeUrl, displayUrl } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO payment_methods (user_id, method_name, payment_url, qr_code_url, display_url, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW())
      `,
      [req.session.userId, methodName, paymentUrl || null, qrCodeUrl, displayUrl || null]
    );
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error('Create payment method error:', err);
    res.status(500).json({ error: 'Failed to create payment method' });
  }
});

app.put('/api/payment-methods/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { methodName, paymentUrl, qrCodeUrl, displayUrl } = req.body;
    const { rows } = await pool.query(
      `UPDATE payment_methods
       SET method_name = ?, payment_url = ?, qr_code_url = ?, display_url = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?
      `,
      [methodName, paymentUrl || null, qrCodeUrl, displayUrl || null, id, req.session.userId]
    );
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error('Update payment method error:', err);
    res.status(500).json({ error: 'Failed to update payment method' });
  }
});

app.delete('/api/payment-methods/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM payment_methods WHERE id = ? AND user_id = ?', [id, req.session.userId]);
    if (!rows.length) return res.status(403).json({ error: 'Unauthorized or not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete payment method error:', err);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// Fallback to SPA index for any other route (except static files)
app.get(/.*/, (req, res) => {
  // If it's a request for an HTML file in public, let express.static handle it
  // Otherwise, send index.html for SPA routing
  if (req.path.endsWith('.html') && req.path !== '/') {
    return res.sendFile(path.join(__dirname, '..', 'public', req.path));
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

console.log(`Starting server on port ${PORT}...`);
app.listen(PORT, () => {
  console.log(`✓ Server successfully started on http://localhost:${PORT}`);
  console.log('=== SERVER READY ===');
}).on('error', (err) => {
  console.error('✗ FATAL: Server failed to start');
  console.error('Error:', err.message);
  process.exit(1);
});
