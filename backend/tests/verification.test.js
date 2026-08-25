const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");

describe("Driver Verification API Tests", () => {
  let driverToken;

  before(async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({
        email: "sanduni.user@icbt.edu.lk",
        password: "user123",
      });

    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    driverToken = login.body.token;
  });

  it("Rejects driver verification submission without authentication", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .send({
        license_number: "B-1234567-LK",
        vehicle_model: "Toyota Aqua",
        vehicle_plate: "WP-CAR-1234",
      });

    assert.equal(res.status, 401);
  });

  it("Rejects driver verification with missing required fields", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        license_number: "B-1234567-LK",
      });

    assert.equal(res.status, 400);
    assert.match(
      res.body.error,
      /license number, vehicle model, and vehicle plate/i,
    );
  });

  it("Rejects invalid seat count below minimum", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        license_number: "B-1234567-LK",
        vehicle_model: "Toyota Aqua",
        vehicle_plate: "WP-CAR-1234",
        seats: 0,
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /seat count/i);
  });

  it("Rejects invalid seat count above maximum", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        license_number: "B-1234567-LK",
        vehicle_model: "Toyota Aqua",
        vehicle_plate: "WP-CAR-1234",
        seats: 13,
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /seat count/i);
  });

  it("Rejects invalid fuel type", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        license_number: "B-1234567-LK",
        vehicle_model: "Toyota Aqua",
        vehicle_plate: "WP-CAR-1234",
        fuel_type: "Nuclear",
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /fuel type/i);
  });

  it("Rejects invalid document URL", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        license_number: "B-1234567-LK",
        vehicle_model: "Toyota Aqua",
        vehicle_plate: "WP-CAR-1234",
        license_doc_url: "javascript:alert(1)",
      });

    assert.equal(res.status, 400);
    assert.match(res.body.error, /URLs must be valid/i);
  });

  it("Accepts a valid driver verification submission", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${driverToken}`)
      .send({
        license_number: "B-1234567-LK",
        vehicle_model: "Toyota Aqua",
        vehicle_plate: "WP-CAR-1235",
        seats: 4,
        fuel_type: "Hybrid",
        license_doc_url: "https://example.com/license.pdf",
        vehicle_photo_url: "https://example.com/car.jpg",
      });

    assert.equal(res.status, 200);
    assert.equal(
      res.body.driver_verification.status,
      "pending",
    );
    assert.equal(
      res.body.driver_verification.vehicle_plate,
      "WP-CAR-1235",
    );
    assert.equal(
      res.body.driver_verification.seats,
      4,
    );
    assert.ok(
      ["ODD", "EVEN"].includes(
        res.body.driver_verification.odd_even_type,
      ),
    );
  });

  it("Returns current driver verification status", async () => {
    const res = await request(app)
      .get("/api/verification/driver/status")
      .set("Authorization", `Bearer ${driverToken}`);

    assert.equal(res.status, 200);
    assert.equal(typeof res.body.verified, "boolean");
    assert.ok(res.body.status);
  });
});