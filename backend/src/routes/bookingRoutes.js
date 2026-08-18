const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../auth');

const router = express.Router();

/**
 * Atomic SQLite Transaction: Passenger Ride Booking
 * BEGIN TRANSACTION
 *   ├── Verify Ride exists & status is 'active'
 *   ├── Validate driver is not self
 *   ├── Check available_seats >= requested seats
 *   ├── Verify no duplicate pending/confirmed booking
 *   ├── Insert booking with 'pending' status
 *   └── Decrement ride available_seats
 * COMMIT (or ROLLBACK on error)
 */
const createBookingTransaction = db.transaction(({ rideId, passengerId, seatsBooked, pickupLocation, bookingCode }) => {
  // 1. Check Ride & Available Seats inside the transaction
  const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(rideId);
  if (!ride) {
    const err = new Error('Ride not found.');
    err.statusCode = 404;
    throw err;
  }

  if (ride.status !== 'active') {
    const err = new Error('This carpool ride is no longer active.');
    err.statusCode = 400;
    throw err;
  }

  if (ride.driver_id === passengerId) {
    const err = new Error('You cannot book your own ride.');
    err.statusCode = 400;
    throw err;
  }

  const seats = parseInt(seatsBooked, 10);
  if (!seats || isNaN(seats) || seats < 1) {
    const err = new Error('Please select at least 1 seat.');
    err.statusCode = 400;
    throw err;
  }

  if (ride.available_seats < seats) {
    const err = new Error(`Only ${ride.available_seats} seat${ride.available_seats !== 1 ? 's' : ''} available on this carpool.`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Check duplicate active bookings
  const existing = db.prepare(`
    SELECT * FROM bookings WHERE ride_id = ? AND passenger_id = ? AND status IN ('pending', 'confirmed')
  `).get(rideId, passengerId);

  if (existing) {
    const err = new Error('You already have an active booking for this ride.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Insert Booking Record with actual requested seat count
  const result = db.prepare(`
    INSERT INTO bookings (ride_id, passenger_id, seats_booked, pickup_location, booking_code, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(rideId, passengerId, seats, pickupLocation, bookingCode);

  // 4. Update Available Seats
  db.prepare('UPDATE rides SET available_seats = available_seats - ? WHERE id = ?').run(seats, rideId);

  // 5. Fetch and return new booking snapshot
  return db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
});

/**
 * Atomic SQLite Transaction: Update Booking Status
 * BEGIN TRANSACTION
 *   ├── Verify booking & associated ride
 *   ├── Enforce role-based state transition permissions
 *   ├── Update booking status (confirmed, rejected, cancelled)
 *   └── Synchronize available_seats
 * COMMIT (or ROLLBACK on error)
 */
const updateBookingStatusTransaction = db.transaction(({ bookingId, newStatus, user }) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.statusCode = 404;
    throw err;
  }

  const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(booking.ride_id);
  if (!ride) {
    const err = new Error('Associated ride not found.');
    err.statusCode = 404;
    throw err;
  }

  // Permission check
  const isPassenger = booking.passenger_id === user.id;
  const isDriver = ride.driver_id === user.id;
  const isAdmin = user.system_role === 'admin';

  if (!isPassenger && !isDriver && !isAdmin) {
    const err = new Error('Not authorized to change this booking.');
    err.statusCode = 403;
    throw err;
  }

  // Passenger: can only cancel
  if (isPassenger && !isDriver && !isAdmin) {
    if (newStatus !== 'cancelled') {
      const err = new Error('Passengers can only cancel their booking requests.');
      err.statusCode = 403;
      throw err;
    }
  }

  // Driver: can confirm or reject
  if (isDriver && !isAdmin) {
    if (!['confirmed', 'rejected'].includes(newStatus)) {
      const err = new Error('Drivers can only accept (confirm) or reject booking requests.');
      err.statusCode = 403;
      throw err;
    }
  }

  const prevStatus = booking.status;

  // If attempting to confirm an inactive booking, verify sufficient seats exist
  if (newStatus === 'confirmed' && (prevStatus === 'cancelled' || prevStatus === 'rejected')) {
    if (ride.available_seats < booking.seats_booked) {
      const err = new Error('Not enough seats available on this carpool.');
      err.statusCode = 400;
      throw err;
    }
  }

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(newStatus, bookingId);

  // Adjust available seats if transitioning between active (pending/confirmed) and inactive (cancelled/rejected)
  const wasActive = prevStatus === 'pending' || prevStatus === 'confirmed';
  const isInactive = newStatus === 'cancelled' || newStatus === 'rejected';

  if (wasActive && isInactive) {
    db.prepare('UPDATE rides SET available_seats = available_seats + ? WHERE id = ?').run(booking.seats_booked, booking.ride_id);
  } else if (!wasActive && (newStatus === 'pending' || newStatus === 'confirmed')) {
    db.prepare('UPDATE rides SET available_seats = available_seats - ? WHERE id = ?').run(booking.seats_booked, booking.ride_id);
  }

  return { bookingId, status: newStatus };
});

// 1. Passenger Books / Requests a Ride (Transaction Wrapped)
router.post('/', authenticateToken, (req, res) => {
  try {
    const { ride_id, pickup_location } = req.body;

    if (!ride_id || !pickup_location) {
      return res.status(400).json({ error: 'Ride ID and pickup location are required.' });
    }

    let rawSeats = req.body.seats_booked !== undefined ? req.body.seats_booked : req.body.seats;
    if (rawSeats === undefined || rawSeats === null || rawSeats === '') {
      rawSeats = 1;
    }

    const requestedSeats = Number(rawSeats);
    if (!Number.isInteger(requestedSeats) || requestedSeats < 1) {
      return res.status(400).json({ error: 'Please select at least 1 seat to reserve.' });
    }

    const bookingCode = 'CP-' + Math.floor(100000 + Math.random() * 900000);

    // Execute atomic SQLite transaction
    const newBooking = createBookingTransaction({
      rideId: ride_id,
      passengerId: req.user.id,
      seatsBooked: requestedSeats,
      pickupLocation: pickup_location,
      bookingCode
    });

    // Real-Time Socket.IO Notification to Driver
    const io = req.app.get('io');
    if (io) {
      try {
        const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(ride_id);
        const passenger = db.prepare('SELECT id, name, phone, student_staff_id, avatar FROM users WHERE id = ?').get(req.user.id);
        
        const bookingPayload = {
          bookingId: newBooking.id,
          id: newBooking.id,
          booking_code: newBooking.booking_code,
          ride_id: Number(ride_id),
          rideId: Number(ride_id),
          driver_id: ride ? ride.driver_id : null,
          driverId: ride ? ride.driver_id : null,
          passenger_id: req.user.id,
          passengerId: req.user.id,
          passenger_name: passenger?.name || req.user.name,
          passengerName: passenger?.name || req.user.name,
          passenger_phone: passenger?.phone || '',
          passengerPhone: passenger?.phone || '',
          passenger_avatar: passenger?.avatar || '',
          passengerAvatar: passenger?.avatar || '',
          student_staff_id: passenger?.student_staff_id || '',
          pickup_location: newBooking.pickup_location,
          pickupLocation: newBooking.pickup_location,
          seats_booked: newBooking.seats_booked,
          seats: newBooking.seats_booked,
          origin: ride ? ride.origin : '',
          destination: ride ? ride.destination : '',
          departure_date: ride ? ride.departure_date : '',
          departureDate: ride ? ride.departure_date : '',
          departure_time: ride ? ride.departure_time : '',
          departureTime: ride ? ride.departure_time : '',
          price_per_seat: ride ? ride.price_per_seat : 0,
          pricePerSeat: ride ? ride.price_per_seat : 0,
          available_seats: ride ? ride.available_seats : 0,
          status: 'pending',
          created_at: newBooking.created_at || new Date().toISOString()
        };

        if (ride && ride.driver_id) {
          io.to(`user-${ride.driver_id}`).emit('new_booking_request', bookingPayload);
        }
        io.emit('booking_created', bookingPayload);
      } catch (notifyErr) {
        console.error('Socket notification error on new booking:', notifyErr);
      }
    }

    res.status(201).json({
      message: 'Ride booked successfully!',
      booking: newBooking
    });
  } catch (error) {
    console.error('Booking transaction error:', error.message);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Failed to complete ride booking.' });
  }
});

// 2. Get My Bookings (Passenger view)
router.get('/my-bookings', authenticateToken, (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.*, r.origin, r.destination, r.departure_date, r.departure_time, r.price_per_seat,
             r.vehicle_desc, r.odd_even_tag, r.status as ride_status,
             u.name as driver_name, u.phone as driver_phone, u.avatar as driver_avatar
      FROM bookings b
      JOIN rides r ON b.ride_id = r.id
      JOIN users u ON r.driver_id = u.id
      WHERE b.passenger_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);

    res.json({ bookings });
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch your bookings.' });
  }
});

// 3. Driver: Get all booking requests for all rides published by this driver
router.get('/driver/requests', authenticateToken, (req, res) => {
  try {
    const rides = db.prepare('SELECT id FROM rides WHERE driver_id = ?').all(req.user.id);
    const rideIds = rides.map(r => r.id);

    if (rideIds.length === 0) {
      return res.json({ bookings: [] });
    }

    const allBookings = [];
    for (const rId of rideIds) {
      const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(rId);
      const bList = db.prepare(`
        SELECT b.*, u.name as passenger_name, u.email as passenger_email, u.phone as passenger_phone,
               u.student_staff_id, u.avatar as passenger_avatar
        FROM bookings b
        JOIN users u ON b.passenger_id = u.id
        WHERE b.ride_id = ?
        ORDER BY b.created_at DESC
      `).all(rId);

      for (const b of bList) {
        allBookings.push({
          ...b,
          origin: ride?.origin || '',
          destination: ride?.destination || '',
          departure_date: ride?.departure_date || '',
          departure_time: ride?.departure_time || '',
          price_per_seat: ride?.price_per_seat || 0,
          vehicle_desc: ride?.vehicle_desc || '',
          available_seats: ride?.available_seats || 0
        });
      }
    }

    allBookings.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    res.json({ bookings: allBookings });
  } catch (error) {
    console.error('Get driver all bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch driver booking requests.' });
  }
});

// 4. Driver: Get all booking requests for a specific ride
router.get('/ride/:rideId', authenticateToken, (req, res) => {
  try {
    const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(req.params.rideId);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found.' });
    }

    if (ride.driver_id !== req.user.id && req.user.system_role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const bookings = db.prepare(`
      SELECT b.*, u.name as passenger_name, u.email as passenger_email, u.phone as passenger_phone,
             u.student_staff_id, u.avatar as passenger_avatar
      FROM bookings b
      JOIN users u ON b.passenger_id = u.id
      WHERE b.ride_id = ?
      ORDER BY b.created_at DESC
    `).all(req.params.rideId);

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ride bookings.' });
  }
});

// 5. Update Booking Status (Cancel, Confirm, Reject) (Transaction Wrapped)
router.patch('/:id/status', authenticateToken, (req, res) => {
  try {
    const { status } = req.body;

    const result = updateBookingStatusTransaction({
      bookingId: req.params.id,
      newStatus: status,
      user: req.user
    });

    // Real-Time Socket.IO Notification for Status Change
    const io = req.app.get('io');
    if (io) {
      try {
        const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
        const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(booking ? booking.ride_id : null);
        const passenger = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(booking ? booking.passenger_id : null);

        const statusPayload = {
          bookingId: Number(req.params.id),
          id: Number(req.params.id),
          rideId: booking ? booking.ride_id : null,
          ride_id: booking ? booking.ride_id : null,
          passengerId: booking ? booking.passenger_id : null,
          passenger_id: booking ? booking.passenger_id : null,
          passengerName: passenger?.name || '',
          driverId: ride ? ride.driver_id : null,
          driver_id: ride ? ride.driver_id : null,
          seatsBooked: booking ? booking.seats_booked : 1,
          seats_booked: booking ? booking.seats_booked : 1,
          status: result.status,
          availableSeats: ride ? ride.available_seats : 0,
          available_seats: ride ? ride.available_seats : 0,
          origin: ride ? ride.origin : '',
          destination: ride ? ride.destination : ''
        };

        if (booking && booking.passenger_id) {
          io.to(`user-${booking.passenger_id}`).emit('booking_status_updated', statusPayload);
        }
        if (ride && ride.driver_id) {
          io.to(`user-${ride.driver_id}`).emit('booking_status_updated', statusPayload);
        }
        io.emit('booking_status_changed', statusPayload);
      } catch (notifyErr) {
        console.error('Socket status update notification error:', notifyErr);
      }
    }

    res.json({ message: `Booking status updated to ${result.status}`, status: result.status });
  } catch (error) {
    console.error('Update booking status transaction error:', error.message);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to update booking status.' });
  }
});

// 6. Passenger Cancels Booking
router.patch('/:id/cancel', authenticateToken, (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.passenger_id !== req.user.id) return res.status(403).json({ error: 'Not authorized.' });

    // Cancellation window: must be > 2 hours before departure
    const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(booking.ride_id);
    if (ride && ride.departure_date && ride.departure_time) {
      const departure = new Date(ride.departure_date + 'T' + ride.departure_time);
      const now = new Date();
      const hoursUntilDeparture = (departure - now) / (1000 * 60 * 60);
      if (hoursUntilDeparture < 2 && hoursUntilDeparture > -1) {
        return res.status(400).json({ 
          error: 'Cancellation window closed. You cannot cancel within 2 hours of departure. Contact the driver via Chat.',
          cancellationWindowClosed: true
        });
      }
    }

    const result = updateBookingStatusTransaction({
      bookingId: req.params.id,
      newStatus: 'cancelled',
      user: req.user
    });

    const io = req.app.get('io');
    if (io) {
      if (ride && ride.driver_id) {
        io.to(`user-${ride.driver_id}`).emit('booking_status_updated', {
          bookingId: Number(req.params.id),
          rideId: ride.id,
          status: 'cancelled'
        });
      }
    }
    res.json({ message: 'Booking cancelled successfully.' });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Failed to cancel booking.' });
  }
});

// 7. Driver Confirms Payment & Completes Drop-Off
router.patch('/:id/confirm-payment', authenticateToken, (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(booking.ride_id);
    if (!ride) return res.status(404).json({ error: 'Ride not found.' });

    // Authorization: Only the driver of this ride (or admin) can confirm payment
    if (ride.driver_id !== req.user.id && req.user.system_role !== 'admin') {
      return res.status(403).json({ error: 'Only the carpool driver can confirm payment.' });
    }

    const { paymentMethod = 'Cash Payment', customAmount } = req.body || {};
    const totalFare = customAmount !== undefined ? Number(customAmount) : (ride.price_per_seat ? ride.price_per_seat * booking.seats_booked : 0);
    const completedAt = new Date().toISOString();

    // Update booking in DB
    db.prepare(`
      UPDATE bookings 
      SET status = ?, payment_status = ?, payment_method = ?, paid_amount = ?, completed_at = ? 
      WHERE id = ?
    `).run('completed', 'paid', paymentMethod, totalFare, completedAt, booking.id);

    // Fetch driver, vehicle, and passenger info for receipt
    const driver = db.prepare('SELECT * FROM users WHERE id = ?').get(ride.driver_id) || {};
    const driverVerification = db.prepare('SELECT * FROM driver_verifications WHERE user_id = ?').get(ride.driver_id) || {};
    const passenger = db.prepare('SELECT * FROM users WHERE id = ?').get(booking.passenger_id) || {};

    const receipt = {
      receiptNumber: `RR-REC-${new Date().getFullYear()}-${String(booking.id).padStart(6, '0')}`,
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      rideId: ride.id,
      origin: ride.origin,
      destination: ride.destination,
      pickupLocation: booking.pickup_location,
      departureDate: ride.departure_date,
      departureTime: ride.departure_time,
      seatsBooked: booking.seats_booked,
      pricePerSeat: ride.price_per_seat || 0,
      subtotal: totalFare,
      discount: 0,
      totalPaid: totalFare,
      paymentMethod,
      paymentStatus: 'PAID',
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      driverAvatar: driver.avatar,
      vehicleModel: driverVerification.vehicle_model || ride.vehicle_desc || 'Campus Carpool',
      vehiclePlate: driverVerification.vehicle_plate || 'CAMPUS-POOL',
      passengerId: passenger.id,
      passengerName: passenger.name,
      passengerEmail: passenger.email,
      passengerPhone: passenger.phone,
      studentStaffId: passenger.student_staff_id,
      completedAt
    };

    // Real-Time Socket.IO Notification to Passenger
    const io = req.app.get('io');
    if (io) {
      const payload = {
        bookingId: booking.id,
        rideId: ride.id,
        status: 'completed',
        paymentStatus: 'paid',
        receipt,
        message: `🎉 Payment of LKR ${totalFare} has been confirmed by driver ${driver.name}. Drop-off complete! Thank you for riding with Ride Row.`
      };

      // Emit to passenger's personal notification room
      io.to(`user-${booking.passenger_id}`).emit('payment_confirmed', payload);
      io.to(`user-${booking.passenger_id}`).emit('booking_status_updated', payload);
      io.to(`user-${ride.driver_id}`).emit('booking_status_updated', payload);
      io.emit('booking_status_changed', payload);
    }

    res.json({
      message: 'Payment confirmed & ride completed successfully!',
      bookingId: booking.id,
      status: 'completed',
      receipt
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm payment.' });
  }
});

// 8. Get Official Digital Receipt for Booking
router.get('/:id/receipt', authenticateToken, (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });

    const ride = db.prepare('SELECT * FROM rides WHERE id = ?').get(booking.ride_id);
    if (!ride) return res.status(404).json({ error: 'Ride not found.' });

    // Authorization: Passenger, Driver, or Admin
    const isPassenger = booking.passenger_id === req.user.id;
    const isDriver = ride.driver_id === req.user.id;
    const isAdmin = req.user.system_role === 'admin';

    if (!isPassenger && !isDriver && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to access this receipt.' });
    }

    const driver = db.prepare('SELECT * FROM users WHERE id = ?').get(ride.driver_id) || {};
    const driverVerification = db.prepare('SELECT * FROM driver_verifications WHERE user_id = ?').get(ride.driver_id) || {};
    const passenger = db.prepare('SELECT * FROM users WHERE id = ?').get(booking.passenger_id) || {};

    const totalPaid = booking.paid_amount || (ride.price_per_seat ? ride.price_per_seat * booking.seats_booked : 0);

    const receipt = {
      receiptNumber: `RR-REC-${new Date().getFullYear()}-${String(booking.id).padStart(6, '0')}`,
      bookingId: booking.id,
      bookingCode: booking.booking_code,
      rideId: ride.id,
      origin: ride.origin,
      destination: ride.destination,
      pickupLocation: booking.pickup_location,
      departureDate: ride.departure_date,
      departureTime: ride.departure_time,
      seatsBooked: booking.seats_booked,
      pricePerSeat: ride.price_per_seat || 0,
      subtotal: totalPaid,
      discount: 0,
      totalPaid,
      paymentMethod: booking.payment_method || 'Cash Payment',
      paymentStatus: (booking.payment_status || (booking.status === 'completed' ? 'paid' : 'pending')).toUpperCase(),
      driverId: driver.id,
      driverName: driver.name,
      driverPhone: driver.phone,
      driverAvatar: driver.avatar,
      vehicleModel: driverVerification.vehicle_model || ride.vehicle_desc || 'Campus Carpool',
      vehiclePlate: driverVerification.vehicle_plate || 'CAMPUS-POOL',
      passengerId: passenger.id,
      passengerName: passenger.name,
      passengerEmail: passenger.email,
      passengerPhone: passenger.phone,
      studentStaffId: passenger.student_staff_id,
      completedAt: booking.completed_at || booking.created_at
    };

    res.json({ receipt });
  } catch (error) {
    console.error('Fetch receipt error:', error);
    res.status(500).json({ error: 'Failed to generate digital receipt.' });
  }
});

module.exports = router;

