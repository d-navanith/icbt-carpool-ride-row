const { describe, it } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { app } = require('../src/server');

describe('ICBT Campus Carpool REST API Tests', () => {

  let userToken = '';
  let adminToken = '';
  let driverToken = '';
  let createdRideId = null;

  it('Health Check Endpoint returns online status', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'online');
  });

  it('Admin Login successfully receives JWT token', async () => {
    const res = await request(app)
      .post('/api/admin/auth/login')
      .send({
        email: 'admin@icbt.edu.lk',
        password: 'admin123'
      });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.system_role, 'admin');
    adminToken = res.body.token;
  });

  it('Admin account is blocked from normal user login endpoint', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'admin@icbt.edu.lk',
      password: 'admin123'
    });

  assert.strictEqual(res.status, 403);
  assert.match(
    res.body.error,
    /Admin Portal/i
  );
  });

  it('Verified Driver Login receives valid profile with approved status', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'kamal.driver@icbt.edu.lk',
        password: 'driver123'
      });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.driver_verification.status, 'approved');
    driverToken = res.body.token;
  });

  it('Passenger Search available carpool rides', async () => {
    const res = await request(app).get('/api/rides');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.rides));
    assert.ok(res.body.rides.length > 0);
  });

  it('Unverified user is strictly BLOCKED from publishing a carpool ride', async () => {
    // Login as unverified user
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'sanduni.user@icbt.edu.lk',
        password: 'user123'
      });
    userToken = loginRes.body.token;

    // Attempt to post ride
    const postRes = await request(app)
      .post('/api/rides')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        origin: 'Colombo 03',
        destination: 'ICBT Campus',
        departure_date: '2026-08-20',
        departure_time: '08:00',
        total_seats: 3,
        price_per_seat: 200
      });

    // Must be 403 Forbidden because driver is not verified by admin
    assert.strictEqual(postRes.status, 403);
    assert.match(postRes.body.error, /Driver verification required/);
  });

  it('Approved Driver can successfully publish a carpool ride', async () => {
    const postRes = await request(app)
      .post('/api/rides')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        origin: 'Moratuwa Town',
        destination: 'ICBT Colombo Campus',
        route_waypoints: ['Ratmalana', 'Mount Lavinia', 'Wellawatte', 'Bambalapitiya'],
        departure_date: '2026-08-20',
        departure_time: '07:30',
        return_time: '17:00',
        total_seats: 3,
        price_per_seat: 300,
        notes: 'Strict AC, nonsmoking, Odd plate match'
      });

    assert.strictEqual(postRes.status, 201);
    assert.ok(postRes.body.ride.id);
    assert.strictEqual(postRes.body.ride.available_seats, 3);
    createdRideId = postRes.body.ride.id;
  });

  it('Passenger books seat with initial status PENDING and decrements available seats', async () => {
    const bookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        ride_id: createdRideId,
        seats_booked: 1,
        pickup_location: 'Mount Lavinia Junction'
      });

    assert.strictEqual(bookRes.status, 201);
    assert.ok(bookRes.body.booking.booking_code);
    assert.strictEqual(bookRes.body.booking.status, 'pending');

    // Verify seats decremented (held on reservation)
    const rideRes = await request(app).get(`/api/rides/${createdRideId}`);
    assert.strictEqual(rideRes.body.ride.available_seats, 2);
  });

  it('Driver can ACCEPT a pending booking to transition status to CONFIRMED', async () => {
    const myBookingsRes = await request(app)
      .get(`/api/bookings/ride/${createdRideId}`)
      .set('Authorization', `Bearer ${driverToken}`);

    assert.strictEqual(myBookingsRes.status, 200);
    const pendingBooking = myBookingsRes.body.bookings.find(b => b.status === 'pending');
    assert.ok(pendingBooking);

    const updateRes = await request(app)
      .patch(`/api/bookings/${pendingBooking.id}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'confirmed' });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.status, 'confirmed');
  });

  it('Passenger can CANCEL a booking to restore available seats', async () => {
    const myBookingsRes = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(myBookingsRes.status, 200);
    const booking = myBookingsRes.body.bookings.find(b => b.ride_id === createdRideId);
    assert.ok(booking);

    const cancelRes = await request(app)
      .patch(`/api/bookings/${booking.id}/status`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'cancelled' });

    assert.strictEqual(cancelRes.status, 200);
    assert.strictEqual(cancelRes.body.status, 'cancelled');

    // Verify seats restored
    const rideRes = await request(app).get(`/api/rides/${createdRideId}`);
    assert.strictEqual(rideRes.body.ride.available_seats, 3);
  });

  it('Transaction rolls back atomically and prevents overbooking when requested seats exceed capacity', async () => {
    const overbookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        ride_id: createdRideId,
        seats_booked: 99,
        pickup_location: 'Mount Lavinia'
      });

    assert.strictEqual(overbookRes.status, 400);
    assert.match(overbookRes.body.error, /seats available/);

    // Verify ride seats remained completely intact
    const rideRes = await request(app).get(`/api/rides/${createdRideId}`);
    assert.strictEqual(rideRes.body.ride.available_seats, 3);
  });

  it('Rejects invalid seat counts such as 0 or negative seats with 400 error', async () => {
    const zeroSeatRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        ride_id: createdRideId,
        seats: 0,
        pickup_location: 'Mount Lavinia'
      });

    assert.strictEqual(zeroSeatRes.status, 400);
    assert.match(zeroSeatRes.body.error, /at least 1 seat/);

    const negSeatRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        ride_id: createdRideId,
        seats: -2,
        pickup_location: 'Mount Lavinia'
      });

    assert.strictEqual(negSeatRes.status, 400);
    assert.match(negSeatRes.body.error, /at least 1 seat/);
  });

  it('Passenger can request multi-seat booking (e.g. 2 seats), driver accepts, and available seats decrement accurately', async () => {
    // 1. Passenger requests 2 seats
    const multiBookRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        ride_id: createdRideId,
        seats: 2,
        pickup_location: 'Ratmalana'
      });

    assert.strictEqual(multiBookRes.status, 201);
    assert.strictEqual(multiBookRes.body.booking.seats_booked, 2);
    assert.strictEqual(multiBookRes.body.booking.status, 'pending');

    // Available seats dropped from 3 to 1
    const rideCheck1 = await request(app).get(`/api/rides/${createdRideId}`);
    assert.strictEqual(rideCheck1.body.ride.available_seats, 1);

    // 2. Driver views booking list and verifies requested seat count
    const driverListRes = await request(app)
      .get(`/api/bookings/ride/${createdRideId}`)
      .set('Authorization', `Bearer ${driverToken}`);

    const bookingInList = driverListRes.body.bookings.find(b => b.id === multiBookRes.body.booking.id);
    assert.ok(bookingInList);
    assert.strictEqual(bookingInList.seats_booked, 2);

    // 3. Driver accepts the multi-seat booking
    const acceptRes = await request(app)
      .patch(`/api/bookings/${bookingInList.id}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'confirmed' });

    assert.strictEqual(acceptRes.status, 200);

    // Available seats remains 1 (no double decrement)
    const rideCheck2 = await request(app).get(`/api/rides/${createdRideId}`);
    assert.strictEqual(rideCheck2.body.ride.available_seats, 1);

    // 4. Driver rejects or cancels to test full seat restoration
    const rejectRes = await request(app)
      .patch(`/api/bookings/${bookingInList.id}/status`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'rejected' });

    assert.strictEqual(rejectRes.status, 200);

    // Available seats restored back to 3
    const rideCheck3 = await request(app).get(`/api/rides/${createdRideId}`);
    assert.strictEqual(rideCheck3.body.ride.available_seats, 3);
  });

  it('Admin can view verification queue and approve pending driver', async () => {
    const queueRes = await request(app)
      .get('/api/admin/verifications')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(queueRes.status, 200);
    assert.ok(Array.isArray(queueRes.body.driverVerifications));

    const pendingDriver = queueRes.body.driverVerifications.find(d => d.status === 'pending');
    if (pendingDriver) {
      const approveRes = await request(app)
        .post(`/api/admin/verifications/driver/${pendingDriver.id}/action`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          action: 'approved',
          comment: 'License verified with university database'
        });

      assert.strictEqual(approveRes.status, 200);
      assert.strictEqual(approveRes.body.verification.status, 'approved');
    }
  });

  it('Passenger can submit rating and review for driver upon ride completion', async () => {
    const reviewRes = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        ride_id: createdRideId,
        reviewee_id: 2, // Kamal Driver
        rating: 5,
        comment: 'Great campus carpool! Punctual and safe driving on Kandy Road.'
      });

    assert.strictEqual(reviewRes.status, 201);
    assert.ok(reviewRes.body.reviewId);

    // Verify rating retrieval
    const statsRes = await request(app).get('/api/reviews/user/2');
    assert.strictEqual(statsRes.status, 200);
    assert.ok(statsRes.body.avgRating >= 1);
    assert.ok(statsRes.body.reviewCount >= 1);
  });

  it('Authenticated User can update profile details', async () => {
    const updateRes = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Sanduni Updated',
        phone: '+94 77 999 0011',
        student_staff_id: 'ICBT-ST-2025-99'
      });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.user.name, 'Sanduni Updated');
    assert.strictEqual(updateRes.body.user.phone, '+94 77 999 0011');
  });

  it('Analytics endpoint returns accurate fuel quota & corridor metrics', async () => {
    const analyticsRes = await request(app).get('/api/analytics/fuel-quota');
    assert.strictEqual(analyticsRes.status, 200);
    assert.ok(analyticsRes.body.fuel_quota.active_plate_rule);
    assert.ok(analyticsRes.body.impact_summary.estimated_cost_saved_lkr >= 0);
    assert.ok(analyticsRes.body.corridor_distribution);
  });

  it('Unconfirmed user is BLOCKED from accessing ride chat (403 Forbidden)', async () => {
    // userToken currently has a cancelled booking on createdRideId, so is unauthorized
    const chatRes = await request(app)
      .get(`/api/messages/${createdRideId}`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(chatRes.status, 403);
    assert.match(chatRes.body.error, /Only the carpool driver and confirmed passengers/);

    const postChatRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        ride_id: createdRideId,
        text: 'Unauthorized attempt'
      });

    assert.strictEqual(postChatRes.status, 403);
    assert.match(postChatRes.body.error, /Only the carpool driver and confirmed passengers/);
  });

  it('Driver is authorized to view and post chat messages with verified server identity', async () => {
    const postChatRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        ride_id: createdRideId,
        text: 'Pickup punctually at 07:30 sharp near gate.'
      });

    assert.strictEqual(postChatRes.status, 201);
    assert.strictEqual(postChatRes.body.message.sender_name, 'Kamal Perera');

    const getChatRes = await request(app)
      .get(`/api/messages/${createdRideId}`)
      .set('Authorization', `Bearer ${driverToken}`);

    assert.strictEqual(getChatRes.status, 200);
    assert.ok(Array.isArray(getChatRes.body.messages));
    assert.ok(getChatRes.body.messages.length > 0);
  });

  it('Admin can export rides and users as CSV reports', async () => {
    const ridesCsvRes = await request(app)
      .get('/api/admin/export/rides-csv')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(ridesCsvRes.status, 200);
    assert.match(ridesCsvRes.headers['content-type'], /text\/csv/);

    const usersCsvRes = await request(app)
      .get('/api/admin/export/users-csv')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(usersCsvRes.status, 200);
    assert.match(usersCsvRes.headers['content-type'], /text\/csv/);
  });

});

