const express = require('express');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../auth');

const router = express.Router();

// Apply auth and admin check to all admin endpoints
router.use(authenticateToken, requireAdmin);

// 1. Dashboard Global Stats
router.get('/stats', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalDrivers = db.prepare('SELECT COUNT(*) as count FROM driver_verifications WHERE status = "approved"').get().count;
    const pendingDriverVerifications = db.prepare('SELECT COUNT(*) as count FROM driver_verifications WHERE status = "pending"').get().count;
    const totalRides = db.prepare('SELECT COUNT(*) as count FROM rides').get().count;
    const activeRides = db.prepare('SELECT COUNT(*) as count FROM rides WHERE status = "active"').get().count;
    const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings WHERE status = "confirmed"').get().count;

    // Fuel saving estimate: Each carpool shared ride with 3 passengers saves approx 3.5L of fuel per 35km campus trip
    const estimatedLitersSaved = (totalBookings * 3.2).toFixed(1);
    const estimatedCostSavedLKR = (estimatedLitersSaved * 370).toLocaleString(); // ~370 LKR per liter

    // Odd-Even distribution
    const oddDrivers = db.prepare('SELECT COUNT(*) as count FROM driver_verifications WHERE odd_even_type = "ODD" AND status = "approved"').get().count;
    const evenDrivers = db.prepare('SELECT COUNT(*) as count FROM driver_verifications WHERE odd_even_type = "EVEN" AND status = "approved"').get().count;

    res.json({
      stats: {
        totalUsers,
        totalDrivers,
        pendingDriverVerifications,
        totalRides,
        activeRides,
        totalBookings,
        estimatedLitersSaved,
        estimatedCostSavedLKR,
        oddDrivers,
        evenDrivers
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

// 2. Get All Driver Verifications Queue
router.get('/verifications', (req, res) => {
  try {
    const driverVerifications = db.prepare(`
      SELECT dv.*, u.name as user_name, u.email as user_email, u.phone as user_phone,
             u.student_staff_id, u.role as university_role, u.avatar
      FROM driver_verifications dv
      JOIN users u ON dv.user_id = u.id
      ORDER BY
        CASE dv.status
          WHEN 'pending' THEN 1
          WHEN 'rejected' THEN 2
          WHEN 'approved' THEN 3
        END,
        dv.submitted_at DESC
    `).all();

    const passengerVerifications = db.prepare(`
      SELECT pv.*, u.name as user_name, u.email as user_email, u.phone as user_phone,
             u.student_staff_id, u.role as university_role, u.avatar
      FROM passenger_verifications pv
      JOIN users u ON pv.user_id = u.id
      ORDER BY pv.submitted_at DESC
    `).all();

    res.json({
      driverVerifications,
      passengerVerifications
    });
  } catch (error) {
    console.error('Admin verifications error:', error);
    res.status(500).json({ error: 'Failed to fetch verifications queue.' });
  }
});

// 3. Driver Verification Action (Approve / Reject)
router.post('/verifications/driver/:id/action', (req, res) => {
  try {
    const { action, comment } = req.body; // action: 'approved' | 'rejected'
    const { id } = req.params;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approved or rejected.' });
    }

    const verification = db.prepare('SELECT * FROM driver_verifications WHERE id = ?').get(id);
    if (!verification) {
      return res.status(404).json({ error: 'Verification record not found.' });
    }

    db.prepare(`
      UPDATE driver_verifications
      SET status = ?, admin_comment = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(action, comment || (action === 'approved' ? 'Approved by Admin' : 'Rejected due to insufficient documentation'), id);

    const updated = db.prepare(`
      SELECT dv.*, u.name as user_name, u.email as user_email
      FROM driver_verifications dv
      JOIN users u ON dv.user_id = u.id
      WHERE dv.id = ?
    `).get(id);

    res.json({
      message: `Driver application ${action} successfully.`,
      verification: updated
    });
  } catch (error) {
    console.error('Admin driver action error:', error);
    res.status(500).json({ error: 'Failed to update driver verification.' });
  }
});

// 4. Passenger Verification Action
router.post('/verifications/passenger/:id/action', (req, res) => {
  try {
    const { action, comment } = req.body;
    const { id } = req.params;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approved or rejected.' });
    }

    db.prepare(`
      UPDATE passenger_verifications
      SET status = ?, admin_comment = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(action, comment || `Status updated to ${action}`, id);

    res.json({ message: `Passenger verification updated to ${action}.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update passenger verification.' });
  }
});

// 5. Manage All Users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.system_role, u.student_staff_id, u.phone, u.avatar, u.created_at,
             dv.status as driver_status, dv.vehicle_plate, dv.odd_even_type,
             pv.status as passenger_status
      FROM users u
      LEFT JOIN driver_verifications dv ON u.id = dv.user_id
      LEFT JOIN passenger_verifications pv ON u.id = pv.user_id
      ORDER BY u.created_at DESC
    `).all();

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// 6. Manage All Rides
router.get('/rides', (req, res) => {
  try {
    const rides = db.prepare(`
      SELECT r.*, u.name as driver_name, u.email as driver_email,
             (SELECT COUNT(*) FROM bookings b WHERE b.ride_id = r.id) as total_bookings
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      ORDER BY r.created_at DESC
    `).all();

    const safeParse = (wp) => {
      if (Array.isArray(wp)) return wp;
      try { return JSON.parse(wp || '[]'); } catch { return []; }
    };

    const formatted = rides.map(r => ({
      ...r,
      route_waypoints: safeParse(r.route_waypoints)
    }));

    res.json({ rides: formatted });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all rides.' });
  }
});

// 7. Delete / Cancel Ride as Admin
router.delete('/rides/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM rides WHERE id = ?').run(req.params.id);
    res.json({ message: 'Ride removed by administrator.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ride.' });
  }
});

// 8. Export Rides CSV
router.get('/export/rides-csv', (req, res) => {
  try {
    const rides = db.prepare(`
      SELECT r.id, r.origin, r.destination, r.departure_date, r.departure_time,
             r.total_seats, r.available_seats, r.price_per_seat, r.odd_even_tag, r.status,
             u.name as driver_name, u.email as driver_email, u.phone as driver_phone
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      ORDER BY r.created_at DESC
    `).all();

    const headers = ['Ride ID', 'Origin', 'Destination', 'Date', 'Time', 'Total Seats', 'Available Seats', 'Price (LKR)', 'Odd/Even Tag', 'Status', 'Driver Name', 'Driver Email', 'Driver Phone'];
    const rows = rides.map(r => [
      r.id,
      `"${r.origin}"`,
      `"${r.destination}"`,
      r.departure_date,
      r.departure_time,
      r.total_seats,
      r.available_seats,
      r.price_per_seat,
      r.odd_even_tag,
      r.status,
      `"${r.driver_name}"`,
      `"${r.driver_email}"`,
      `"${r.driver_phone || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="icbt_campus_rides.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Export rides CSV error:', error);
    res.status(500).json({ error: 'Failed to export rides CSV.' });
  }
});

// 9. Export Users CSV
router.get('/export/users-csv', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.system_role, u.student_staff_id, u.phone,
             dv.status as driver_status, dv.vehicle_plate, dv.odd_even_type
      FROM users u
      LEFT JOIN driver_verifications dv ON u.id = dv.user_id
      ORDER BY u.id ASC
    `).all();

    const headers = ['User ID', 'Name', 'Email', 'Role', 'System Role', 'Student/Staff ID', 'Phone', 'Driver Status', 'Vehicle Plate', 'Odd/Even Type'];
    const rows = users.map(u => [
      u.id,
      `"${u.name}"`,
      `"${u.email}"`,
      u.role,
      u.system_role,
      `"${u.student_staff_id || ''}"`,
      `"${u.phone || ''}"`,
      u.driver_status || 'unverified',
      `"${u.vehicle_plate || ''}"`,
      u.odd_even_type || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="icbt_campus_users.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Export users CSV error:', error);
    res.status(500).json({ error: 'Failed to export users CSV.' });
  }
});

// 10. Admin Force-Cancel Ride
router.patch('/rides/:id/cancel', (req, res) => {
  try {
    const rideId = req.params.id;
    const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    db.prepare('UPDATE rides SET status = ? WHERE id = ?').run('cancelled', rideId);
    const affectedBookings = db.prepare('SELECT * FROM bookings WHERE ride_id = ? AND status IN (?, ?)').all(rideId, 'pending', 'confirmed');
    db.prepare('UPDATE bookings SET status = ? WHERE ride_id = ? AND status IN (?, ?)').run('cancelled', rideId, 'pending', 'confirmed');

    const io = req.app.get('io');
    if (io) {
      affectedBookings.forEach(b => {
        io.to('user-' + b.passenger_id).emit('booking_status_updated', {
          bookingId: b.id,
          rideId: Number(rideId),
          status: 'cancelled',
          reason: 'Admin cancelled this ride'
        });
      });
    }
    res.json({ message: 'Ride force-cancelled', rideId: Number(rideId) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel ride.' });
  }
});

// 11. Suspend User
router.patch('/users/:id/suspend', (req, res) => {
  try {
    const userId = req.params.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    db.prepare('UPDATE users SET suspended = ? WHERE id = ?').run(true, userId);
    res.json({ message: 'User suspended' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to suspend user.' });
  }
});

// 12. Unsuspend User
router.patch('/users/:id/unsuspend', (req, res) => {
  try {
    const userId = req.params.id;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    db.prepare('UPDATE users SET suspended = ? WHERE id = ?').run(false, userId);
    res.json({ message: 'User unsuspended' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to unsuspend user.' });
  }
});

module.exports = router;

