const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");

describe("Ride API Tests", () => {
  let driverToken;
  let passengerToken;

  const tomorrow = () => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  };

  const createTestRide = async ({
    origin = "Test Origin",
    destination = "ICBT Colombo Campus",
    departureTime = "08:30",
    returnTime = undefined,
    totalSeats = 4,
    pricePerSeat = 300,
    notes = "Automated lifecycle test",
  } = {}) => {
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        origin,
        destination,
        departure_date: tomorrow(),
        departure_time: departureTime,
        ...(returnTime !== undefined ? { return_time: returnTime } : {}),
        total_seats: totalSeats,
        price_per_seat: pricePerSeat,
        notes,
      });

    assert.equal(
      res.status,
      201,
      `Ride creation failed: ${JSON.stringify(res.body)}`,
    );

    assert.ok(res.body.ride?.id);

    return res.body.ride.id;
  };

  before(async () => {
    const driverLogin = await request(app).post("/api/auth/login").send({
      email: "kamal.driver@icbt.edu.lk",
      password: "driver123",
    });

    assert.equal(driverLogin.status, 200);
    assert.ok(driverLogin.body.token);
    driverToken = driverLogin.body.token;

    const passengerLogin = await request(app).post("/api/auth/login").send({
      email: "nimal.student@icbt.edu.lk",
      password: "student123",
    });

    assert.equal(passengerLogin.status, 200);
    assert.ok(passengerLogin.body.token);
    passengerToken = passengerLogin.body.token;
  });

  it("Searches available rides successfully", async () => {
    const res = await request(app).get("/api/rides").query({
      origin: "Gampaha",
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.rides));
  });

  it("Rejects unauthenticated access to my rides", async () => {
    const res = await request(app).get("/api/rides/my-rides");

    assert.equal(res.status, 401);
  });

  it("Retrieves authenticated driver's rides", async () => {
    const res = await request(app)
      .get("/api/rides/my-rides")
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.rides));
  });

  it("Returns 404 for a missing ride", async () => {
    const res = await request(app).get("/api/rides/999999");

    assert.equal(res.status, 404);
  });

  it("Rejects ride creation when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        origin: "Gampaha",
      });

    assert.equal(res.status, 400);
    assert.match(
      res.body.error,
      /origin, destination, departure date and departure time/i,
    );
  });

  it("Rejects invalid departure date", async () => {
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        origin: "Gampaha",
        destination: "ICBT Colombo Campus",
        departure_date: "25-08-2026",
        departure_time: "07:30",
        total_seats: 4,
        price_per_seat: 300,
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /YYYY-MM-DD/i);
  });

  it("Rejects more than 12 seats", async () => {
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        origin: "Gampaha",
        destination: "ICBT Colombo Campus",
        departure_date: tomorrow(),
        departure_time: "07:30",
        total_seats: 13,
        price_per_seat: 300,
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /more than 12 seats/i);
  });

  it("Rejects negative ride price", async () => {
    const res = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        origin: "Gampaha",
        destination: "ICBT Colombo Campus",
        departure_date: tomorrow(),
        departure_time: "07:30",
        total_seats: 4,
        price_per_seat: -1,
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /non-negative number/i);
  });

  it("Approved driver can create a ride", async () => {
    const rideId = await createTestRide({
      origin: "Gampaha Test Point",
      destination: "ICBT Colombo Campus",
      departureTime: "08:00",
      returnTime: "17:00",
      totalSeats: 4,
      pricePerSeat: 300,
      notes: "Automated ride test",
    });

    const res = await request(app).get(`/api/rides/${rideId}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.ride);

    assert.equal(res.body.ride.id, rideId);
    assert.equal(res.body.ride.available_seats, 4);
    assert.equal(res.body.ride.status, "active");
    assert.equal(res.body.ride.origin, "Gampaha Test Point");
  });

  it("Passenger cannot modify driver's ride status", async () => {
    const rideId = await createTestRide();

    const res = await request(app)
      .patch(`/api/rides/${rideId}/status`)
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        status: "completed",
      });

    assert.equal(res.status, 403);
  });

  it("Rejects invalid ride status", async () => {
    const rideId = await createTestRide();

    const res = await request(app)
      .patch(`/api/rides/${rideId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        status: "invalid-status",
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid ride status/i);
  });

  it("Driver can update ride status", async () => {
    const rideId = await createTestRide();

    const res = await request(app)
      .patch(`/api/rides/${rideId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        status: "completed",
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, "completed");
  });

  it("Unauthorised user cannot trigger ride SOS", async () => {
    const rideId = await createTestRide();

    const res = await request(app)
      .post(`/api/rides/${rideId}/sos`)
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        message: "Test SOS",
        location: "Gampaha",
      });

    assert.equal(res.status, 403);
  });

  it("Driver can trigger ride SOS", async () => {
    const rideId = await createTestRide();

    const res = await request(app)
      .post(`/api/rides/${rideId}/sos`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        message: "Test emergency alert",
        location: "Gampaha",
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.alert);
    assert.equal(res.body.alert.rideId, rideId);
    assert.equal(res.body.alert.userId > 0, true);
  });

  it("Passenger cannot complete the ride", async () => {
    const rideId = await createTestRide();

    const res = await request(app)
      .patch(`/api/rides/${rideId}/complete`)
      .set("Authorization", `Bearer ${passengerToken}`);

    assert.equal(res.status, 403);
  });

  it("Driver can complete an active ride", async () => {
    const rideId = await createTestRide();

    const res = await request(app)
      .patch(`/api/rides/${rideId}/complete`)
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.rideId, rideId);
  });

  it("Rejects completion of an already completed ride", async () => {
    const rideId = await createTestRide();

    const first = await request(app)
      .patch(`/api/rides/${rideId}/complete`)
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(first.status, 200);

    const second = await request(app)
      .patch(`/api/rides/${rideId}/complete`)
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(second.status, 400);
    assert.match(second.body.error, /already completed/i);
  });

  it("Approved driver can create a second ride for cancellation testing", async () => {
    const rideId = await createTestRide({
      origin: "Kaduwela Test Point",
      destination: "ICBT Colombo Campus",
      departureTime: "09:00",
      totalSeats: 3,
      pricePerSeat: 250,
      notes: "Cancellation lifecycle test",
    });

    assert.ok(rideId);
  });

  it("Passenger cannot cancel driver's ride", async () => {
    const rideId = await createTestRide({
      origin: "Passenger Authorization Test",
      departureTime: "09:15",
    });

    const res = await request(app)
      .patch(`/api/rides/${rideId}/cancel`)
      .set("Authorization", `Bearer ${passengerToken}`);

    assert.equal(res.status, 403);
    assert.match(res.body.error, /Only the driver can cancel this ride/i);
  });

  it("Driver can cancel an active ride", async () => {
    const rideId = await createTestRide({
      origin: "Cancellation Test Point",
      departureTime: "09:30",
    });

    const res = await request(app)
      .patch(`/api/rides/${rideId}/cancel`)
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.message, "Ride cancelled");
    assert.equal(typeof res.body.affectedPassengers, "number");
  });

  it("Rejects cancellation of an already cancelled ride", async () => {
    const rideId = await createTestRide({
      origin: "Cancelled Ride Test Point",
      departureTime: "09:45",
    });

    const first = await request(app)
      .patch(`/api/rides/${rideId}/cancel`)
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(first.status, 200);

    const second = await request(app)
      .patch(`/api/rides/${rideId}/cancel`)
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(second.status, 400);
    assert.match(second.body.error, /active rides/i);
  });
});
