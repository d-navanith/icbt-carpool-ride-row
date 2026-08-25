const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");

describe("Booking API Tests", () => {
  let driverToken;
  let passengerToken;
  let adminToken;

  const tomorrow = () => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  };

  async function createRide() {
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        origin: "Booking Test Origin",
        destination: "ICBT Colombo Campus",
        departure_date: tomorrow(),
        departure_time: "10:30",
        total_seats: 4,
        price_per_seat: 300,
        notes: "Booking API test",
      });

    assert.equal(
      res.status,
      201,
      `Ride creation failed: ${JSON.stringify(res.body)}`,
    );

    assert.ok(res.body.ride?.id);

    return res.body.ride.id;
  }

  async function createBooking(rideId, seats = 1) {
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        ride_id: rideId,
        pickup_location: "Kiribathgoda",
        seats_booked: seats,
      });

    assert.equal(
      res.status,
      201,
      `Booking creation failed: ${JSON.stringify(res.body)}`,
    );

    assert.ok(res.body.booking?.id);

    return res.body.booking.id;
  }

  before(async () => {
    const driverLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "kamal.driver@icbt.edu.lk",
        password: "driver123",
      });

    assert.equal(driverLogin.status, 200);
    assert.ok(driverLogin.body.token);
    driverToken = driverLogin.body.token;

    const passengerLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "nimal.student@icbt.edu.lk",
        password: "student123",
      });

    assert.equal(passengerLogin.status, 200);
    assert.ok(passengerLogin.body.token);
    passengerToken = passengerLogin.body.token;

    const adminLogin = await request(app)
      .post("/api/admin/auth/login")
      .send({
        email: "admin@icbt.edu.lk",
        password: "admin123",
      });

    assert.equal(adminLogin.status, 200);
    assert.ok(adminLogin.body.token);
    adminToken = adminLogin.body.token;
  });

  // =========================================================
  // MY BOOKINGS
  // =========================================================

  it("Rejects unauthenticated access to my bookings", async () => {
    const res = await request(app)
      .get("/api/bookings/my-bookings");

    assert.equal(res.status, 401);
  });

  it("Passenger can retrieve their bookings", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const res = await request(app)
      .get("/api/bookings/my-bookings")
      .set("Authorization", `Bearer ${passengerToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.bookings));

    assert.ok(
      res.body.bookings.some(
        (booking) => booking.id === bookingId,
      ),
    );
  });

  // =========================================================
  // DRIVER BOOKING REQUESTS
  // =========================================================

  it("Driver can retrieve booking requests for their rides", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const res = await request(app)
      .get("/api/bookings/driver/requests")
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.bookings));

    assert.ok(
      res.body.bookings.some(
        (booking) => booking.id === bookingId,
      ),
    );
  });

  // =========================================================
  // BOOKINGS FOR SPECIFIC RIDE
  // =========================================================

  it("Passenger cannot retrieve bookings for another driver's ride", async () => {
    const rideId = await createRide();

    const res = await request(app)
      .get(`/api/bookings/ride/${rideId}`)
      .set("Authorization", `Bearer ${passengerToken}`);

    assert.equal(res.status, 403);
    assert.match(res.body.error, /Unauthorized/i);
  });

  it("Driver can retrieve bookings for their own ride", async () => {
    const rideId = await createRide();

    await createBooking(rideId);

    const res = await request(app)
      .get(`/api/bookings/ride/${rideId}`)
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.bookings));
  });

  it("Admin can retrieve bookings for a ride", async () => {
    const rideId = await createRide();

    const res = await request(app)
      .get(`/api/bookings/ride/${rideId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.bookings));
  });

  it("Rejects invalid ride ID for ride bookings lookup", async () => {
    const res = await request(app)
      .get("/api/bookings/ride/not-a-number")
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid ride ID/i);
  });

  it("Returns 404 for a missing ride booking lookup", async () => {
    const res = await request(app)
      .get("/api/bookings/ride/999999")
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 404);
    assert.match(res.body.error, /Ride not found/i);
  });

  // =========================================================
  // BOOKING STATUS
  // =========================================================

  it("Rejects invalid booking status values", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        status: "invalid-status",
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid booking status/i);
  });

  it("Passenger cannot use booking status endpoint to confirm their own booking", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        status: "confirmed",
      });

    assert.equal(res.status, 403);
  });

  // =========================================================
  // BOOKING CANCELLATION
  // =========================================================

  it("Passenger cannot cancel another user's booking", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 403);
    assert.match(res.body.error, /Not authorized/i);
  });

  it("Rejects cancellation of a missing booking", async () => {
    const res = await request(app)
      .patch("/api/bookings/999999/cancel")
      .set("Authorization", `Bearer ${passengerToken}`);

    assert.equal(res.status, 404);
    assert.match(res.body.error, /Booking not found/i);
  });

  it("Rejects invalid booking ID for cancellation", async () => {
    const res = await request(app)
      .patch("/api/bookings/not-a-number/cancel")
      .set("Authorization", `Bearer ${passengerToken}`);

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid booking ID/i);
  });

  // =========================================================
  // PAYMENT
  // =========================================================

  it("Rejects invalid booking ID for payment confirmation", async () => {
    const res = await request(app)
      .patch("/api/bookings/not-a-number/confirm-payment")
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid booking ID/i);
  });

  it("Rejects payment confirmation for a missing booking", async () => {
    const res = await request(app)
      .patch("/api/bookings/999999/confirm-payment")
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 404);
    assert.match(res.body.error, /Booking not found/i);
  });

  it("Passenger cannot confirm payment for a booking", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/confirm-payment`)
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        paymentMethod: "Cash Payment",
      });

    assert.equal(res.status, 403);
    assert.match(
      res.body.error,
      /Only the carpool driver can confirm payment/i,
    );
  });

  it("Rejects payment confirmation for an unconfirmed booking", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/confirm-payment`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        paymentMethod: "Cash Payment",
      });

    assert.equal(res.status, 400);
    assert.match(
      res.body.error,
      /Only confirmed bookings can be completed/i,
    );
  });

  it("Rejects an invalid payment method", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const confirm = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        status: "confirmed",
      });

    assert.equal(confirm.status, 200);

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/confirm-payment`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        paymentMethod: "Invalid Payment Method",
      });

    assert.equal(res.status, 400);
    assert.match(
      res.body.error,
      /Invalid payment method/i,
    );
  });

  it("Rejects an incorrect custom payment amount", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const confirm = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        status: "confirmed",
      });

    assert.equal(confirm.status, 200);

    const res = await request(app)
      .patch(`/api/bookings/${bookingId}/confirm-payment`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        paymentMethod: "Cash Payment",
        customAmount: 999999,
      });

    assert.equal(res.status, 400);
    assert.match(
      res.body.error,
      /does not match the booking fare/i,
    );
  });

  it("Driver can confirm payment for a confirmed booking", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const confirm = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        status: "confirmed",
      });

    assert.equal(confirm.status, 200);

    const payment = await request(app)
      .patch(`/api/bookings/${bookingId}/confirm-payment`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        paymentMethod: "Cash Payment",
      });

    assert.equal(payment.status, 200);
    assert.equal(payment.body.bookingId, bookingId);
    assert.equal(payment.body.status, "completed");
    assert.ok(payment.body.receipt);
    assert.equal(payment.body.receipt.bookingId, bookingId);
    assert.equal(payment.body.receipt.paymentStatus, "PAID");
  });

  it("Rejects a duplicate payment confirmation", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const confirm = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        status: "confirmed",
      });

    assert.equal(confirm.status, 200);

    const payment = await request(app)
      .patch(`/api/bookings/${bookingId}/confirm-payment`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        paymentMethod: "Cash Payment",
      });

    assert.equal(payment.status, 200);

    const duplicate = await request(app)
      .patch(`/api/bookings/${bookingId}/confirm-payment`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        paymentMethod: "Cash Payment",
      });

    assert.equal(duplicate.status, 400);

    // After the first payment the booking status becomes "completed",
    // so the endpoint reaches the status validation before the
    // duplicate-paid validation.
    assert.match(
      duplicate.body.error,
      /Only confirmed bookings can be completed and paid/i,
    );
  });

  // =========================================================
  // DIGITAL RECEIPTS
  // =========================================================

  it("Passenger can access their completed booking receipt", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const confirm = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        status: "confirmed",
      });

    assert.equal(confirm.status, 200);

    const payment = await request(app)
      .patch(`/api/bookings/${bookingId}/confirm-payment`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        paymentMethod: "Cash Payment",
      });

    assert.equal(payment.status, 200);

    const receipt = await request(app)
      .get(`/api/bookings/${bookingId}/receipt`)
      .set("Authorization", `Bearer ${passengerToken}`);

    assert.equal(receipt.status, 200);
    assert.ok(receipt.body.receipt);
    assert.equal(receipt.body.receipt.bookingId, bookingId);
  });

  it("Admin can access a booking receipt", async () => {
    const rideId = await createRide();
    const bookingId = await createBooking(rideId);

    const confirm = await request(app)
      .patch(`/api/bookings/${bookingId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        status: "confirmed",
      });

    assert.equal(confirm.status, 200);

    const payment = await request(app)
      .patch(`/api/bookings/${bookingId}/confirm-payment`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        paymentMethod: "Cash Payment",
      });

    assert.equal(payment.status, 200);

    const receipt = await request(app)
      .get(`/api/bookings/${bookingId}/receipt`)
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(receipt.status, 200);
    assert.ok(receipt.body.receipt);
    assert.equal(receipt.body.receipt.bookingId, bookingId);
  });

  it("Rejects invalid receipt booking ID", async () => {
    const res = await request(app)
      .get("/api/bookings/not-a-number/receipt")
      .set("Authorization", `Bearer ${passengerToken}`);

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid booking ID/i);
  });

  it("Returns 404 for a missing receipt booking", async () => {
    const res = await request(app)
      .get("/api/bookings/999999/receipt")
      .set("Authorization", `Bearer ${passengerToken}`);

    assert.equal(res.status, 404);
    assert.match(res.body.error, /Booking not found/i);
  });
});