const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");

describe("Admin & Verification API Tests", () => {
  let adminToken;
  let userToken;
  let verificationId;

  let disposableUserId;
  let disposableAdminEmail;

  const uniqueEmail = () =>
    `admin-test-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@icbt.edu.lk`;

  const uniqueStudentId = () =>
    `ADMIN-TEST-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

  // =========================================================
  // SETUP
  // =========================================================

  before(async () => {
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

    adminToken =
      adminLogin.body.token;

    const userLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "kamal.driver@icbt.edu.lk",
        password: "driver123",
      });

    assert.equal(
      userLogin.status,
      200,
      `User login failed: ${JSON.stringify(
        userLogin.body,
      )}`,
    );

    assert.ok(userLogin.body.token);

    userToken =
      userLogin.body.token;
  });

  // =========================================================
  // DASHBOARD
  // =========================================================

  it("Admin can retrieve dashboard statistics", async () => {
    const res = await request(app)
      .get("/api/admin/stats")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 200);
    assert.ok(res.body.stats);

    assert.equal(
      typeof res.body.stats.totalUsers,
      "number",
    );

    assert.equal(
      typeof res.body.stats.totalRides,
      "number",
    );

    assert.equal(
      typeof res.body.stats.totalBookings,
      "number",
    );
  });

  // =========================================================
  // VERIFICATION QUEUE
  // =========================================================

  it("Admin can retrieve verification queue", async () => {
    const res = await request(app)
      .get("/api/admin/verifications")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 200);

    assert.ok(
      Array.isArray(
        res.body.driverVerifications,
      ),
    );

    assert.ok(
      Array.isArray(
        res.body.passengerVerifications,
      ),
    );

    if (
      res.body.driverVerifications.length >
      0
    ) {
      verificationId =
        res.body.driverVerifications[0].id;
    }
  });

  it("Normal user cannot access admin statistics", async () => {
    const res = await request(app)
      .get("/api/admin/stats")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      );

    assert.equal(res.status, 403);
  });

  it("Normal user cannot access verification queue", async () => {
    const res = await request(app)
      .get("/api/admin/verifications")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      );

    assert.equal(res.status, 403);
  });

  // =========================================================
  // DRIVER VERIFICATION ACTIONS
  // =========================================================

  it("Admin rejects invalid driver verification action", async () => {
    assert.ok(
      verificationId,
      "No driver verification record was available for this test.",
    );

    const res = await request(app)
      .post(
        `/api/admin/verifications/driver/${verificationId}/action`,
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        action: "invalid-action",
        comment: "Invalid test action",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Action must be approved or rejected/i,
    );
  });

  it("Admin rejects action for a missing verification record", async () => {
    const res = await request(app)
      .post(
        "/api/admin/verifications/driver/999999/action",
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        action: "approved",
        comment: "Test",
      });

    assert.equal(res.status, 404);

    assert.match(
      res.body.error,
      /Verification record not found/i,
    );
  });

  // =========================================================
  // USERS & RIDES
  // =========================================================

  it("Admin can retrieve all users", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 200);
    assert.ok(
      Array.isArray(res.body.users),
    );
  });

  it("Admin can retrieve all rides", async () => {
    const res = await request(app)
      .get("/api/admin/rides")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 200);
    assert.ok(
      Array.isArray(res.body.rides),
    );
  });

  // =========================================================
  // ADMIN ACCOUNT
  // =========================================================

  it("Admin can retrieve their administrator account", async () => {
    const res = await request(app)
      .get("/api/admin/account")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 200);
    assert.ok(res.body.admin);

    assert.ok(res.body.admin.id);
    assert.equal(
      res.body.admin.system_role,
      "admin",
    );

    assert.equal(
      res.body.admin.email,
      "admin@icbt.edu.lk",
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        res.body.admin,
        "password_hash",
      ),
      false,
    );
  });

  it("Normal user cannot retrieve administrator account", async () => {
    const res = await request(app)
      .get("/api/admin/account")
      .set(
        "Authorization",
        `Bearer ${userToken}`,
      );

    assert.equal(res.status, 403);
  });

  it("Admin can update their administrator profile", async () => {
    const current = await request(app)
      .get("/api/admin/account")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(current.status, 200);

    const admin =
      current.body.admin;

    const res = await request(app)
      .put("/api/admin/account/profile")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        name: admin.name,
        phone: admin.phone,
        student_staff_id:
          admin.student_staff_id,
      });

    assert.equal(res.status, 200);

    assert.equal(
      res.body.message,
      "Administrator profile updated successfully.",
    );

    assert.ok(res.body.admin);
    assert.equal(
      res.body.admin.system_role,
      "admin",
    );
  });

  it("Rejects administrator profile update with an invalid name", async () => {
    const res = await request(app)
      .put("/api/admin/account/profile")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        name: "",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Administrator name is required/i,
    );
  });

  it("Rejects administrator profile update with invalid phone data", async () => {
    const res = await request(app)
      .put("/api/admin/account/profile")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        name: "Admin Test",
        phone: 123456,
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Phone and staff ID must be valid text values/i,
    );
  });

  // =========================================================
  // ADMIN PASSWORD
  // =========================================================

  it("Rejects administrator password change with a short password", async () => {
    const res = await request(app)
      .post("/api/admin/account/password")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        current_password: "admin123",
        new_password: "123",
        confirm_password: "123",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /at least 8 characters/i,
    );
  });

  it("Rejects administrator password change when confirmation does not match", async () => {
    const res = await request(app)
      .post("/api/admin/account/password")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        current_password: "admin123",
        new_password: "newAdmin123",
        confirm_password: "different123",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /do not match/i,
    );
  });

  it("Rejects administrator password change with an incorrect current password", async () => {
    const res = await request(app)
      .post("/api/admin/account/password")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        current_password: "wrong-password",
        new_password: "newAdmin123",
        confirm_password: "newAdmin123",
      });

    assert.equal(res.status, 401);

    assert.match(
      res.body.error,
      /Current administrator password is incorrect/i,
    );
  });

  // =========================================================
  // ADMINISTRATOR LIST
  // =========================================================

  it("Admin can retrieve the administrator list", async () => {
    const res = await request(app)
      .get("/api/admin/administrators")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 200);

    assert.ok(
      Array.isArray(
        res.body.administrators,
      ),
    );

    assert.ok(
      res.body.administrators.some(
        (admin) =>
          admin.email ===
          "admin@icbt.edu.lk",
      ),
    );
  });

  // =========================================================
  // CREATE ADMINISTRATOR
  // =========================================================

  it("Rejects administrator creation when current password is incorrect", async () => {
    const res = await request(app)
      .post("/api/admin/administrators")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        name: "Invalid Admin",
        email: uniqueEmail(),
        password: "newAdmin123",
        current_password:
          "wrong-password",
        role: "staff",
      });

    assert.equal(res.status, 401);

    assert.match(
      res.body.error,
      /Current administrator password is incorrect/i,
    );
  });

  it("Rejects administrator creation with a short password", async () => {
    const res = await request(app)
      .post("/api/admin/administrators")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        name: "Short Password Admin",
        email: uniqueEmail(),
        password: "123",
        current_password:
          "admin123",
        role: "staff",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /at least 8 characters/i,
    );
  });

  it("Rejects administrator creation with a duplicate email", async () => {
    const res = await request(app)
      .post("/api/admin/administrators")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        name: "Duplicate Admin",
        email:
          "admin@icbt.edu.lk",
        password: "newAdmin123",
        current_password:
          "admin123",
        role: "staff",
      });

    assert.equal(res.status, 409);

    assert.match(
      res.body.error,
      /already exists/i,
    );
  });

  it("Admin can create a new administrator account", async () => {
    disposableAdminEmail =
      uniqueEmail();

    const res = await request(app)
      .post("/api/admin/administrators")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        name: "Generated Test Administrator",
        email:
          disposableAdminEmail,
        password: "newAdmin123",
        current_password:
          "admin123",
        role: "staff",
        student_staff_id:
          uniqueStudentId(),
        phone: "0712345678",
      });

    assert.equal(
      res.status,
      201,
      `Admin creation failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.equal(
      res.body.message,
      "Administrator account created successfully.",
    );

    assert.ok(
      res.body.administrator,
    );

    assert.equal(
      res.body.administrator.email,
      disposableAdminEmail,
    );

    assert.equal(
      res.body.administrator.system_role,
      "admin",
    );
  });

  // =========================================================
  // CREATE DISPOSABLE NORMAL USER
  // Used for promote/suspend/unsuspend tests.
  // =========================================================

  it("Creates a disposable normal user for administrator management tests", async () => {
    const email = uniqueEmail();

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Disposable Admin Test User",
        email,
        password: "test123",
        role: "student",
        student_staff_id:
          uniqueStudentId(),
        phone: "0700000000",
      });

    assert.equal(
      res.status,
      201,
      `Disposable user creation failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.ok(res.body.user?.id);

    disposableUserId =
      res.body.user.id;
  });

  // =========================================================
  // PROMOTE USER
  // =========================================================

  it("Rejects promotion when user ID is invalid", async () => {
    const res = await request(app)
      .post("/api/admin/users/not-a-number/promote")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        current_password: "admin123",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Invalid user ID/i,
    );
  });

  it("Rejects promotion of a missing user", async () => {
    const res = await request(app)
      .post(
        "/api/admin/users/999999/promote",
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        current_password:
          "admin123",
      });

    assert.equal(res.status, 404);

    assert.match(
      res.body.error,
      /User account not found/i,
    );
  });

  it("Rejects an administrator trying to promote themselves", async () => {
    const account = await request(app)
      .get("/api/admin/account")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(account.status, 200);

    const adminId =
      account.body.admin.id;

    const res = await request(app)
      .post(
        `/api/admin/users/${adminId}/promote`,
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        current_password:
          "admin123",
      });

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /already an administrator/i,
    );
  });

  it("Admin can promote a normal user to administrator", async () => {
    assert.ok(
      disposableUserId,
      "Disposable user was not created.",
    );

    const res = await request(app)
      .post(
        `/api/admin/users/${disposableUserId}/promote`,
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      )
      .send({
        current_password:
          "admin123",
      });

    assert.equal(
      res.status,
      200,
      `Promotion failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.equal(
      res.body.message,
      "User promoted to administrator successfully.",
    );

    assert.ok(
      res.body.administrator,
    );

    assert.equal(
      res.body.administrator.id,
      disposableUserId,
    );

    assert.equal(
      res.body.administrator.system_role,
      "admin",
    );
  });

  // =========================================================
  // SUSPEND / UNSUSPEND
  // =========================================================

  it("Rejects suspend with an invalid user ID", async () => {
    const res = await request(app)
      .patch(
        "/api/admin/users/not-a-number/suspend",
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /Invalid user ID/i,
    );
  });

  it("Rejects suspension of a missing user", async () => {
    const res = await request(app)
      .patch(
        "/api/admin/users/999999/suspend",
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 404);

    assert.match(
      res.body.error,
      /User not found/i,
    );
  });

  it("Admin cannot suspend their own administrator account", async () => {
    const account = await request(app)
      .get("/api/admin/account")
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(account.status, 200);

    const adminId =
      account.body.admin.id;

    const res = await request(app)
      .patch(
        `/api/admin/users/${adminId}/suspend`,
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 400);

    assert.match(
      res.body.error,
      /cannot suspend your own administrator account/i,
    );
  });

  it("Admin can suspend a normal user", async () => {
    const email = uniqueEmail();

    const create = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Suspend Test User",
        email,
        password: "test123",
        role: "student",
        student_staff_id:
          uniqueStudentId(),
      });

    assert.equal(
      create.status,
      201,
      `Suspend test user creation failed: ${JSON.stringify(
        create.body,
      )}`,
    );

    const targetId =
      create.body.user.id;

    const res = await request(app)
      .patch(
        `/api/admin/users/${targetId}/suspend`,
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 200);

    assert.equal(
      res.body.message,
      "User suspended",
    );
  });

  it("Admin can unsuspend a suspended user", async () => {
    const email = uniqueEmail();

    const create = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Unsuspend Test User",
        email,
        password: "test123",
        role: "student",
        student_staff_id:
          uniqueStudentId(),
      });

    assert.equal(
      create.status,
      201,
      `Unsuspend test user creation failed: ${JSON.stringify(
        create.body,
      )}`,
    );

    const targetId =
      create.body.user.id;

    const suspend = await request(app)
      .patch(
        `/api/admin/users/${targetId}/suspend`,
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(
      suspend.status,
      200,
    );

    const unsuspend =
      await request(app)
        .patch(
          `/api/admin/users/${targetId}/unsuspend`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

    assert.equal(
      unsuspend.status,
      200,
    );

    assert.equal(
      unsuspend.body.message,
      "User unsuspended",
    );
  });

  it("Rejects unsuspension of a missing user", async () => {
    const res = await request(app)
      .patch(
        "/api/admin/users/999999/unsuspend",
      )
      .set(
        "Authorization",
        `Bearer ${adminToken}`,
      );

    assert.equal(res.status, 404);

    assert.match(
      res.body.error,
      /User not found/i,
    );
  });
});