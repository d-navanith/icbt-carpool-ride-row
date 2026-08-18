const express = require('express');
const db = require('../db');
const { authenticateToken, requireApprovedDriver } = require('../auth');

const router = express.Router();

// 1. Get / Search Available Rides
router.get('/', (req, res) => {
  try {
    const { origin, destination, date, timeWindow, oddEven, maxPrice } = req.query;

    let query = `
      SELECT r.*, u.name as driver_name, u.email as driver_email, u.phone as driver_phone,
             u.avatar as driver_avatar, u.role as driver_role,
             dv.vehicle_model, dv.vehicle_plate, dv.odd_even_type, dv.fuel_type
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      JOIN driver_verifications dv ON r.driver_id = dv.user_id
      WHERE r.status = 'active' AND r.available_seats > 0
    `;
    const params = [];

    if (origin) {
      query += ` AND (LOWER(r.origin) LIKE LOWER(?) OR LOWER(r.route_waypoints) LIKE LOWER(?))`;
      params.push(`%${origin}%`, `%${origin}%`);
    }

    if (destination) {
      query += ` AND (LOWER(r.destination) LIKE LOWER(?) OR LOWER(r.route_waypoints) LIKE LOWER(?))`;
      params.push(`%${destination}%`, `%${destination}%`);
    }

    if (date) {
      query += ` AND r.departure_date = ?`;
      params.push(date);
    }

    if (oddEven) {
      query += ` AND r.odd_even_tag = ?`;
      params.push(oddEven.toUpperCase());
    }

    if (maxPrice) {
      query += ` AND r.price_per_seat <= ?`;
      params.push(Number(maxPrice));
    }

    query += ` ORDER BY r.departure_date ASC, r.departure_time ASC`;

    const rides = db.prepare(query).all(...params);

    const safeParse = (wp) => {
      if (Array.isArray(wp)) return wp;
      try { return JSON.parse(wp || '[]'); } catch { return []; }
    };

    let filtered = rides;
    if (origin) filtered = filtered.filter(r => r.origin.toLowerCase().includes(origin.toLowerCase()));
    if (destination) filtered = filtered.filter(r => r.destination.toLowerCase().includes(destination.toLowerCase()));
    if (date) filtered = filtered.filter(r => r.departure_date === date);
    if (oddEven) filtered = filtered.filter(r => r.odd_even_tag === oddEven.toUpperCase());
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.departure_date + 'T' + a.departure_time);
      const dateB = new Date(b.departure_date + 'T' + b.departure_time);
      return dateA - dateB;
    });

    const formattedRides = filtered.map(r => {
      const reviews = db.prepare('SELECT * FROM reviews WHERE ride_id = ?').all(r.id);
      const total_reviews = reviews.length;
      const avg_rating = total_reviews > 0 ? (reviews.reduce((sum, rev) => sum + rev.rating, 0) / total_reviews) : 0;
      return {
        ...r,
        route_waypoints: safeParse(r.route_waypoints),
        avg_rating,
        total_reviews
      };
    });

    res.json({ rides: formattedRides });
  } catch (error) {
    console.error('Fetch rides error:', error);
    res.status(500).json({ error: 'Failed to search available rides.' });
  }
});

// 2. Get My Rides (for driver dashboard)
router.get('/my-rides', authenticateToken, (req, res) => {
  try {
    const rides = db.prepare(`
      SELECT r.*,
             (SELECT COUNT(*) FROM bookings b WHERE b.ride_id = r.id AND b.status = 'confirmed') as confirmed_passengers_count,
             (SELECT COUNT(*) FROM bookings b WHERE b.ride_id = r.id AND b.status = 'pending') as pending_requests_count
      FROM rides r
      WHERE r.driver_id = ?
      ORDER BY r.departure_date DESC, r.departure_time DESC
    `).all(req.user.id);

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
    console.error('Fetch driver rides error:', error);
    res.status(500).json({ error: 'Failed to fetch your rides.' });
  }
});

// 3. Get Single Ride Details
router.get('/:id', (req, res) => {
  try {
    const ride = db.prepare(`
      SELECT r.*, u.name as driver_name, u.email as driver_email, u.phone as driver_phone,
             u.avatar as driver_avatar, u.role as driver_role,
             dv.vehicle_model, dv.vehicle_plate, dv.odd_even_type, dv.fuel_type
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      JOIN driver_verifications dv ON r.driver_id = dv.user_id
      WHERE r.id = ?
    `).get(req.params.id);

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found.' });
    }

    const bookings = db.prepare(`
      SELECT b.*, u.name as passenger_name, u.avatar as passenger_avatar, u.phone as passenger_phone
      FROM bookings b
      JOIN users u ON b.passenger_id = u.id
      WHERE b.ride_id = ? AND b.status != 'cancelled'
    `).all(req.params.id);

    const safeParse = (wp) => {
      if (Array.isArray(wp)) return wp;
      try { return JSON.parse(wp || '[]'); } catch { return []; }
    };

    const reviews = db.prepare('SELECT * FROM reviews WHERE ride_id = ?').all(ride.id);
    const total_reviews = reviews.length;
    const avg_rating = total_reviews > 0 ? (reviews.reduce((sum, rev) => sum + rev.rating, 0) / total_reviews) : 0;

    res.json({
      ride: {
        ...ride,
        route_waypoints: safeParse(ride.route_waypoints),
        bookings,
        avg_rating,
        total_reviews
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ride details.' });
  }
});

// 4. Create New Ride (Gated by Admin Verification!)
router.post('/', authenticateToken, requireApprovedDriver, (req, res) => {
  try {
    const { origin, destination, route_waypoints, departure_date, departure_time, return_time, total_seats, price_per_seat, notes } = req.body;

    if (!origin || !destination || !departure_date || !departure_time || !total_seats) {
      return res.status(400).json({ error: 'Origin, destination, departure date, departure time, and total seats are required.' });
    }

    const seats = parseInt(total_seats, 10);
    const driverDoc = req.driverInfo;

    const result = db.prepare(`
      INSERT INTO rides (
        driver_id, origin, destination, route_waypoints, departure_date, departure_time,
        return_time, total_seats, available_seats, price_per_seat, vehicle_desc,
        odd_even_tag, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      req.user.id,
      origin,
      destination,
      JSON.stringify(route_waypoints || []),
      departure_date,
      departure_time,
      return_time || null,
      seats,
      seats,
      Number(price_per_seat) || 0,
      `${driverDoc.vehicle_model} (${driverDoc.vehicle_plate})`,
      driverDoc.odd_even_type,
      notes || '',
    );

    const newRide = db.prepare('SELECT * FROM rides WHERE id = ?').get(result.lastInsertRowid);

    const safeParse = (wp) => {
      if (Array.isArray(wp)) return wp;
      try { return JSON.parse(wp || '[]'); } catch { return []; }
    };

    res.status(201).json({
      message: 'Carpool ride published successfully.',
      ride: {
        ...newRide,
        route_waypoints: safeParse(newRide.route_waypoints)
      }
    });
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({ error: 'Server error while publishing ride.' });
  }
});

// 5. Update Ride Status & Lifecycle (Scheduled -> In Transit -> Completed)
router.patch('/:id/status', authenticateToken, (req, res) => {
  try {
    const { status } = req.body;
    const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(req.params.id);

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found.' });
    }

    if (ride.driver_id !== req.user.id && req.user.system_role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to modify this ride.' });
    }

    db.prepare('UPDATE rides SET status = ? WHERE id = ?').run(status, req.params.id);

    // Broadcast status change via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${req.params.id}`).emit('ride_status_updated', {
        rideId: Number(req.params.id),
        status,
        updatedBy: req.user.name
      });
    }

    res.json({ message: `Ride status updated to ${status}`, status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ride status.' });
  }
});

// 6. Emergency SOS Alert for Active Ride
router.post('/:id/sos', authenticateToken, (req, res) => {
  try {
    const { message, location } = req.body;
    const rideId = req.params.id;
    const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(rideId);

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found.' });
    }

    const sosAlert = {
      alertId: 'SOS-' + Date.now(),
      rideId: Number(rideId),
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      userPhone: req.user.phone || '+94 77 123 4567',
      driverId: ride.driver_id,
      vehicleDesc: ride.vehicle_desc,
      location: location || 'En route to ICBT Campus',
      timestamp: new Date().toISOString(),
      message: message || 'Urgent assistance requested by commuter.'
    };

    // Broadcast SOS alert to ride room and admin
    const io = req.app.get('io');
    if (io) {
      io.emit('campus_sos_alert', sosAlert);
      io.to(`ride-${rideId}`).emit('sos_triggered', sosAlert);
    }

    res.status(201).json({
      message: 'Emergency SOS broadcasted to ICBT Campus Security Hotline (+94 11 584 8888)',
      alert: sosAlert
    });
  } catch (error) {
    console.error('SOS Alert error:', error);
    res.status(500).json({ error: 'Failed to broadcast SOS alert.' });
  }
});

// 7. Complete Ride
router.patch('/:id/complete', authenticateToken, (req, res) => {
  try {
    const rideId = req.params.id;
    const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.driver_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    db.prepare('UPDATE rides SET status = ? WHERE id = ?').run('completed', rideId);
    db.prepare('UPDATE bookings SET status = ? WHERE ride_id = ? AND status = ?').run('completed', rideId, 'confirmed');

    const confirmedBookings = db.prepare('SELECT passenger_id FROM bookings WHERE ride_id = ? AND status = ?').all(rideId, 'completed');
    const io = req.app.get('io');
    if (io) {
      confirmedBookings.forEach(b => {
        io.to('user-' + b.passenger_id).emit('ride_completed', { rideId: Number(rideId), origin: ride.origin, destination: ride.destination });
      });
    }

    res.json({ message: 'Ride marked as completed', rideId: Number(rideId) });
  } catch (error) {
    console.error('Ride complete error:', error);
    res.status(500).json({ error: 'Failed to complete ride.' });
  }
});

// 8. Cancel Ride
router.patch('/:id/cancel', authenticateToken, (req, res) => {
  try {
    const rideId = req.params.id;
    const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(rideId);
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.driver_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    if (ride.status !== 'active') return res.status(400).json({ error: 'Ride is not active' });

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
          reason: 'Driver cancelled the ride'
        });
      });
    }

    res.json({ message: 'Ride cancelled', affectedPassengers: affectedBookings.length });
  } catch (error) {
    console.error('Ride cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel ride.' });
  }
});

module.exports = router;
