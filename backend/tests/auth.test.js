process.env.NODE_ENV = "test";

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");

describe("Authentication API Tests", () => {
  let userToken;
  let adminToken;

  const uniqueEmail = () =>
    `auth-test-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@icbt.edu.lk`;

  const uniqueStudentId = () =>
    `AUTH-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

  // =========================================================
  // TEST SETUP
  // =========================================================

  before(async () => {
    const userLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "nimal.student@icbt.edu.lk",
        password: "student123",
      });

    assert.equal(
      userLogin.status,
      200,
      `Seeded user login failed: ${JSON.stringify(
        userLogin.body,
      )}`,
    );

    assert.ok(userLogin.body.token);

    userToken = userLogin.body.token;

    const adminLogin = await request(app)
      .post("/api/admin/auth/login")
      .send({
        email: "admin@icbt.edu.lk",
        password: "admin123",
      });

    assert.equal(
      adminLogin.status,
      200,
      `Admin login failed: ${JSON.stringify(
        adminLogin.body,
      )}`,
    );

    assert.ok(adminLogin.body.token);

    adminToken = adminLogin.body.token;
  });

  // =========================================================
  // REGISTRATION
  // =========================================================

  it("Registers a new student account successfully", async () => {
    const email = uniqueEmail();
    const studentStaffId = uniqueStudentId();

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Authentication Test User",
        email,
        password: "test123",
        role: "student",
        student_staff_id: studentStaffId,
        phone: "0771234567",
      });

    assert.equal(
      res.status,
      201,
      `Registration failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.equal(
      res.body.message,
      "Account created successfully",
    );

    assert.ok(res.body.token);
    assert.ok(res.body.user);

    assert.equal(
      res.body.user.name,
      "Authentication Test User",
    );

    assert.equal(
      res.body.user.email,
      email,
    );

    assert.equal(
      res.body.user.role,
      "student",
    );

    // Client must never be able to create an admin.
    assert.equal(
      res.body.user.system_role,
      "user",
    );

    assert.equal(
      res.body.user.student_staff_id,
      studentStaffId,
    );

    assert.equal(
      res.body.user.driver_verification,
      null,
    );

    assert.equal(
      res.body.user.passenger_verification,
      null,
    );

    // Password hash must not be exposed.
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body.user,
        "password_hash",
      ),
      false,
    );
  });

  it("Rejects registration when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Name, email, and password are required/i,
    );
  });

  it("Rejects a registration with an invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: "invalid-email",
        password: "test123",
        role: "student",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /valid email address/i,
    );
  });

  it("Rejects a registration with a short name", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "A",
        email: uniqueEmail(),
        password: "test123",
        role: "student",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /at least 2 characters/i,
    );
  });

  it("Rejects a registration with a long name", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "A".repeat(101),
        email: uniqueEmail(),
        password: "test123",
        role: "student",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /must not exceed 100 characters/i,
    );
  });

  it("Rejects a registration with a short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: uniqueEmail(),
        password: "12345",
        role: "student",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /at least 6 characters/i,
    );
  });

  it("Rejects a registration with an overly long password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: uniqueEmail(),
        password: "A".repeat(129),
        role: "student",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /must not exceed 128 characters/i,
    );
  });

  it("Rejects an invalid account role", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Invalid Role User",
        email: uniqueEmail(),
        password: "test123",
        role: "admin",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Only student or staff accounts are allowed/i,
    );
  });

  it("Prevents client-side administrator creation", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Fake Admin User",
        email: uniqueEmail(),
        password: "test123",
        role: "staff",
        system_role: "admin",
      });

    assert.equal(
      res.status,
      201,
      `Registration failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.equal(
      res.body.user.system_role,
      "user",
    );
  });

  it("Rejects duplicate email registration", async () => {
    const email = uniqueEmail();
    const studentStaffId = uniqueStudentId();

    const first = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Duplicate Test User",
        email,
        password: "test123",
        role: "student",
        student_staff_id: studentStaffId,
      });

    assert.equal(
      first.status,
      201,
      `First registration failed: ${JSON.stringify(
        first.body,
      )}`,
    );

    const second = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Duplicate Test User",
        email,
        password: "test123",
        role: "student",
      });

    assert.equal(second.status, 409);

    assert.match(
      second.body.error,
      /already exists/i,
    );
  });

  it("Normalizes registration email to lowercase", async () => {
    const email = uniqueEmail().toUpperCase();

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Email Normalization User",
        email,
        password: "test123",
        role: "student",
      });

    assert.equal(
      res.status,
      201,
      `Registration failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.equal(
      res.body.user.email,
      email.toLowerCase(),
    );
  });

  // =========================================================
  // LOGIN
  // =========================================================

  it("Logs in a valid normal user", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "nimal.student@icbt.edu.lk",
        password: "student123",
      });

    assert.equal(res.status, 200);

    assert.equal(
      res.body.message,
      "Logged in successfully",
    );

    assert.ok(res.body.token);
    assert.ok(res.body.user);

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body.user,
        "password_hash",
      ),
      false,
    );
  });

  it("Accepts login email case-insensitively", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "NIMAL.STUDENT@ICBT.EDU.LK",
        password: "student123",
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it("Rejects login with missing credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "nimal.student@icbt.edu.lk",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Email and password are required/i,
    );
  });

  it("Rejects login with an invalid email format", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "not-an-email",
        password: "student123",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /valid email address/i,
    );
  });

  it("Rejects login for an unknown account", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: uniqueEmail(),
        password: "student123",
      });

    assert.equal(res.status, 401);

    assert.equal(
      res.body.error,
      "Invalid email or password.",
    );
  });

  it("Rejects login with an incorrect password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "nimal.student@icbt.edu.lk",
        password: "wrong-password",
      });

    assert.equal(res.status, 401);

    assert.equal(
      res.body.error,
      "Invalid email or password.",
    );
  });

  it("Blocks administrator from normal user login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@icbt.edu.lk",
        password: "admin123",
      });

    assert.equal(res.status, 403);

    assert.match(
      res.body.error,
      /Admin Portal/i,
    );
  });

  // =========================================================
  // /ME
  // =========================================================

  it("Rejects unauthenticated access to /me", async () => {
    const res = await request(app)
      .get("/api/auth/me");

    assert.equal(res.status, 401);
  });

  it("Rejects /me with an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set(
        "Authorization",
        "Bearer invalid-token",
      );

    assert.equal(res.status, 403);
  });

  it("Returns the authenticated user's profile", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      );

    assert.equal(res.status, 200);

    assert.ok(res.body.user);
    assert.ok(res.body.user.id);
    assert.ok(res.body.user.email);

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body.user,
        "password_hash",
      ),
      false,
    );
  });

  // =========================================================
  // PROFILE UPDATE
  // =========================================================

  it("Rejects unauthenticated profile updates", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .send({
        name: "Unauthenticated Update",
      });

    assert.equal(res.status, 401);
  });

  it("Rejects a profile update with an invalid name type", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        name: 12345,
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Name must be a string/i,
    );
  });

  it("Rejects a profile update with a too-short name", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        name: "A",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /between 2 and 100 characters/i,
    );
  });

  it("Rejects a profile update with a too-long name", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        name: "A".repeat(101),
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /between 2 and 100 characters/i,
    );
  });

  it("Updates the authenticated user's profile", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        name: "Updated Authentication User",
        phone: "0711111111",
        student_staff_id: "UPDATED-001",
      });

    assert.equal(res.status, 200);

    assert.ok(res.body.user);

    assert.equal(
      res.body.user.name,
      "Updated Authentication User",
    );

    assert.equal(
      res.body.user.phone,
      "0711111111",
    );

    assert.equal(
      res.body.user.student_staff_id,
      "UPDATED-001",
    );
  });

  // =========================================================
  // PASSWORD UPDATE
  // =========================================================

  it("Rejects a password update without current password", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        new_password: "newpass123",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Current password is required/i,
    );
  });

  it("Rejects a password update with an incorrect current password", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        current_password: "wrong-password",
        new_password: "newpass123",
      });

    assert.equal(res.status, 401);

    assert.match(
      res.body.error,
      /Current password is incorrect/i,
    );
  });

  it("Rejects a password update with a short new password", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        current_password: "student123",
        new_password: "12345",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /at least 6 characters/i,
    );
  });

  it("Rejects a password update with an overly long new password", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        current_password: "student123",
        new_password: "A".repeat(129),
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /must not exceed 128 characters/i,
    );
  });

  it("Rejects an empty new password", async () => {
    const res = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        current_password: "student123",
        new_password: "",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /New password must be provided/i,
    );
  });

  it("Updates and restores the authenticated user's password", async () => {
    const originalPassword = "student123";
    const newPassword = "newStudent123";

    const update = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      )
      .send({
        current_password: originalPassword,
        new_password: newPassword,
      });

    assert.equal(
      update.status,
      200,
      `Password update failed: ${JSON.stringify(
        update.body,
      )}`,
    );

    const login = await request(app)
      .post("/api/auth/login")
      .send({
        email: "nimal.student@icbt.edu.lk",
        password: newPassword,
      });

    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    const restore = await request(app)
      .put("/api/auth/profile")
      .set(
        "Authorization",
        `Bearer ${login.body.token}`,
      )
      .send({
        current_password: newPassword,
        new_password: originalPassword,
      });

    assert.equal(
      restore.status,
      200,
      `Password restore failed: ${JSON.stringify(
        restore.body,
      )}`,
    );
  });

  // =========================================================
  // ADMIN SETUP CHECK
  // =========================================================

  it("Successfully authenticates the dedicated admin portal", async () => {
    assert.ok(adminToken);
  });
});