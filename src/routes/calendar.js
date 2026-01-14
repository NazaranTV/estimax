const express = require('express');
const router = express.Router();
const { pool, toCamel } = require('../db');
const { requireAuth } = require('../middleware/auth');

// Get all appointments for calendar view
router.get('/appointments', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        a.*,
        d.type as document_type,
        d.subtotal,
        d.total,
        d.status as document_status
      FROM appointments a
      LEFT JOIN documents d ON a.document_id = d.id
      ORDER BY a.appointment_date DESC, a.appointment_time
    `);
    res.json({ appointments: rows.map(toCamel) });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get appointments by date range
router.get('/appointments/range', requireAuth, async (req, res) => {
  try {
    const { start, end } = req.query;
    const { rows } = await pool.query(`
      SELECT
        a.*,
        d.type as document_type,
        d.subtotal,
        d.total,
        d.status as document_status
      FROM appointments a
      LEFT JOIN documents d ON a.document_id = d.id
      WHERE a.appointment_date >= $1 AND a.appointment_date <= $2
      ORDER BY a.appointment_date, a.appointment_time
    `, [start, end]);
    res.json({ appointments: rows.map(toCamel) });
  } catch (err) {
    console.error('Error fetching appointments by range:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Create a new appointment
router.post('/appointments', requireAuth, async (req, res) => {
  try {
    const {
      documentId,
      poNumber,
      clientName,
      clientEmail,
      clientPhone,
      serviceAddress,
      appointmentDate,
      appointmentTime,
      durationHours,
      notes
    } = req.body;

    const { rows } = await pool.query(`
      INSERT INTO appointments (
        document_id, po_number, client_name, client_email, client_phone,
        service_address, appointment_date, appointment_time, duration_hours, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      documentId, poNumber, clientName, clientEmail, clientPhone,
      serviceAddress, appointmentDate, appointmentTime, durationHours || 2, notes
    ]);

    res.json({ appointment: toCamel(rows[0]) });
  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment status
router.patch('/appointments/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { rows } = await pool.query(`
      UPDATE appointments
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json({ appointment: toCamel(rows[0]) });
  } catch (err) {
    console.error('Error updating appointment status:', err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment
router.delete('/appointments/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM appointments WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting appointment:', err);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// Get availability slots for a document
router.get('/availability/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const { rows } = await pool.query(`
      SELECT * FROM availability_slots
      WHERE document_id = $1
      ORDER BY slot_date, slot_time
    `, [documentId]);
    res.json({ slots: rows.map(toCamel) });
  } catch (err) {
    console.error('Error fetching availability slots:', err);
    res.status(500).json({ error: 'Failed to fetch availability slots' });
  }
});

// Add availability slots to a document
router.post('/availability', requireAuth, async (req, res) => {
  try {
    const { documentId, slots } = req.body;

    // Delete existing slots for this document
    await pool.query('DELETE FROM availability_slots WHERE document_id = $1', [documentId]);

    // Insert new slots
    const values = [];
    const params = [];
    let paramIndex = 1;

    slots.forEach((slot, i) => {
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
      params.push(documentId, slot.date, slot.time);
      paramIndex += 3;
    });

    if (values.length > 0) {
      await pool.query(`
        INSERT INTO availability_slots (document_id, slot_date, slot_time)
        VALUES ${values.join(', ')}
      `, params);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving availability slots:', err);
    res.status(500).json({ error: 'Failed to save availability slots' });
  }
});

// Book an availability slot (public endpoint for customers)
router.post('/availability/:slotId/book', async (req, res) => {
  try {
    const { slotId } = req.params;

    // Get the slot details
    const { rows: slotRows } = await pool.query(`
      SELECT * FROM availability_slots WHERE id = $1 AND is_booked = FALSE
    `, [slotId]);

    if (slotRows.length === 0) {
      return res.status(400).json({ error: 'Slot is not available' });
    }

    const slot = slotRows[0];

    // Get document details
    const { rows: docRows } = await pool.query(`
      SELECT * FROM documents WHERE id = $1
    `, [slot.document_id]);

    if (docRows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = docRows[0];

    // Create appointment
    const { rows: appointmentRows } = await pool.query(`
      INSERT INTO appointments (
        document_id, po_number, client_name, client_email, client_phone,
        service_address, appointment_date, appointment_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      doc.id,
      doc.po_number,
      doc.client_name,
      doc.client_email,
      doc.client_phone,
      doc.service_address,
      slot.slot_date,
      slot.slot_time
    ]);

    // Mark slot as booked
    await pool.query(`
      UPDATE availability_slots SET is_booked = TRUE WHERE id = $1
    `, [slotId]);

    res.json({ appointment: toCamel(appointmentRows[0]) });
  } catch (err) {
    console.error('Error booking slot:', err);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

module.exports = router;
