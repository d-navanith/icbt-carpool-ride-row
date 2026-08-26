const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");
const db = require("../src/db");

describe("Driver & Passenger Verification API Tests", () => {
  let driverToken;
  let passengerToken;

  let createdDriverUserToken;
  let createdPassengerUserToken;

  let driverVerificationId;
  let passengerVerificationId;

  const uniqueEmail = (prefix = "verification") =>
    `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@icbt.edu.lk`;

  const uniqueStudentStaffId = () =>
    `VER-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // =========================================================
  // SETUP
  // =========================================================

  before(async () => {
    const driverLogin = await request(app).post("/api/auth/login").send({
      email: "kamal.driver@icbt.edu.lk",
      password: "driver123",
    });

    assert.equal(
      driverLogin.status,
      200,
      `Driver login failed: ${JSON.stringify(driverLogin.body)}`,
    );

    assert.ok(driverLogin.body.token);

    driverToken = driverLogin.body.token;

    const passengerLogin = await request(app).post("/api/auth/login").send({
      email: "nimal.student@icbt.edu.lk",
      password: "student123",
    });

    assert.equal(
      passengerLogin.status,
      200,
      `Passenger login failed: ${JSON.stringify(passengerLogin.body)}`,
    );

    assert.ok(passengerLogin.body.token);

    passengerToken = passengerLogin.body.token;

    // -------------------------------------------------------
    // Create a fresh user for testing a NEW driver
    // verification record.
    // -------------------------------------------------------

    const newDriver = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Verification Driver Test",
        email: uniqueEmail("driver"),
        password: "test123",
        role: "student",
        student_staff_id: uniqueStudentStaffId(),
        phone: "0710000001",
      });

    assert.equal(
      newDriver.status,
      201,
      `Test driver creation failed: ${JSON.stringify(newDriver.body)}`,
    );

    assert.ok(newDriver.body.token);

    createdDriverUserToken = newDriver.body.token;

    // -------------------------------------------------------
    // Create a fresh user for testing a NEW passenger
    // verification record.
    // -------------------------------------------------------

    const newPassenger = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Verification Passenger Test",
        email: uniqueEmail("passenger"),
        password: "test123",
        role: "student",
        student_staff_id: uniqueStudentStaffId(),
        phone: "0710000002",
      });

    assert.equal(
      newPassenger.status,
      201,
      `Test passenger creation failed: ${JSON.stringify(newPassenger.body)}`,
    );

    assert.ok(newPassenger.body.token);

    createdPassengerUserToken = newPassenger.body.token;
  });

  // =========================================================
  // DRIVER VERIFICATION
  // =========================================================

  it("Rejects driver verification submission without authentication", async () => {
    const res = await request(app).post("/api/verification/driver").send({
      license_number: "B1234567",
      vehicle_model: "Toyota Prius",
      vehicle_plate: "WP-CAB-4521",
      seats: 4,
      fuel_type: "Hybrid",
    });

    assert.equal(res.status, 401);
  });

  it("Rejects driver verification with missing required fields", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4521",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Valid license number, vehicle model, and vehicle plate number are required/i,
    );
  });

  it("Rejects driver verification with an overly long license number", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "A".repeat(101),
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4521",
        seats: 4,
        fuel_type: "Hybrid",
      });

    assert.equal(res.status, 400);
  });

  it("Rejects driver verification with an overly long vehicle model", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "A".repeat(101),
        vehicle_plate: "WP-CAB-4521",
        seats: 4,
        fuel_type: "Hybrid",
      });

    assert.equal(res.status, 400);
  });

  it("Rejects driver verification with an overly long vehicle plate", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "A".repeat(31),
        seats: 4,
        fuel_type: "Hybrid",
      });

    assert.equal(res.status, 400);
  });

  it("Rejects invalid seat count below minimum", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4521",
        seats: 0,
        fuel_type: "Hybrid",
      });

    assert.equal(res.status, 400);

    assert.match(res.body.error, /between 1 and 12/i);
  });

  it("Rejects invalid seat count above maximum", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4521",
        seats: 13,
        fuel_type: "Hybrid",
      });

    assert.equal(res.status, 400);

    assert.match(res.body.error, /between 1 and 12/i);
  });

  it("Uses the default seat count when seats are omitted", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4522",
        fuel_type: "Hybrid",
      });

    assert.equal(
      res.status,
      200,
      `Unexpected response: ${JSON.stringify(res.body)}`,
    );

    assert.ok(res.body.driver_verification);

    assert.equal(res.body.driver_verification.seats, 3);
  });

  it("Uses Petrol as the default fuel type", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4524",
        seats: 4,
      });

    assert.equal(res.status, 200);

    assert.equal(res.body.driver_verification.fuel_type, "Petrol");
  });

  it("Rejects invalid fuel type", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4525",
        seats: 4,
        fuel_type: "Kerosene",
      });

    assert.equal(res.status, 400);

    assert.match(res.body.error, /Invalid fuel type/i);
  });

  it("Rejects invalid document URL", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4526",
        seats: 4,
        fuel_type: "Hybrid",
        license_doc_url: "javascript:alert(1)",
      });

    assert.equal(res.status, 400);

    assert.match(res.body.error, /valid HTTP\/HTTPS URLs/i);
  });

  it("Rejects an overly long document URL", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4527",
        seats: 4,
        fuel_type: "Hybrid",
        license_doc_url: `https://example.com/${"a".repeat(1001)}`,
      });

    assert.equal(res.status, 400);
  });

  it("Accepts a valid driver verification submission", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B1234567",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4528",
        seats: 4,
        fuel_type: "Hybrid",
        license_doc_url: "https://example.com/license.pdf",
        vehicle_photo_url: "https://example.com/car.jpg",
      });

    assert.equal(
      res.status,
      200,
      `Unexpected response: ${JSON.stringify(res.body)}`,
    );

    assert.ok(res.body.driver_verification);

    driverVerificationId = res.body.driver_verification.id;

    assert.equal(res.body.driver_verification.status, "pending");

    assert.equal(res.body.driver_verification.seats, 4);

    assert.equal(res.body.driver_verification.fuel_type, "Hybrid");

    assert.equal(res.body.driver_verification.vehicle_plate, "WP-CAB-4528");

    assert.equal(res.body.driver_verification.odd_even_type, "EVEN");
  });

  it("Calculates ODD vehicle classification from the plate number", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B7654321",
        vehicle_model: "Honda Fit",
        vehicle_plate: "WP-CAB-4523",
        seats: 4,
        fuel_type: "Petrol",
      });

    assert.equal(res.status, 200);

    assert.equal(res.body.driver_verification.odd_even_type, "ODD");
  });

  it("Uses safe default document URLs when document URLs are omitted", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B7654322",
        vehicle_model: "Honda Fit",
        vehicle_plate: "WP-CAB-4520",
        seats: 4,
        fuel_type: "Petrol",
      });

    assert.equal(res.status, 200);

    assert.ok(res.body.driver_verification.license_doc_url);

    assert.ok(res.body.driver_verification.vehicle_photo_url);

    assert.match(res.body.driver_verification.license_doc_url, /^https:\/\//);

    assert.match(res.body.driver_verification.vehicle_photo_url, /^https:\/\//);
  });

  it("Updates an existing driver verification application", async () => {
    assert.ok(
      driverVerificationId,
      "Driver verification record was not created.",
    );

    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "UPDATED-999",
        vehicle_model: "Toyota Aqua",
        vehicle_plate: "WP-CAB-4529",
        seats: 5,
        fuel_type: "Electric",
        license_doc_url: "https://example.com/updated-license.pdf",
        vehicle_photo_url: "https://example.com/updated-car.jpg",
      });

    assert.equal(
      res.status,
      200,
      `Unexpected response: ${JSON.stringify(res.body)}`,
    );

    assert.equal(res.body.driver_verification.id, driverVerificationId);

    assert.equal(res.body.driver_verification.status, "pending");

    assert.equal(res.body.driver_verification.license_number, "UPDATED-999");

    assert.equal(res.body.driver_verification.vehicle_model, "Toyota Aqua");

    assert.equal(res.body.driver_verification.vehicle_plate, "WP-CAB-4529");

    assert.equal(res.body.driver_verification.seats, 5);

    assert.equal(res.body.driver_verification.fuel_type, "Electric");

    assert.equal(
      res.body.driver_verification.admin_comment,
      "Updated credentials submitted for review",
    );
  });

  // =========================================================
  // DRIVER VERIFICATION STATUS
  // =========================================================

  it("Returns current driver verification status", async () => {
    const res = await request(app)
      .get("/api/verification/driver/status")
      .set("Authorization", `Bearer ${createdDriverUserToken}`);

    assert.equal(res.status, 200);

    assert.equal(res.body.status, "pending");

    assert.equal(res.body.verified, false);

    assert.ok(res.body.details);
  });

  it("Returns unverified status for a user without a driver verification record", async () => {
    const res = await request(app)
      .get("/api/verification/driver/status")
      .set("Authorization", `Bearer ${createdPassengerUserToken}`);

    assert.equal(res.status, 200);

    assert.equal(res.body.status, "unverified");

    assert.equal(res.body.verified, false);

    assert.equal(res.body.details, null);
  });

  it("Accepts fuel types case-insensitively", async () => {
    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${createdDriverUserToken}`)
      .send({
        license_number: "B7654321",
        vehicle_model: "Toyota Prius",
        vehicle_plate: "WP-CAB-4522",
        seats: 4,
        fuel_type: "hybrid",
      });

    assert.equal(res.status, 200);
  });

  // =========================================================
  // PASSENGER VERIFICATION
  // =========================================================

  it("Rejects passenger verification submission without authentication", async () => {
    const res = await request(app).post("/api/verification/passenger").send({
      id_card_number: "ICBT-STU-1001",
    });

    assert.equal(res.status, 401);
  });

  it("Rejects passenger verification with missing ID card number", async () => {
    const res = await request(app)
      .post("/api/verification/passenger")
      .set("Authorization", `Bearer ${createdPassengerUserToken}`)
      .send({
        id_doc_url: "https://example.com/id.pdf",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Valid Student\/Staff ID card number is required/i,
    );
  });

  it("Rejects passenger verification with an empty ID card number", async () => {
    const res = await request(app)
      .post("/api/verification/passenger")
      .set("Authorization", `Bearer ${createdPassengerUserToken}`)
      .send({
        id_card_number: "   ",
      });

    assert.equal(res.status, 400);
  });

  it("Rejects an overly long passenger ID card number", async () => {
    const res = await request(app)
      .post("/api/verification/passenger")
      .set("Authorization", `Bearer ${createdPassengerUserToken}`)
      .send({
        id_card_number: "A".repeat(101),
      });

    assert.equal(res.status, 400);
  });

  it("Rejects an invalid passenger document URL", async () => {
    const res = await request(app)
      .post("/api/verification/passenger")
      .set("Authorization", `Bearer ${createdPassengerUserToken}`)
      .send({
        id_card_number: "ICBT-STU-1002",
        id_doc_url: "javascript:alert(1)",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /ID document URL must be a valid HTTP\/HTTPS URL/i,
    );
  });

  it("Accepts a valid passenger verification submission", async () => {
    const res = await request(app)
      .post("/api/verification/passenger")
      .set("Authorization", `Bearer ${createdPassengerUserToken}`)
      .send({
        id_card_number: "ICBT-STU-1003",
        id_doc_url: "https://example.com/id-card.pdf",
      });

    assert.equal(
      res.status,
      200,
      `Unexpected response: ${JSON.stringify(res.body)}`,
    );

    assert.equal(res.body.message, "Passenger verified successfully.");

    assert.ok(res.body.passenger_verification);

    passengerVerificationId = res.body.passenger_verification.id;

    assert.equal(res.body.passenger_verification.status, "approved");

    assert.equal(
      res.body.passenger_verification.id_card_number,
      "ICBT-STU-1003",
    );
  });

  it("Allows passenger verification submission without a document URL", async () => {
    const res = await request(app)
      .post("/api/verification/passenger")
      .set("Authorization", `Bearer ${createdPassengerUserToken}`)
      .send({
        id_card_number: "ICBT-STU-1004",
      });

    assert.equal(
      res.status,
      200,
      `Unexpected response: ${JSON.stringify(res.body)}`,
    );

    assert.equal(res.body.passenger_verification.status, "approved");

    assert.equal(res.body.passenger_verification.id_doc_url, "");
  });

  it("Updates an existing passenger verification", async () => {
    assert.ok(
      passengerVerificationId,
      "Passenger verification record was not created.",
    );

    const res = await request(app)
      .post("/api/verification/passenger")
      .set("Authorization", `Bearer ${createdPassengerUserToken}`)
      .send({
        id_card_number: "UPDATED-STU-999",
        id_doc_url: "https://example.com/updated-id.pdf",
      });

    assert.equal(
      res.status,
      200,
      `Unexpected response: ${JSON.stringify(res.body)}`,
    );

    assert.equal(res.body.passenger_verification.id, passengerVerificationId);

    assert.equal(res.body.passenger_verification.status, "approved");

    assert.equal(
      res.body.passenger_verification.id_card_number,
      "UPDATED-STU-999",
    );

    assert.equal(
      res.body.passenger_verification.admin_comment,
      "Auto-verified with campus registry",
    );
  });

  // =========================================================
  // ACTIVE USER / SUSPENDED USER BRANCHES
  // =========================================================

  it("Rejects verification submission for a suspended user", async () => {
    const email = uniqueEmail("suspended");

    const create = await request(app).post("/api/auth/register").send({
      name: "Suspended Verification User",
      email,
      password: "test123",
      role: "student",
      student_staff_id: uniqueStudentStaffId(),
    });

    assert.equal(
      create.status,
      201,
      `Suspended user creation failed: ${JSON.stringify(create.body)}`,
    );

    const token = create.body.token;

    const userId = create.body.user.id;

    db.prepare(
      `
      UPDATE users
      SET suspended = 1
      WHERE id = ?
      `,
    ).run(userId);

    const res = await request(app)
      .post("/api/verification/driver")
      .set("Authorization", `Bearer ${token}`)
      .send({
        license_number: "SUSP-123",
        vehicle_model: "Honda Fit",
        vehicle_plate: "WP-CAB-4531",
        seats: 4,
        fuel_type: "Petrol",
      });

    assert.equal(res.status, 403);

    assert.match(res.body.error, /account has been suspended/i);

    // Restore test data.
    db.prepare(
      `
      UPDATE users
      SET suspended = 0
      WHERE id = ?
      `,
    ).run(userId);
  });

  // =========================================================
  // AUTHORIZATION / ROUTE PROTECTION
  // =========================================================

  it("Rejects unauthenticated driver verification status requests", async () => {
    const res = await request(app).get("/api/verification/driver/status");

    assert.equal(res.status, 401);
  });

  it("Rejects unauthenticated passenger verification requests", async () => {
    const res = await request(app).post("/api/verification/passenger").send({
      id_card_number: "ICBT-UNAUTH-001",
    });

    assert.equal(res.status, 401);
  });
});
