const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../auth');

const router = express.Router();

// Apply auth and admin check to all admin endpoints
router.use(authenticateToken, requireAdmin);

const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 30;
const MAX_ID_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 8;

const cleanString = (value, maxLength) => {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) return null;
  return cleaned;
};

const normalizeEmail = (value) => {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 255) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
};

const getCurrentAdmin = (adminId) => {
  const admin = db.prepare(`
    SELECT id, name, email, role, system_role, student_staff_id, phone, avatar, suspended, created_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).get(adminId);

  if (!admin || admin.system_role !== 'admin' || admin.suspended) {
    const error = new Error('Administrator access required.');
    error.statusCode = 403;
    throw error;
  }

  return admin;
};

const verifyAdminPassword = (adminId, password) => {
  if (typeof password !== 'string' || !password) return false;

  const record = db.prepare(`
    SELECT password_hash
    FROM users
    WHERE id = ?
    LIMIT 1
  `).get(adminId);

  return Boolean(record && bcrypt.compareSync(password, record.password_hash));
};

const assertCurrentAdminPassword = (adminId, currentPassword) => {
  if (!verifyAdminPassword(adminId, currentPassword)) {
    const error = new Error('Current administrator password is incorrect.');
    error.statusCode = 401;
    throw error;
  }
};

const getSafeAdmin = (adminId) => {
  return db.prepare(`
    SELECT id, name, email, role, system_role, student_staff_id, phone, avatar, suspended, created_at
    FROM users
    WHERE id = ?
    LIMIT 1
  `).get(adminId);
};

// 1. Dashboard Global Stats
router.get('/stats', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalDrivers = db.prepare('SELECT COUNT(*) as count FROM driver_verifications WHERE status = "approved"').get().count;
    const pendingDriverVerifications = db.prepare('SELECT COUNT(*) as count FROM driver_verifications WHERE status = "pending"').get().count;
    const totalRides = db.prepare('SELECT COUNT(*) as count FROM rides').get().count;
    const activeRides = db.prepare('SELECT COUNT(*) as count FROM rides WHERE status = "active"').get().count;
    const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings WHERE status = "confirmed"').get().count;

    const estimatedLitersSaved = (totalBookings * 3.2).toFixed(1);
    const estimatedCostSavedLKR = (estimatedLitersSaved * 370).toLocaleString();

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

// 2. Get current administrator account
router.get('/account', (req, res) => {
  try {
    const admin = getCurrentAdmin(req.user.id);
    res.json({ admin });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to fetch administrator account.' });
  }
});

// 3. Update current administrator profile
router.put('/account/profile', (req, res) => {
  try {
    const admin = getCurrentAdmin(req.user.id);

    const name = cleanString(req.body.name, MAX_NAME_LENGTH);
    const phone = req.body.phone === undefined ? admin.phone : cleanString(req.body.phone, MAX_PHONE_LENGTH);
    const studentStaffId = req.body.student_staff_id === undefined
      ? admin.student_staff_id
      : cleanString(req.body.student_staff_id, MAX_ID_LENGTH);

    if (!name) {
      return res.status(400).json({ error: 'Administrator name is required and must be 100 characters or fewer.' });
    }

    if (phone === null || studentStaffId === null) {
      return res.status(400).json({ error: 'Phone and staff ID must be valid text values.' });
    }

    db.prepare(`
      UPDATE users
      SET name = ?, phone = ?, student_staff_id = ?, avatar = ?
      WHERE id = ?
    `).run(
      name,
      phone,
      studentStaffId,
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
      admin.id
    );

    res.json({
      message: 'Administrator profile updated successfully.',
      admin: getSafeAdmin(admin.id)
    });
  } catch (error) {
    console.error('Admin profile update error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to update administrator profile.' });
  }
});

// 4. Change current administrator password
router.post('/account/password', (req, res) => {
  try {
    const admin = getCurrentAdmin(req.user.id);
    const { current_password, new_password, confirm_password } = req.body;

    if (typeof new_password !== 'string' || new_password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ error: 'New password and confirmation password do not match.' });
    }

    assertCurrentAdminPassword(admin.id, current_password);

    const passwordHash = bcrypt.hashSync(new_password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, admin.id);

    res.json({ message: 'Administrator password changed successfully. Please sign in again with the new password.' });
  } catch (error) {
    console.error('Admin password change error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to change administrator password.' });
  }
});

// 5. List administrators (safe fields only)
router.get('/administrators', (req, res) => {
  try {
    const administrators = db.prepare(`
      SELECT id, name, email, role, system_role, student_staff_id, phone, avatar, suspended, created_at
      FROM users
      WHERE system_role = 'admin'
      ORDER BY created_at ASC, id ASC
    `).all();

    res.json({ administrators });
  } catch (error) {
    console.error('Admin list error:', error);
    res.status(500).json({ error: 'Failed to fetch administrators.' });
  }
});

// 6. Create a new administrator account
router.post('/administrators', (req, res) => {
  try {
    const creator = getCurrentAdmin(req.user.id);
    const name = cleanString(req.body.name, MAX_NAME_LENGTH);
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const currentPassword = req.body.current_password;
    const role = req.body.role === 'staff' ? 'staff' : 'student';
    const studentStaffId = req.body.student_staff_id === undefined ? '' : cleanString(req.body.student_staff_id, MAX_ID_LENGTH);
    const phone = req.body.phone === undefined ? '' : cleanString(req.body.phone, MAX_PHONE_LENGTH);

    if (!name || !email) {
      return res.status(400).json({ error: 'Valid name and email are required.' });
    }

    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `New administrator password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    }

    if (studentStaffId === null || phone === null) {
      return res.status(400).json({ error: 'Staff ID and phone must be valid text values.' });
    }

    assertCurrentAdminPassword(creator.id, currentPassword);

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 12);

    const result = db.prepare(`
      INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        system_role,
        student_staff_id,
        phone,
        avatar
      )
      VALUES (?, ?, ?, ?, 'admin', ?, ?, ?)
    `).run(
      name,
      email,
      passwordHash,
      role,
      studentStaffId,
      phone,
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`
    );

    res.status(201).json({
      message: 'Administrator account created successfully.',
      administrator: getSafeAdmin(result.lastInsertRowid)
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create administrator account.' });
  }
});

// 7. Promote an existing user to administrator
router.post('/users/:id/promote', (req, res) => {
  try {
    const creator = getCurrentAdmin(req.user.id);
    const targetId = Number(req.params.id);

    if (!Number.isInteger(targetId) || targetId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    if (targetId === creator.id) {
      return res.status(400).json({ error: 'You are already an administrator.' });
    }

    assertCurrentAdminPassword(creator.id, req.body.current_password);

    const target = db.prepare(`
      SELECT id, name, email, role, system_role, suspended
      FROM users
      WHERE id = ?
      LIMIT 1
    `).get(targetId);

    if (!target) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    if (target.suspended) {
      return res.status(409).json({ error: 'Suspended accounts cannot be promoted to administrator.' });
    }

    if (target.system_role === 'admin') {
      return res.status(409).json({ error: 'This user is already an administrator.' });
    }

    db.prepare('UPDATE users SET system_role = "admin" WHERE id = ?').run(target.id);

    res.json({
      message: 'User promoted to administrator successfully.',
      administrator: getSafeAdmin(target.id)
    });
  } catch (error) {
    console.error('Admin promotion error:', error);
    res.status(error.statusCode || 500).json({ error: error.message || 'Failed to promote user.' });
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
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot suspend your own administrator account.' });
    }

    const user = db.prepare('SELECT id, system_role FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.system_role === 'admin') {
      return res.status(403).json({ error: 'Administrator accounts cannot be suspended from the general user management panel.' });
    }

    db.prepare('UPDATE users SET suspended = 1 WHERE id = ?').run(userId);
    res.json({ message: 'User suspended' });
  } catch (error) {
    console.error('Admin suspend user error:', error);
    res.status(500).json({ error: 'Failed to suspend user.' });
  }
});

// 12. Unsuspend User
router.patch('/users/:id/unsuspend', (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const user = db.prepare('SELECT id, system_role FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.prepare('UPDATE users SET suspended = 0 WHERE id = ?').run(userId);
    res.json({ message: 'User unsuspended' });
  } catch (error) {
    console.error('Admin unsuspend user error:', error);
    res.status(500).json({ error: 'Failed to unsuspend user.' });
  }
});

module.exports = router;

