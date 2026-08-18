const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../auth');

const router = express.Router();

// Helper to determine Odd/Even tag from Sri Lankan vehicle plate (e.g. WP-CAB-4521 -> 1 -> ODD)
function calculateOddEven(plate) {
  if (!plate) return 'ODD';
  const numbers = plate.replace(/\D/g, '');
  if (!numbers) return 'ODD';
  const lastDigit = parseInt(numbers.slice(-1), 10);
  return lastDigit % 2 === 0 ? 'EVEN' : 'ODD';
}

// 1. Submit or Update Driver Verification Application
router.post('/driver', authenticateToken, (req, res) => {
  try {
    const { license_number, vehicle_model, vehicle_plate, seats, fuel_type, license_doc_url, vehicle_photo_url } = req.body;

    if (!license_number || !vehicle_model || !vehicle_plate) {
      return res.status(400).json({ error: 'License number, vehicle model, and vehicle plate number are required.' });
    }

    const calculatedOddEven = calculateOddEven(vehicle_plate);
    const existing = db.prepare('SELECT * FROM driver_verifications WHERE user_id = ?').get(req.user.id);

    if (existing) {
      db.prepare(`
        UPDATE driver_verifications
        SET license_number = ?, vehicle_model = ?, vehicle_plate = ?, odd_even_type = ?,
            seats = ?, fuel_type = ?, license_doc_url = ?, vehicle_photo_url = ?,
            status = 'pending', admin_comment = 'Updated credentials submitted for review',
            submitted_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(
        license_number,
        vehicle_model,
        vehicle_plate.toUpperCase().trim(),
        calculatedOddEven,
        seats || 3,
        fuel_type || 'Petrol',
        license_doc_url || 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80',
        vehicle_photo_url || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80',
        req.user.id
      );
    } else {
      db.prepare(`
        INSERT INTO driver_verifications (user_id, license_number, vehicle_model, vehicle_plate, odd_even_type, seats, fuel_type, license_doc_url, vehicle_photo_url, status, admin_comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'Awaiting campus admin verification')
      `).run(
        req.user.id,
        license_number,
        vehicle_model,
        vehicle_plate.toUpperCase().trim(),
        calculatedOddEven,
        seats || 3,
        fuel_type || 'Petrol',
        license_doc_url || 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80',
        vehicle_photo_url || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80'
      );
    }

    const updated = db.prepare('SELECT * FROM driver_verifications WHERE user_id = ?').get(req.user.id);
    res.json({
      message: 'Driver verification documents submitted successfully. Please wait for Admin approval.',
      driver_verification: updated
    });
  } catch (error) {
    console.error('Driver verification error:', error);
    res.status(500).json({ error: 'Server error while submitting driver verification.' });
  }
});

// 2. Get Driver Verification Status
router.get('/driver/status', authenticateToken, (req, res) => {
  try {
    const record = db.prepare('SELECT * FROM driver_verifications WHERE user_id = ?').get(req.user.id);
    res.json({
      verified: record?.status === 'approved',
      status: record ? record.status : 'unverified',
      details: record || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch verification status.' });
  }
});

// 3. Submit Passenger Verification (Student / Staff ID)
router.post('/passenger', authenticateToken, (req, res) => {
  try {
    const { id_card_number, id_doc_url } = req.body;
    if (!id_card_number) {
      return res.status(400).json({ error: 'Student/Staff ID card number is required.' });
    }

    const existing = db.prepare('SELECT * FROM passenger_verifications WHERE user_id = ?').get(req.user.id);
    if (existing) {
      db.prepare(`
        UPDATE passenger_verifications
        SET id_card_number = ?, id_doc_url = ?, status = 'approved', admin_comment = 'Auto-verified with campus registry'
        WHERE user_id = ?
      `).run(id_card_number, id_doc_url || '', req.user.id);
    } else {
      db.prepare(`
        INSERT INTO passenger_verifications (user_id, id_card_number, id_doc_url, status, admin_comment)
        VALUES (?, ?, ?, 'approved', 'Auto-verified with campus registry')
      `).run(req.user.id, id_card_number, id_doc_url || '');
    }

    const updated = db.prepare('SELECT * FROM passenger_verifications WHERE user_id = ?').get(req.user.id);
    res.json({
      message: 'Passenger verified successfully.',
      passenger_verification: updated
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit passenger verification.' });
  }
});

module.exports = router;
