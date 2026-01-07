// Only load .env for local development (Railway provides env vars directly)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool, initDb, toCamel } = require('./db');
const { getMaterialData } = require('./priceScraperValueSerp');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow credentials (cookies)
app.use(cors({
  origin: true, // Reflect the request origin
  credentials: true // Allow cookies
}));
app.use(express.json({ limit: '1mb' }));

// Session middleware
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // 'none' required for cross-origin cookies with secure
  }
}));

app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Auth routes
app.use('/api/auth', authRoutes);

initDb()
  .then(() => console.log('Database ready'))
  .catch((err) => {
    console.error('Failed to prepare database', err);
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
    'SELECT po_number FROM documents WHERE po_number LIKE $1 ORDER BY po_number DESC LIMIT 1',
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/documents', async (req, res) => {
  try {
    const { type } = req.query;
    const params = [];
    let query = 'SELECT * FROM documents';
    if (type) {
      params.push(type);
      query += ' WHERE type = $1';
    }
    query += ' ORDER BY updated_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load documents' });
  }
});

app.get('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load document' });
  }
});

app.post('/api/documents', async (req, res) => {
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
    } = req.body;

    if (!type || !['estimate', 'invoice'].includes(type)) {
      return res.status(400).json({ error: 'type must be estimate or invoice' });
    }
    let resolvedClient = null;
    if (clientId) {
      const { rows } = await pool.query('SELECT * FROM clients WHERE id = $1', [clientId]);
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

    const { rows } = await pool.query(
      `
      INSERT INTO documents (
        type, po_number, client_id, client_name, client_email, client_billing_email, client_phone, client_billing_address, project_name,
        service_address, line_items, subtotal, tax_rate, total, status, due_date, valid_until, notes, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
      RETURNING *
    `,
      [
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
      ],
    );

    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error('Save document error', err);
    res.status(500).json({ error: 'Failed to save document', detail: err.message });
  }
});

app.put('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
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
    } = req.body;

    const items = Array.isArray(lineItems) ? sanitizeLineItems(lineItems) : null;
    const totals = items ? computeTotals(items, taxRate) : null;

    const { rows } = await pool.query(
      `
      UPDATE documents SET
        type = COALESCE($1, type),
        po_number = COALESCE($2, po_number),
        client_id = COALESCE($3, client_id),
        client_name = COALESCE($4, client_name),
        client_email = COALESCE($5, client_email),
        client_billing_email = COALESCE($6, client_billing_email),
        client_phone = COALESCE($7, client_phone),
        client_billing_address = COALESCE($8, client_billing_address),
        project_name = COALESCE($9, project_name),
        service_address = COALESCE($10, service_address),
        line_items = COALESCE($11, line_items),
        subtotal = COALESCE($12, subtotal),
        tax_rate = COALESCE($13, tax_rate),
        total = COALESCE($14, total),
        status = COALESCE($15, status),
        due_date = COALESCE($16, due_date),
        valid_until = COALESCE($17, valid_until),
        notes = COALESCE($18, notes),
        updated_at = NOW()
      WHERE id = $19
      RETURNING *
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

app.post('/api/documents/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { sendMethod } = req.body;
    const { rows } = await pool.query(
      `
      UPDATE documents
      SET status = 'sent', sent_at = NOW(), sent_via = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
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

app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING *', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Payments
app.get('/api/documents/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM payments WHERE document_id = $1 ORDER BY payment_date DESC',
      [id]
    );
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load payments' });
  }
});

app.post('/api/documents/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, checkNumber, paymentDate, notes } = req.body;

    const { rows } = await pool.query(
      `
      INSERT INTO payments (document_id, amount, payment_method, check_number, payment_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [id, amount, paymentMethod, checkNumber, paymentDate, notes || null]
    );
    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Clients
app.get('/api/clients', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load clients' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { name, email, phone, company, billingEmail, billingAddress, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `
      INSERT INTO clients (name, email, phone, company, billing_email, billing_address, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `,
      [name, email || null, phone || null, company || null, billingEmail || null, billingAddress || null, notes || null],
    );
    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save client' });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, billingEmail, billingAddress, notes } = req.body;
    const { rows } = await pool.query(
      `
      UPDATE clients SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        company = COALESCE($4, company),
        billing_email = COALESCE($5, billing_email),
        billing_address = COALESCE($6, billing_address),
        notes = COALESCE($7, notes)
      WHERE id = $8
      RETURNING *
    `,
      [name || null, email || null, phone || null, company || null, billingEmail || null, billingAddress || null, notes || null, id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM clients WHERE id = $1 RETURNING *', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// Items
app.get('/api/items', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM items ORDER BY created_at DESC');
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load items' });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const { name, description, defaultQty, defaultRate, defaultMarkup } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `
      INSERT INTO items (name, description, default_qty, default_rate, default_markup)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `,
      [name, description || null, defaultQty || 1, defaultRate || 0, defaultMarkup || 0],
    );
    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save item' });
  }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, defaultQty, defaultRate, defaultMarkup } = req.body;
    const { rows } = await pool.query(
      `
      UPDATE items SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        default_qty = COALESCE($3, default_qty),
        default_rate = COALESCE($4, default_rate),
        default_markup = COALESCE($5, default_markup)
      WHERE id = $6
      RETURNING *
    `,
      [name || null, description || null, defaultQty || null, defaultRate || null, defaultMarkup || null, id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

app.delete('/api/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM items WHERE id = $1 RETURNING *', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Price Scraping Endpoint
app.post('/api/scrape-prices', async (req, res) => {
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
app.get('/api/materials', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM materials ORDER BY created_at DESC');
    res.json(rows.map(toCamel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load materials' });
  }
});

app.post('/api/materials', async (req, res) => {
  try {
    const { name, description, defaultQty, defaultRate, defaultMarkup } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `
      INSERT INTO materials (name, description, default_qty, default_rate, default_markup)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
    `,
      [name, description || null, defaultQty || 1, defaultRate || 0, defaultMarkup || 0],
    );
    res.status(201).json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save material' });
  }
});

app.put('/api/materials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, defaultQty, defaultRate, defaultMarkup } = req.body;
    const { rows } = await pool.query(
      `
      UPDATE materials SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        default_qty = COALESCE($3, default_qty),
        default_rate = COALESCE($4, default_rate),
        default_markup = COALESCE($5, default_markup)
      WHERE id = $6
      RETURNING *
    `,
      [name || null, description || null, defaultQty || null, defaultRate || null, defaultMarkup || null, id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toCamel(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

app.delete('/api/materials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM materials WHERE id = $1 RETURNING *', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete material' });
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

app.listen(PORT, () => {
  console.log(`Estimator running on http://localhost:${PORT}`);
});
