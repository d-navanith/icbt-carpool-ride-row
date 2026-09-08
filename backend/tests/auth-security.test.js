const {
  describe,
  it,
  before,
  after,
} = require("node:test");

const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");

const { app } = require("../src/server");
const db = require("../src/db");
const { JWT_SECRET } = require("../src/auth");

describe("Authentication & Session Security Tests", () => {
  let userToken;
  let userId;
  let createdUserId = null;

  const uniqueEmail = () =>
    `auth.security.${Date.now()}@icbt.edu.lk`;

  before(async () => {
    const email = uniqueEmail();

    const register = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Auth Security User",
        email,
        password: "security123",
        role: "student",
        student_staff_id:
          `AUTH-SECURITY-${Date.now()}`,
        phone: "0710000077",
      });

    assert.equal(
      register.status,
      201,
      `Registration failed: ${JSON.stringify(
        register.body,
      )}`,
    );

    assert.ok(register.body.token);
    assert.ok(register.body.user?.id);

    userToken = register.body.token;
    userId = register.body.user.id;
    createdUserId = userId;
  });

  after(() => {
    if (createdUserId) {
      db.prepare(
        `
        DELETE FROM bookings
        WHERE passenger_id = ?
        `,
      ).run(createdUserId);

      db.prepare(
        `
        DELETE FROM reviews
        WHERE reviewer_id = ?
           OR reviewee_id = ?
        `,
      ).run(
        createdUserId,
        createdUserId,
      );

      db.prepare(
        `
        DELETE FROM messages
        WHERE sender_id = ?
        `,
      ).run(createdUserId);

      db.prepare(
        `
        DELETE FROM driver_verifications
        WHERE user_id = ?
        `,
      ).run(createdUserId);

      db.prepare(
        `
        DELETE FROM passenger_verifications
        WHERE user_id = ?
        `,
      ).run(createdUserId);

      db.prepare(
        `
        DELETE FROM users
        WHERE id = ?
        `,
      ).run(createdUserId);
    }
  });

  // =========================================================
  // AUTHORIZATION HEADER
  // =========================================================

  it(
    "Rejects a request without an Authorization header",
    async () => {
      const res = await request(app)
        .get("/api/auth/me");

      assert.equal(
        res.status,
        401,
      );

      assert.equal(
        res.body.error,
        "Access token required. Please login.",
      );
    },
  );

  it(
    "Rejects an Authorization header without a token",
    async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          "Bearer",
        );

      assert.equal(
        res.status,
        401,
      );

      assert.equal(
        res.body.error,
        "Access token required. Please login.",
      );
    },
  );

  it(
    "Rejects a non-Bearer Authorization scheme",
    async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Basic ${userToken}`,
        );

      assert.equal(
        res.status,
        401,
      );

      assert.equal(
        res.body.error,
        "Access token required. Please login.",
      );
    },
  );

  // =========================================================
  // JWT VALIDATION
  // =========================================================

  it(
    "Rejects a malformed JWT",
    async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          "Bearer not-a-valid-jwt",
        );

      assert.equal(
        res.status,
        403,
      );

      assert.equal(
        res.body.error,
        "Invalid or expired session token.",
      );
    },
  );

  it(
    "Rejects an expired JWT",
    async () => {
      const expiredToken =
        jwt.sign(
          {
            id: userId,
            email:
              "expired@icbt.edu.lk",
            name: "Expired Token",
            role: "student",
            system_role: "user",
          },
          JWT_SECRET,
          {
            expiresIn: -1,
          },
        );

      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Bearer ${expiredToken}`,
        );

      assert.equal(
        res.status,
        403,
      );

      assert.equal(
        res.body.error,
        "Invalid or expired session token.",
      );
    },
  );

  it(
    "Rejects a JWT signed with the wrong secret",
    async () => {
      const badToken =
        jwt.sign(
          {
            id: userId,
            email:
              "fake@icbt.edu.lk",
            name: "Fake User",
            role: "student",
            system_role: "user",
          },
          "definitely-not-the-real-secret",
          {
            expiresIn: "7d",
          },
        );

      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Bearer ${badToken}`,
        );

      assert.equal(
        res.status,
        403,
      );

      assert.equal(
        res.body.error,
        "Invalid or expired session token.",
      );
    },
  );

  // =========================================================
  // VALID SESSION
  // =========================================================

  it(
    "Allows a valid active-user JWT",
    async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Bearer ${userToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.user.id,
        userId,
      );
    },
  );

  // =========================================================
  // SUSPENSION
  // =========================================================

  it(
    "Rejects a valid old JWT after the user is suspended",
    async () => {
      db.prepare(
        `
        UPDATE users
        SET suspended = 1
        WHERE id = ?
        `,
      ).run(userId);

      try {
        const res = await request(app)
          .get("/api/auth/me")
          .set(
            "Authorization",
            `Bearer ${userToken}`,
          );

        /*
         * This expected result applies after
         * authenticateToken is hardened to
         * check the current DB account state.
         */
        assert.equal(
          res.status,
          403,
        );

        assert.equal(
          res.body.error,
          "Your account has been suspended.",
        );
      } finally {
        db.prepare(
          `
          UPDATE users
          SET suspended = 0
          WHERE id = ?
          `,
        ).run(userId);
      }
    },
  );

  it(
    "Allows the active user again after suspension is removed",
    async () => {
      db.prepare(
        `
        UPDATE users
        SET suspended = 0
        WHERE id = ?
        `,
      ).run(userId);

      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Bearer ${userToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.user.id,
        userId,
      );
    },
  );

  // =========================================================
  // DELETED USER
  // =========================================================

  it(
    "Rejects a valid JWT when the user no longer exists",
    async () => {
      const email =
        uniqueEmail();

      const register =
        await request(app)
          .post("/api/auth/register")
          .send({
            name:
              "Temporary Deleted User",
            email,
            password:
              "deleted123",
            role: "student",
            student_staff_id:
              `DELETED-${Date.now()}`,
          });

      assert.equal(
        register.status,
        201,
      );

      const temporaryUserId =
        register.body.user.id;

      const temporaryToken =
        register.body.token;

      db.prepare(
        `
        DELETE FROM users
        WHERE id = ?
        `,
      ).run(
        temporaryUserId,
      );

      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Bearer ${temporaryToken}`,
        );

      /*
       * Expected result after central DB-backed
       * authentication validation is implemented.
       */
      assert.equal(
        res.status,
        401,
      );

      assert.equal(
        res.body.error,
        "User account no longer exists.",
      );
    },
  );

  // =========================================================
  // JWT PAYLOAD SAFETY
  // =========================================================

  it(
    "Generates a JWT without password or password_hash fields",
    () => {
      const decoded =
        jwt.verify(
          userToken,
          JWT_SECRET,
        );

      assert.equal(
        decoded.id,
        userId,
      );

      assert.equal(
        decoded.email.includes("@"),
        true,
      );

      assert.equal(
        decoded.role,
        "student",
      );

      assert.equal(
        decoded.system_role,
        "user",
      );

      assert.equal(
        Object.prototype.hasOwnProperty.call(
          decoded,
          "password",
        ),
        false,
      );

      assert.equal(
        Object.prototype.hasOwnProperty.call(
          decoded,
          "password_hash",
        ),
        false,
      );
    },
  );

  // =========================================================
  // RESPONSE SAFETY
  // =========================================================

  it(
    "Does not expose password_hash through /me",
    async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set(
          "Authorization",
          `Bearer ${userToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        Object.prototype.hasOwnProperty.call(
          res.body.user,
          "password_hash",
        ),
        false,
      );
    },
  );

  it(
    "Does not expose password_hash during login",
    async () => {
      const email =
        db.prepare(
          `
          SELECT email
          FROM users
          WHERE id = ?
          `,
        ).get(userId);

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: email.email,
          password:
            "security123",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        Object.prototype.hasOwnProperty.call(
          res.body.user,
          "password_hash",
        ),
        false,
      );

      assert.ok(
        res.body.token,
      );
    },
  );
});