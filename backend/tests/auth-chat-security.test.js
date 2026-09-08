const {
  describe,
  it,
  before,
  after,
} = require("node:test");

const assert = require("node:assert/strict");

const db = require("../src/db");
const {
  canAccessRideChat,
} = require("../src/auth");

describe(
  "Ride Chat Authorization Security Tests",
  () => {
    let adminId;
    let driverId;
    let rideId;

    before(() => {
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

      adminId = admin.id;

      const driver = db
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
          "kamal.driver@icbt.edu.lk",
        );

      assert.ok(driver);

      driverId = driver.id;

      const ride = db
        .prepare(
          `
          SELECT id
          FROM rides
          WHERE driver_id = ?
          ORDER BY id
          LIMIT 1
          `,
        )
        .get(driverId);

      assert.ok(ride);

      rideId = ride.id;
    });

    after(() => {
      /*
       * Always restore the admin account.
       */
      db.prepare(
        `
        UPDATE users
        SET suspended = 0
        WHERE id = ?
        `,
      ).run(adminId);
    });

    it(
      "Allows an active administrator to access ride chat",
      () => {
        db.prepare(
          `
          UPDATE users
          SET suspended = 0
          WHERE id = ?
          `,
        ).run(adminId);

        assert.equal(
          canAccessRideChat(
            adminId,
            rideId,
          ),
          true,
        );
      },
    );

    it(
      "Blocks a suspended administrator from ride chat",
      () => {
        db.prepare(
          `
          UPDATE users
          SET suspended = 1
          WHERE id = ?
          `,
        ).run(adminId);

        assert.equal(
          canAccessRideChat(
            adminId,
            rideId,
          ),
          false,
        );
      },
    );

    it(
      "Blocks an unknown user from ride chat",
      () => {
        assert.equal(
          canAccessRideChat(
            999999,
            rideId,
          ),
          false,
        );
      },
    );

    it(
      "Blocks access when the ride does not exist",
      () => {
        assert.equal(
          canAccessRideChat(
            driverId,
            999999,
          ),
          false,
        );
      },
    );

    it(
      "Allows the ride driver to access their own ride chat",
      () => {
        db.prepare(
          `
          UPDATE users
          SET suspended = 0
          WHERE id = ?
          `,
        ).run(driverId);

        assert.equal(
          canAccessRideChat(
            driverId,
            rideId,
          ),
          true,
        );
      },
    );

    it(
      "Rejects missing user or ride IDs",
      () => {
        assert.equal(
          canAccessRideChat(
            null,
            rideId,
          ),
          false,
        );

        assert.equal(
          canAccessRideChat(
            adminId,
            null,
          ),
          false,
        );

        assert.equal(
          canAccessRideChat(
            0,
            rideId,
          ),
          false,
        );

        assert.equal(
          canAccessRideChat(
            adminId,
            0,
          ),
          false,
        );
      },
    );
  },
);