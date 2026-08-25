const {
  describe,
  it,
  after,
} = require("node:test");

const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");
const db = require("../src/db");

describe("Administrator Authentication API Tests", () => {
  let adminUserId;
  let adminOriginalSuspended;

  after(() => {
    if (
      adminUserId !== undefined &&
      adminOriginalSuspended !== undefined
    ) {
      db.prepare(
        `
        UPDATE users
        SET suspended = ?
        WHERE id = ?
        `,
      ).run(
        adminOriginalSuspended,
        adminUserId,
      );
    }
  });

  // =========================================================
  // 1. INVALID / MISSING INPUT
  // =========================================================

  it("Rejects administrator login when credentials are missing", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({});

    assert.equal(res.status, 400);

    assert.equal(
      res.body.error,
      "Administrator email and password are required.",
    );
  });

  // =========================================================
  // 2. UNKNOWN ACCOUNT
  // =========================================================

  it("Rejects login for an unknown administrator account", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({
        email:
          "does-not-exist-admin@icbt.edu.lk",
        password: "admin123",
      });

    assert.equal(res.status, 401);

    assert.equal(
      res.body.error,
      "Invalid administrator credentials.",
    );
  });

  // =========================================================
  // 3. WRONG PASSWORD
  // =========================================================

  it("Rejects administrator login with an incorrect password", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({
        email: "admin@icbt.edu.lk",
        password: "wrong-password",
      });

    assert.equal(res.status, 401);

    assert.equal(
      res.body.error,
      "Invalid administrator credentials.",
    );
  });

  // =========================================================
  // 4. NORMAL USER USING ADMIN PORTAL
  // =========================================================

  it("Blocks a normal user from administrator login", async () => {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({
        email:
          "kamal.driver@icbt.edu.lk",
        password: "driver123",
      });

    assert.equal(res.status, 403);

    assert.equal(
      res.body.error,
      "Administrator access required.",
    );
  });

  // =========================================================
  // 5. SUSPENDED ADMINISTRATOR
  // =========================================================

  it("Blocks a suspended administrator account", async () => {
    const admin = db
      .prepare(
        `
        SELECT
          id,
          suspended
        FROM users
        WHERE LOWER(email) = LOWER(?)
        LIMIT 1
        `,
      )
      .get(
        "admin@icbt.edu.lk",
      );

    assert.ok(
      admin,
      "Seeded administrator account was not found.",
    );

    adminUserId = admin.id;
    adminOriginalSuspended =
      admin.suspended;

    db.prepare(
      `
      UPDATE users
      SET suspended = 1
      WHERE id = ?
      `,
    ).run(admin.id);

    try {
      const res = await request(app)
        .post("/api/admin/auth/login")
        .send({
          email:
            "admin@icbt.edu.lk",
          password: "admin123",
        });

      assert.equal(
        res.status,
        403,
      );

      assert.equal(
        res.body.error,
        "This administrator account is suspended.",
      );
    } finally {
      db.prepare(
        `
        UPDATE users
        SET suspended = ?
        WHERE id = ?
        `,
      ).run(
        adminOriginalSuspended,
        admin.id,
      );
    }
  });
});