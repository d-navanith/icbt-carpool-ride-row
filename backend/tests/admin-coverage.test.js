const {
  describe,
  it,
  before,
  after,
} = require("node:test");

const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");

const { app } = require("../src/server");
const db = require("../src/db");

describe("Admin API Coverage Tests", () => {
  let adminToken;

  let temporaryUserId = null;
  let promotedUserId = null;

  const createdRideIds = [];

  const tomorrow = () => {
    const date = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    return date
      .toISOString()
      .slice(0, 10);
  };

  const uniqueEmail = (prefix) =>
    `${prefix}.${Date.now()}@icbt.edu.lk`;

  async function loginAdmin() {
    const res = await request(app)
      .post("/api/admin/auth/login")
      .send({
        email: "admin@icbt.edu.lk",
        password: "admin123",
      });

    assert.equal(
      res.status,
      200,
      `Admin login failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.ok(res.body.token);

    return res.body.token;
  }

  async function createNormalUser() {
    const email =
      uniqueEmail("admin.coverage");

    const res = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Admin Coverage User",
        email,
        password: "coverage123",
        role: "student",
        student_staff_id:
          `ADMIN-COVERAGE-${Date.now()}`,
        phone: "0710000088",
      });

    assert.equal(
      res.status,
      201,
      `Normal user creation failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.ok(
      res.body.user?.id,
    );

    temporaryUserId =
      res.body.user.id;

    return {
      ...res.body.user,
      email,
      password: "coverage123",
    };
  }

  async function createRide() {
    const driverToken =
      await loginNormalDriver();

    const res = await request(app)
      .post("/api/rides")
      .set(
        "Authorization",
        `Bearer ${driverToken}`,
      )
      .send({
        origin:
          "Admin Coverage Origin",
        destination:
          "ICBT Colombo Campus",
        route_waypoints: [
          "Kelaniya",
          "Wattala",
        ],
        departure_date:
          tomorrow(),
        departure_time:
          "11:00",
        total_seats: 4,
        price_per_seat: 300,
        notes:
          "Admin coverage ride",
      });

    assert.equal(
      res.status,
      201,
      `Ride creation failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.ok(
      res.body.ride?.id,
    );

    createdRideIds.push(
      res.body.ride.id,
    );

    return res.body.ride;
  }

  async function loginNormalDriver() {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email:
          "kamal.driver@icbt.edu.lk",
        password: "driver123",
      });

    assert.equal(
      res.status,
      200,
      `Driver login failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    return res.body.token;
  }

  before(async () => {
    adminToken =
      await loginAdmin();
  });

  after(() => {
    /*
     * Remove coverage rides.
     */
    for (
      const rideId of createdRideIds
    ) {
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

    /*
     * Restore / delete temporary users.
     */
    if (
      temporaryUserId
    ) {
      db.prepare(
        `
        DELETE FROM users
        WHERE id = ?
        `,
      ).run(
        temporaryUserId,
      );
    }

    /*
     * In case promotion created a different
     * tracked user, remove it when safe.
     */
    if (
      promotedUserId &&
      promotedUserId !==
        temporaryUserId
    ) {
      db.prepare(
        `
        DELETE FROM users
        WHERE id = ?
        `,
      ).run(
        promotedUserId,
      );
    }
  });

  // =========================================================
  // PROMOTE USER
  // =========================================================

  it(
    "Rejects promotion with an invalid user ID",
    async () => {
      const res = await request(app)
        .post(
          "/api/admin/users/not-a-number/promote",
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
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid user ID.",
      );
    },
  );

  it(
    "Rejects promotion of user ID zero",
    async () => {
      const res = await request(app)
        .post(
          "/api/admin/users/0/promote",
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
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid user ID.",
      );
    },
  );

  it(
    "Rejects an administrator from promoting themselves",
    async () => {
      const admin = db
        .prepare(
          `
          SELECT id
          FROM users
          WHERE LOWER(email) =
            LOWER(?)
          LIMIT 1
          `,
        )
        .get(
          "admin@icbt.edu.lk",
        );

      assert.ok(admin);

      const res = await request(app)
        .post(
          `/api/admin/users/${admin.id}/promote`,
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
        400,
      );

      assert.equal(
        res.body.error,
        "You are already an administrator.",
      );
    },
  );

  it(
    "Rejects promotion with an incorrect current password",
    async () => {
      const user =
        await createNormalUser();

      const res = await request(app)
        .post(
          `/api/admin/users/${user.id}/promote`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        )
        .send({
          current_password:
            "wrong-password",
        });

      assert.equal(
        res.status,
        401,
      );

      assert.equal(
        res.body.error,
        "Current administrator password is incorrect.",
      );
    },
  );

  it(
    "Rejects promotion of a missing user",
    async () => {
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

      assert.equal(
        res.status,
        404,
      );

      assert.equal(
        res.body.error,
        "User account not found.",
      );
    },
  );

  it(
    "Rejects promotion of a suspended user",
    async () => {
      const user =
        await createNormalUser();

      db.prepare(
        `
        UPDATE users
        SET suspended = 1
        WHERE id = ?
        `,
      ).run(user.id);

      const res = await request(app)
        .post(
          `/api/admin/users/${user.id}/promote`,
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
        409,
      );

      assert.equal(
        res.body.error,
        "Suspended accounts cannot be promoted to administrator.",
      );

      db.prepare(
        `
        UPDATE users
        SET suspended = 0
        WHERE id = ?
        `,
      ).run(user.id);
    },
  );

  it(
    "Rejects promotion of an existing administrator",
    async () => {
      const existingAdmin =
        db.prepare(
          `
          SELECT id
          FROM users
          WHERE system_role = 'admin'
            AND id != (
              SELECT id
              FROM users
              WHERE LOWER(email) =
                LOWER(?)
              LIMIT 1
            )
          LIMIT 1
          `,
        ).get(
          "admin@icbt.edu.lk",
        );

      if (!existingAdmin) {
        return;
      }

      const res = await request(app)
        .post(
          `/api/admin/users/${existingAdmin.id}/promote`,
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
        409,
      );

      assert.equal(
        res.body.error,
        "This user is already an administrator.",
      );
    },
  );

  it(
    "Promotes a normal user to administrator",
    async () => {
      const user =
        await createNormalUser();

      const res = await request(app)
        .post(
          `/api/admin/users/${user.id}/promote`,
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
        user.id,
      );

      promotedUserId =
        user.id;
    },
  );

  // =========================================================
  // DRIVER VERIFICATION ACTIONS
  // =========================================================

  it(
    "Accepts a valid driver verification rejection",
    async () => {
      const verification =
        db.prepare(
          `
          SELECT id
          FROM driver_verifications
          WHERE status = 'pending'
          ORDER BY id DESC
          LIMIT 1
          `,
        ).get();

      if (!verification) {
        return;
      }

      const res = await request(app)
        .post(
          `/api/admin/verifications/driver/${verification.id}/action`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        )
        .send({
          action:
            "rejected",
          comment:
            "Coverage rejection test",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.verification.status,
        "rejected",
      );

      assert.equal(
        res.body.verification.admin_comment,
        "Coverage rejection test",
      );
    },
  );

  it(
    "Uses the default rejection comment when no comment is provided",
    async () => {
      const verification =
        db.prepare(
          `
          SELECT id
          FROM driver_verifications
          WHERE status = 'pending'
          ORDER BY id DESC
          LIMIT 1
          `,
        ).get();

      if (!verification) {
        return;
      }

      const res = await request(app)
        .post(
          `/api/admin/verifications/driver/${verification.id}/action`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        )
        .send({
          action:
            "rejected",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.verification.status,
        "rejected",
      );

      assert.equal(
        res.body.verification.admin_comment,
        "Rejected due to insufficient documentation",
      );
    },
  );

  it(
    "Accepts a valid driver verification approval",
    async () => {
      const verification =
        db.prepare(
          `
          SELECT id
          FROM driver_verifications
          WHERE status = 'rejected'
          ORDER BY id DESC
          LIMIT 1
          `,
        ).get();

      if (!verification) {
        return;
      }

      const res = await request(app)
        .post(
          `/api/admin/verifications/driver/${verification.id}/action`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        )
        .send({
          action:
            "approved",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.verification.status,
        "approved",
      );

      assert.equal(
        res.body.verification.admin_comment,
        "Approved by Admin",
      );
    },
  );

  // =========================================================
  // PASSENGER VERIFICATION ACTIONS
  // =========================================================

  it(
    "Rejects an invalid passenger verification action",
    async () => {
      const verification =
        db.prepare(
          `
          SELECT id
          FROM passenger_verifications
          ORDER BY id DESC
          LIMIT 1
          `,
        ).get();

      if (!verification) {
        return;
      }

      const res = await request(app)
        .post(
          `/api/admin/verifications/passenger/${verification.id}/action`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        )
        .send({
          action:
            "invalid-action",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Action must be approved or rejected.",
      );
    },
  );

  it(
    "Approves a passenger verification",
    async () => {
      const verification =
        db.prepare(
          `
          SELECT id
          FROM passenger_verifications
          ORDER BY id DESC
          LIMIT 1
          `,
        ).get();

      if (!verification) {
        return;
      }

      const res = await request(app)
        .post(
          `/api/admin/verifications/passenger/${verification.id}/action`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        )
        .send({
          action:
            "approved",
          comment:
            "Approved by coverage test",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.message,
        "Passenger verification updated to approved.",
      );
    },
  );

  it(
    "Rejects a passenger verification",
    async () => {
      const verification =
        db.prepare(
          `
          SELECT id
          FROM passenger_verifications
          ORDER BY id DESC
          LIMIT 1
          `,
        ).get();

      if (!verification) {
        return;
      }

      const res = await request(app)
        .post(
          `/api/admin/verifications/passenger/${verification.id}/action`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        )
        .send({
          action:
            "rejected",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.message,
        "Passenger verification updated to rejected.",
      );
    },
  );

  // =========================================================
  // ADMIN USER LIST
  // =========================================================

  it(
    "Returns all users through administrator management",
    async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        Array.isArray(
          res.body.users,
        ),
      );
    },
  );

  // =========================================================
  // ADMIN RIDE LIST
  // =========================================================

  it(
    "Returns all rides with parsed route waypoints",
    async () => {
      const res = await request(app)
        .get("/api/admin/rides")
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        Array.isArray(
          res.body.rides,
        ),
      );

      if (
        res.body.rides.length > 0
      ) {
        assert.ok(
          Array.isArray(
            res.body.rides[0]
              .route_waypoints,
          ),
        );
      }
    },
  );

  // =========================================================
  // CSV EXPORTS
  // =========================================================

  it(
    "Exports all rides as CSV",
    async () => {
      const res = await request(app)
        .get(
          "/api/admin/export/rides-csv",
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.match(
        res.headers["content-type"] ||
          "",
        /text\/csv/i,
      );

      assert.match(
        res.headers["content-disposition"] ||
          "",
        /icbt_campus_rides\.csv/i,
      );

      assert.ok(
        typeof res.text ===
          "string",
      );

      assert.match(
        res.text,
        /Ride ID,Origin,Destination/i,
      );
    },
  );

  it(
    "Exports all users as CSV",
    async () => {
      const res = await request(app)
        .get(
          "/api/admin/export/users-csv",
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.match(
        res.headers["content-type"] ||
          "",
        /text\/csv/i,
      );

      assert.match(
        res.headers["content-disposition"] ||
          "",
        /icbt_campus_users\.csv/i,
      );

      assert.ok(
        typeof res.text ===
          "string",
      );

      assert.match(
        res.text,
        /User ID,Name,Email/i,
      );
    },
  );

  // =========================================================
  // ADMIN FORCE-CANCEL RIDE
  // =========================================================

  it(
    "Returns 404 when admin force-cancels a missing ride",
    async () => {
      const res = await request(app)
        .patch(
          "/api/admin/rides/999999/cancel",
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        404,
      );

      assert.equal(
        res.body.error,
        "Ride not found",
      );
    },
  );

  it(
    "Force-cancels a ride as administrator",
    async () => {
      const ride =
        await createRide();

      const res = await request(app)
        .patch(
          `/api/admin/rides/${ride.id}/cancel`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.message,
        "Ride force-cancelled",
      );

      assert.equal(
        res.body.rideId,
        ride.id,
      );

      const updatedRide =
        db.prepare(
          `
          SELECT status
          FROM rides
          WHERE id = ?
          `,
        ).get(ride.id);

      assert.equal(
        updatedRide.status,
        "cancelled",
      );
    },
  );

  // =========================================================
  // SUSPEND USER
  // =========================================================

  it(
    "Rejects suspension with an invalid user ID",
    async () => {
      const res = await request(app)
        .patch(
          "/api/admin/users/not-a-number/suspend",
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid user ID.",
      );
    },
  );

  it(
    "Rejects suspension of user ID zero",
    async () => {
      const res = await request(app)
        .patch(
          "/api/admin/users/0/suspend",
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid user ID.",
      );
    },
  );

  it(
    "Rejects suspension of a missing user",
    async () => {
      const res = await request(app)
        .patch(
          "/api/admin/users/999999/suspend",
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        404,
      );

      assert.equal(
        res.body.error,
        "User not found",
      );
    },
  );

  it(
    "Rejects an administrator from suspending themselves",
    async () => {
      const admin =
        db.prepare(
          `
          SELECT id
          FROM users
          WHERE LOWER(email) =
            LOWER(?)
          LIMIT 1
          `,
        ).get(
          "admin@icbt.edu.lk",
        );

      assert.ok(admin);

      const res = await request(app)
        .patch(
          `/api/admin/users/${admin.id}/suspend`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "You cannot suspend your own administrator account.",
      );
    },
  );

  it(
    "Rejects suspension of another administrator",
    async () => {
      const anotherAdmin =
        db.prepare(
          `
          SELECT id
          FROM users
          WHERE system_role = 'admin'
          LIMIT 1
          OFFSET 1
          `,
        ).get();

      if (!anotherAdmin) {
        return;
      }

      const res = await request(app)
        .patch(
          `/api/admin/users/${anotherAdmin.id}/suspend`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        403,
      );

      assert.equal(
        res.body.error,
        "Administrator accounts cannot be suspended from the general user management panel.",
      );
    },
  );

  it(
    "Suspends a normal user",
    async () => {
      const user =
        await createNormalUser();

      const res = await request(app)
        .patch(
          `/api/admin/users/${user.id}/suspend`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.message,
        "User suspended",
      );

      const updated =
        db.prepare(
          `
          SELECT suspended
          FROM users
          WHERE id = ?
          `,
        ).get(user.id);

      assert.equal(
        updated.suspended,
        1,
      );

      db.prepare(
        `
        UPDATE users
        SET suspended = 0
        WHERE id = ?
        `,
      ).run(user.id);
    },
  );

  // =========================================================
  // UNSUSPEND USER
  // =========================================================

  it(
    "Rejects unsuspension with an invalid user ID",
    async () => {
      const res = await request(app)
        .patch(
          "/api/admin/users/not-a-number/unsuspend",
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid user ID.",
      );
    },
  );

  it(
    "Rejects unsuspension of a missing user",
    async () => {
      const res = await request(app)
        .patch(
          "/api/admin/users/999999/unsuspend",
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        404,
      );

      assert.equal(
        res.body.error,
        "User not found",
      );
    },
  );

  it(
    "Unsuspends a suspended normal user",
    async () => {
      const user =
        await createNormalUser();

      db.prepare(
        `
        UPDATE users
        SET suspended = 1
        WHERE id = ?
        `,
      ).run(user.id);

      const res = await request(app)
        .patch(
          `/api/admin/users/${user.id}/unsuspend`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.message,
        "User unsuspended",
      );

      const updated =
        db.prepare(
          `
          SELECT suspended
          FROM users
          WHERE id = ?
          `,
        ).get(user.id);

      assert.equal(
        updated.suspended,
        0,
      );
    },
  );

  // =========================================================
  // AUTHORIZATION
  // =========================================================

  it(
    "Rejects unauthenticated access to admin user management",
    async () => {
      const res = await request(app)
        .get("/api/admin/users");

      assert.equal(
        res.status,
        401,
      );
    },
  );

  it(
    "Rejects unauthenticated access to admin ride export",
    async () => {
      const res = await request(app)
        .get(
          "/api/admin/export/rides-csv",
        );

      assert.equal(
        res.status,
        401,
      );
    },
  );
});