const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");
const db = require("../src/db");

describe("Booking API Coverage Tests", () => {
  let driverToken;
  let passengerToken;
  let otherPassengerToken;
  let adminToken;

  let createdPassengerUserId = null;

  const createdRideIds = [];
  const createdBookingIds = [];

  const tomorrow = () => {
    const d = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    return d.toISOString().slice(0, 10);
  };

  async function login(email, password, admin = false) {
    const endpoint = admin
      ? "/api/admin/auth/login"
      : "/api/auth/login";

    const res = await request(app)
      .post(endpoint)
      .send({
        email,
        password,
      });

    assert.equal(
      res.status,
      200,
      `${endpoint} failed: ${JSON.stringify(res.body)}`,
    );

    assert.ok(res.body.token);

    return res.body.token;
  }

  async function createRide(token, overrides = {}) {
    const payload = {
      origin: `Booking Coverage Origin ${Date.now()}`,
      destination: "ICBT Colombo Campus",
      route_waypoints: ["Kelaniya", "Wattala"],
      departure_date: tomorrow(),
      departure_time: "10:00",
      total_seats: 6,
      price_per_seat: 500,
      notes: "Booking coverage test ride",
      ...overrides,
    };

    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    assert.equal(
      res.status,
      201,
      `Ride creation failed: ${JSON.stringify(res.body)}`,
    );

    assert.ok(res.body.ride?.id);

    createdRideIds.push(res.body.ride.id);

    return res.body.ride;
  }

  async function createBooking(token, rideId, overrides = {}) {
    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ride_id: rideId,
        seats: 1,
        pickup_location: "Kelaniya Junction",
        ...overrides,
      });

    assert.equal(
      res.status,
      201,
      `Booking creation failed: ${JSON.stringify(res.body)}`,
    );

    assert.ok(res.body.booking?.id);

    createdBookingIds.push(res.body.booking.id);

    return res.body.booking;
  }

  before(async () => {
    driverToken = await login(
      "kamal.driver@icbt.edu.lk",
      "driver123",
    );

    passengerToken = await login(
      "nimal.student@icbt.edu.lk",
      "student123",
    );

    // Create a dedicated second passenger test user.
    const uniqueEmail =
      `booking.coverage.${Date.now()}@icbt.edu.lk`;

    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Booking Coverage Passenger",
        email: uniqueEmail,
        password: "coverage123",
        role: "student",
        student_staff_id:
          `BOOKING-COVERAGE-${Date.now()}`,
        phone: "0710000099",
      });

    assert.equal(
      registerRes.status,
      201,
      `Coverage passenger registration failed: ${JSON.stringify(
        registerRes.body,
      )}`,
    );

    assert.ok(registerRes.body.token);

    createdPassengerUserId =
      registerRes.body.user?.id;

    otherPassengerToken =
      registerRes.body.token;

    adminToken = await login(
      "admin@icbt.edu.lk",
      "admin123",
      true,
    );
  });

  after(() => {
    // Delete coverage bookings first.
    for (const bookingId of createdBookingIds) {
      db.prepare(
        `
        DELETE FROM bookings
        WHERE id = ?
        `,
      ).run(bookingId);
    }

    // Then delete coverage rides.
    for (const rideId of createdRideIds) {
      db.prepare(
        `
        DELETE FROM bookings
        WHERE ride_id = ?
        `,
      ).run(rideId);

      db.prepare(
        `
        DELETE FROM rides
        WHERE id = ?
        `,
      ).run(rideId);
    }

    // Finally delete the temporary passenger.
    if (createdPassengerUserId) {
      db.prepare(
        `
        DELETE FROM users
        WHERE id = ?
        `,
      ).run(createdPassengerUserId);
    }
  });

  // =========================================================
  // BOOKING CREATION
  // =========================================================

  it("Rejects unauthenticated booking creation", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .send({
        ride_id: 1,
        seats: 1,
        pickup_location: "Kelaniya",
      });

    assert.equal(res.status, 401);
  });

  it("Rejects booking for a missing ride", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        ride_id: 999999,
        seats: 1,
        pickup_location: "Kelaniya",
      });

    assert.equal(res.status, 404);
  });

  it("Rejects booking with an invalid ride ID", async () => {
    const res = await request(app)
      .post("/api/bookings")
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        ride_id: "invalid",
        seats: 1,
        pickup_location: "Kelaniya",
      });

    assert.equal(res.status, 400);
  });

  it("Rejects a booking with zero seats", async () => {
    const ride = await createRide(driverToken);

    const res = await request(app)
      .post("/api/bookings")
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        ride_id: ride.id,
        seats: 0,
        pickup_location: "Kelaniya",
      });

    assert.equal(res.status, 400);
  });

  it("Rejects a booking with negative seats", async () => {
    const ride = await createRide(driverToken);

    const res = await request(app)
      .post("/api/bookings")
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        ride_id: ride.id,
        seats: -1,
        pickup_location: "Kelaniya",
      });

    assert.equal(res.status, 400);
  });

it(
  "Rejects a booking when pickup location is omitted",
  async () => {
    const ride =
      await createRide(
        driverToken,
      );

    const res = await request(app)
      .post("/api/bookings")
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        ride_id: ride.id,
        seats: 1,
      });

    assert.equal(
      res.status,
      400,
    );

    assert.equal(
      res.body.error,
      "A valid pickup location is required.",
    );
  },
);

  it("Rejects duplicate active bookings", async () => {
    const ride = await createRide(driverToken);

    await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .post("/api/bookings")
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        ride_id: ride.id,
        seats: 1,
        pickup_location: "Kelaniya",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /already have an active booking/i,
    );
  });

  it("Rejects booking when requested seats exceed available seats", async () => {
    const ride = await createRide(
      driverToken,
      {
        total_seats: 2,
      },
    );

    const res = await request(app)
      .post("/api/bookings")
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        ride_id: ride.id,
        seats: 3,
        pickup_location: "Kelaniya",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Only .* seats available/i,
    );
  });

  // =========================================================
  // MY BOOKINGS
  // =========================================================

  it("Rejects unauthenticated access to my bookings", async () => {
    const res = await request(app)
      .get("/api/bookings/my-bookings");

    assert.equal(res.status, 401);
  });

  it("Returns the authenticated passenger's bookings", async () => {
    const res = await request(app)
      .get("/api/bookings/my-bookings")
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      );

    assert.equal(res.status, 200);

    assert.ok(
      Array.isArray(res.body.bookings),
    );
  });

  // =========================================================
  // DRIVER REQUESTS
  // =========================================================

  it("Returns booking requests for the driver", async () => {
    const ride = await createRide(
      driverToken,
    );

    await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .get("/api/bookings/driver/requests")
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      );

    assert.equal(res.status, 200);

    assert.ok(
      Array.isArray(res.body.bookings),
    );
  });

  it("Returns an empty booking request list for a user without rides", async () => {
    const res = await request(app)
      .get("/api/bookings/driver/requests")
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      );

    assert.equal(res.status, 200);

    assert.ok(
      Array.isArray(res.body.bookings),
    );
  });

  // =========================================================
  // BOOKINGS FOR SPECIFIC RIDE
  // =========================================================

  it("Rejects an invalid ride ID when retrieving bookings", async () => {
    const res = await request(app)
      .get(
        "/api/bookings/ride/not-a-number",
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      );

    assert.equal(res.status, 400);

    assert.equal(
      res.body.error,
      "Invalid ride ID.",
    );
  });

  it("Returns 404 for a missing ride booking lookup", async () => {
    const res = await request(app)
      .get(
        "/api/bookings/ride/999999",
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      );

    assert.equal(res.status, 404);

    assert.equal(
      res.body.error,
      "Ride not found.",
    );
  });

  it("Rejects an unauthorized user from viewing ride bookings", async () => {
    const ride = await createRide(
      driverToken,
    );

    const res = await request(app)
      .get(
        `/api/bookings/ride/${ride.id}`,
      )
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      );

    assert.equal(res.status, 403);

    assert.equal(
      res.body.error,
      "Unauthorized.",
    );
  });

  it("Admin can view bookings for a ride", async () => {
    const ride = await createRide(
      driverToken,
    );

    const res = await request(app)
      .get(
        `/api/bookings/ride/${ride.id}`,
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 200);

    assert.ok(
      Array.isArray(res.body.bookings),
    );
  });

  // =========================================================
  // BOOKING STATUS
  // =========================================================

  it("Rejects an invalid booking ID for status update", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/not-a-number/status",
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        status: "confirmed",
      });

    assert.equal(res.status, 400);
  });

  it("Rejects an invalid booking status", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/1/status",
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        status: "invalid-status",
      });

    assert.equal(res.status, 400);

    assert.equal(
      res.body.error,
      "Invalid booking status.",
    );
  });

  it("Rejects a status update for a missing booking", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/999999/status",
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        status: "confirmed",
      });

    assert.equal(res.status, 404);
  });

  it("Driver can reject a pending booking", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/status`,
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        status: "rejected",
      });

    assert.equal(res.status, 200);

    assert.equal(
      res.body.status,
      "rejected",
    );
  });

  it("Passenger can cancel their own pending booking", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/status`,
      )
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        status: "cancelled",
      });

    assert.equal(res.status, 200);

    assert.equal(
      res.body.status,
      "cancelled",
    );
  });

  it("Passenger cannot confirm their own booking", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/status`,
      )
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        status: "confirmed",
      });

    assert.equal(res.status, 403);
  });

  it("Unauthorized user cannot change another passenger's booking", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/status`,
      )
      .set(
        "Authorization",
        `Bearer ${otherPassengerToken}`,
      )
      .send({
        status: "cancelled",
      });

    assert.equal(res.status, 403);
  });

  // =========================================================
  // PASSENGER CANCEL
  // =========================================================

  it("Rejects an invalid booking ID for cancellation", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/not-a-number/cancel",
      )
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      );

    assert.equal(res.status, 400);
  });

  it("Returns 404 when cancelling a missing booking", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/999999/cancel",
      )
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      );

    assert.equal(res.status, 404);

    assert.equal(
      res.body.error,
      "Booking not found.",
    );
  });

  it("Rejects another passenger from cancelling a booking", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/cancel`,
      )
      .set(
        "Authorization",
        `Bearer ${otherPassengerToken}`,
      );

    assert.equal(res.status, 403);

    assert.equal(
      res.body.error,
      "Not authorized.",
    );
  });

  // =========================================================
  // PAYMENT
  // =========================================================

  it("Rejects an invalid booking ID for payment", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/not-a-number/confirm-payment",
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({});

    assert.equal(res.status, 400);
  });

  it("Returns 404 for a missing payment booking", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/999999/confirm-payment",
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({});

    assert.equal(res.status, 404);

    assert.equal(
      res.body.error,
      "Booking not found.",
    );
  });

  it("Rejects a passenger from confirming payment", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/confirm-payment`,
      )
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      )
      .send({
        paymentMethod: "Cash Payment",
      });

    assert.equal(res.status, 403);

    assert.equal(
      res.body.error,
      "Only the carpool driver can confirm payment.",
    );
  });

  it("Rejects payment for an unconfirmed booking", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/confirm-payment`,
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        paymentMethod: "Cash Payment",
      });

    assert.equal(res.status, 400);

    assert.equal(
      res.body.error,
      "Only confirmed bookings can be completed and paid.",
    );
  });

  it("Rejects an invalid payment method", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const confirm = await request(app)
      .patch(
        `/api/bookings/${booking.id}/status`,
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        status: "confirmed",
      });

    assert.equal(confirm.status, 200);

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/confirm-payment`,
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        paymentMethod:
          "Crypto Currency",
      });

    assert.equal(res.status, 400);

    assert.equal(
      res.body.error,
      "Invalid payment method.",
    );
  });

  it("Rejects a payment amount that does not match the server fare", async () => {
    const ride = await createRide(
      driverToken,
      {
        total_seats: 4,
        price_per_seat: 500,
      },
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
      {
        seats: 2,
      },
    );

    const confirm = await request(app)
      .patch(
        `/api/bookings/${booking.id}/status`,
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        status: "confirmed",
      });

    assert.equal(confirm.status, 200);

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/confirm-payment`,
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        paymentMethod:
          "Cash Payment",
        customAmount: 1,
      });

    assert.equal(res.status, 400);

    assert.equal(
      res.body.error,
      "Payment amount does not match the booking fare.",
    );
  });

  it("Accepts a matching custom payment amount", async () => {
    const ride = await createRide(
      driverToken,
      {
        total_seats: 4,
        price_per_seat: 500,
      },
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
      {
        seats: 2,
      },
    );

    const confirm = await request(app)
      .patch(
        `/api/bookings/${booking.id}/status`,
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        status: "confirmed",
      });

    assert.equal(confirm.status, 200);

    const res = await request(app)
      .patch(
        `/api/bookings/${booking.id}/confirm-payment`,
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        paymentMethod:
          "Cash Payment",
        customAmount: 1000,
      });

    assert.equal(res.status, 200);

    assert.equal(
      res.body.status,
      "completed",
    );

    assert.ok(res.body.receipt);

    assert.equal(
      res.body.receipt.totalPaid,
      1000,
    );
  });

  // =========================================================
  // RECEIPT
  // =========================================================

  it("Rejects an invalid receipt booking ID", async () => {
    const res = await request(app)
      .get(
        "/api/bookings/not-a-number/receipt",
      )
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      );

    assert.equal(res.status, 400);
  });

  it("Returns 404 for a missing receipt booking", async () => {
    const res = await request(app)
      .get(
        "/api/bookings/999999/receipt",
      )
      .set(
        "Authorization",
        `Bearer ${passengerToken}`,
      );

    assert.equal(res.status, 404);

    assert.equal(
      res.body.error,
      "Booking not found.",
    );
  });

  it("Rejects an unauthorized user from accessing a receipt", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .get(
        `/api/bookings/${booking.id}/receipt`,
      )
      .set(
        "Authorization",
        `Bearer ${otherPassengerToken}`,
      );

    assert.equal(res.status, 403);

    assert.equal(
      res.body.error,
      "Not authorized to access this receipt.",
    );
  });

  it("Driver can access their booking receipt", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .get(
        `/api/bookings/${booking.id}/receipt`,
      )
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      );

    assert.equal(res.status, 200);

    assert.ok(res.body.receipt);

    assert.equal(
      res.body.receipt.bookingId,
      booking.id,
    );
  });

  it("Admin can access a booking receipt", async () => {
    const ride = await createRide(
      driverToken,
    );

    const booking = await createBooking(
      passengerToken,
      ride.id,
    );

    const res = await request(app)
      .get(
        `/api/bookings/${booking.id}/receipt`,
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 200);

    assert.ok(res.body.receipt);
  });

  // =========================================================
  // AUTHENTICATION
  // =========================================================

  it("Requires authentication for driver requests", async () => {
    const res = await request(app)
      .get("/api/bookings/driver/requests");

    assert.equal(res.status, 401);
  });

  it("Requires authentication for ride booking lookup", async () => {
    const res = await request(app)
      .get("/api/bookings/ride/1");

    assert.equal(res.status, 401);
  });

  it("Requires authentication for booking status updates", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/1/status",
      )
      .send({
        status: "confirmed",
      });

    assert.equal(res.status, 401);
  });

  it("Requires authentication for booking cancellation", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/1/cancel",
      );

    assert.equal(res.status, 401);
  });

  it("Requires authentication for payment confirmation", async () => {
    const res = await request(app)
      .patch(
        "/api/bookings/1/confirm-payment",
      )
      .send({});

    assert.equal(res.status, 401);
  });

  it("Requires authentication for receipt access", async () => {
    const res = await request(app)
      .get(
        "/api/bookings/1/receipt",
      );

    assert.equal(res.status, 401);
  });
});