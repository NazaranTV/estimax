const express = require('express');
const router = express.Router();
const { pool, toCamel } = require('../db');

// Get estimate by share token (public)
router.get('/estimate/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { rows } = await pool.query(`
      SELECT * FROM documents
      WHERE share_token = $1 AND type = 'estimate'
    `, [shareToken]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const document = toCamel(rows[0]);

    // Get availability slots
    const { rows: slotRows } = await pool.query(`
      SELECT * FROM availability_slots
      WHERE document_id = $1 AND is_booked = FALSE
      ORDER BY slot_date, slot_time
    `, [document.id]);

    document.availabilitySlots = slotRows.map(toCamel);

    res.json({ document });
  } catch (err) {
    console.error('Error fetching public estimate:', err);
    res.status(500).json({ error: 'Failed to fetch estimate' });
  }
});

// Approve estimate (public)
router.post('/estimate/:shareToken/approve', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { customerNotes } = req.body;

    // Get the document
    const { rows: docRows } = await pool.query(`
      SELECT * FROM documents
      WHERE share_token = $1 AND type = 'estimate'
    `, [shareToken]);

    if (docRows.length === 0) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const document = docRows[0];

    // Update approval status
    const { rows } = await pool.query(`
      UPDATE documents
      SET approval_status = 'approved',
          approved_at = NOW(),
          customer_notes = $1,
          status = 'approved',
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [customerNotes, document.id]);

    // Create notification
    await pool.query(`
      INSERT INTO notifications (type, title, message, document_id)
      VALUES ('approval', $1, $2, $3)
    `, [
      'Estimate Approved',
      `${document.client_name} has approved estimate ${document.po_number}`,
      document.id
    ]);

    res.json({ document: toCamel(rows[0]) });
  } catch (err) {
    console.error('Error approving estimate:', err);
    res.status(500).json({ error: 'Failed to approve estimate' });
  }
});

// Decline estimate (public)
router.post('/estimate/:shareToken/decline', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { customerNotes } = req.body;

    // Get the document
    const { rows: docRows } = await pool.query(`
      SELECT * FROM documents
      WHERE share_token = $1 AND type = 'estimate'
    `, [shareToken]);

    if (docRows.length === 0) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const document = docRows[0];

    // Update approval status
    const { rows } = await pool.query(`
      UPDATE documents
      SET approval_status = 'declined',
          declined_at = NOW(),
          customer_notes = $1,
          status = 'declined',
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [customerNotes, document.id]);

    // Create notification
    await pool.query(`
      INSERT INTO notifications (type, title, message, document_id)
      VALUES ('decline', $1, $2, $3)
    `, [
      'Estimate Declined',
      `${document.client_name} has declined estimate ${document.po_number}. Reason: ${customerNotes || 'No reason provided'}`,
      document.id
    ]);

    res.json({ document: toCamel(rows[0]) });
  } catch (err) {
    console.error('Error declining estimate:', err);
    res.status(500).json({ error: 'Failed to decline estimate' });
  }
});

module.exports = router;
