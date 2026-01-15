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

// Book appointment slot (public)
router.post('/estimate/:shareToken/book', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { slotId } = req.body;

    // Get the document
    const { rows: docRows } = await pool.query(`
      SELECT * FROM documents
      WHERE share_token = $1 AND type = 'estimate'
    `, [shareToken]);

    if (docRows.length === 0) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    const document = docRows[0];

    // Get the slot
    const { rows: slotRows } = await pool.query(`
      SELECT * FROM availability_slots
      WHERE id = $1 AND document_id = $2 AND is_booked = FALSE
    `, [slotId, document.id]);

    if (slotRows.length === 0) {
      return res.status(404).json({ error: 'Slot not available' });
    }

    const slot = slotRows[0];

    // Create appointment
    const { rows: appointmentRows } = await pool.query(`
      INSERT INTO appointments (
        document_id, po_number, client_name, client_email, client_phone,
        service_address, appointment_date, appointment_time, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
      RETURNING *
    `, [
      document.id,
      document.po_number,
      document.client_name,
      document.client_email,
      document.client_phone,
      document.service_address,
      slot.slot_date,
      slot.slot_time
    ]);

    // Mark slot as booked
    await pool.query(`
      UPDATE availability_slots
      SET is_booked = TRUE
      WHERE id = $1
    `, [slotId]);

    // Create notification
    await pool.query(`
      INSERT INTO notifications (type, title, message, document_id)
      VALUES ('appointment', $1, $2, $3)
    `, [
      'New Appointment Scheduled',
      `${document.client_name} scheduled an appointment for ${slot.slot_date} at ${slot.slot_time} (${document.po_number})`,
      document.id
    ]);

    res.json({ appointment: toCamel(appointmentRows[0]) });
  } catch (err) {
    console.error('Error booking appointment:', err);
    res.status(500).json({ error: 'Failed to book appointment' });
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
