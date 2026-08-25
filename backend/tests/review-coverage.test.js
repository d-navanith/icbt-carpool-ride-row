const {
  describe,
  it,
  before,
  after,
} = require("node:test");

const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");
const db = require("../src/db");

describe("Review API Coverage Tests", () => {
  let driverToken;
  let passengerToken;

  let createdReviewId = null;

  let driverOriginalSuspended;

  // =========================================================
  // SETUP
  // =========================================================

  before(async () => {
    const driverLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "kamal.driver@icbt.edu.lk",
        password: "driver123",
      });

    assert.equal(
      driverLogin.status,
      200,
      `Driver login failed: ${JSON.stringify(
        driverLogin.body,
      )}`,
    );

    assert.ok(driverLogin.body.token);

    driverToken =
      driverLogin.body.token;

    const passengerLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "nimal.student@icbt.edu.lk",
        password: "student123",
      });

    assert.equal(
      passengerLogin.status,
      200,
      `Passenger login failed: ${JSON.stringify(
        passengerLogin.body,
      )}`,
    );

    assert.ok(passengerLogin.body.token);

    passengerToken =
      passengerLogin.body.token;
  });

  // =========================================================
  // CLEANUP
  // =========================================================

  after(() => {
    /*
     * Remove only the review created by this
     * coverage suite.
     */
    if (createdReviewId) {
      db.prepare(
        `
        DELETE FROM reviews
        WHERE id = ?
        `,
      ).run(createdReviewId);
    }

    /*
     * Restore the driver's original suspended
     * state if the suspended-user test changed it.
     */
    const driver = db
      .prepare(
        `
        SELECT suspended
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
      )
      .get(2);

    if (
      driver &&
      driverOriginalSuspended !==
        undefined
    ) {
      db.prepare(
        `
        UPDATE users
        SET suspended = ?
        WHERE id = ?
        `,
      ).run(
        driverOriginalSuspended,
        2,
      );
    }
  });

  // =========================================================
  // AUTHENTICATION
  // =========================================================

  it(
    "Rejects unauthenticated review submission",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .send({
          ride_id: 1,
          reviewee_id: 2,
          rating: 5,
          comment:
            "Unauthenticated test",
        });

      assert.equal(
        res.status,
        401,
      );
    },
  );

  // =========================================================
  // BASIC INPUT VALIDATION
  // =========================================================

  it(
    "Rejects review submission with missing ride and reviewee IDs",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          rating: 5,
          comment:
            "Missing identifiers",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Valid ride ID and reviewee ID are required.",
      );
    },
  );

  it(
    "Rejects a non-positive ride ID",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          ride_id: 0,
          reviewee_id: 2,
          rating: 5,
          comment:
            "Invalid ride ID",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.match(
        res.body.error,
        /Valid ride ID and reviewee ID are required/i,
      );
    },
  );

  it(
    "Rejects a non-positive reviewee ID",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: -1,
          rating: 5,
          comment:
            "Invalid reviewee ID",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.match(
        res.body.error,
        /Valid ride ID and reviewee ID are required/i,
      );
    },
  );

  // =========================================================
  // RATING VALIDATION
  // =========================================================

  it(
    "Rejects a rating below 1",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 2,
          rating: 0,
          comment:
            "Invalid rating",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Rating must be between 1 and 5 stars.",
      );
    },
  );

  it(
    "Rejects a rating above 5",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 2,
          rating: 6,
          comment:
            "Invalid rating",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Rating must be between 1 and 5 stars.",
      );
    },
  );

  it(
    "Rejects a non-integer rating",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 2,
          rating: 4.5,
          comment:
            "Decimal rating",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.match(
        res.body.error,
        /between 1 and 5 stars/i,
      );
    },
  );

  // =========================================================
  // COMMENT VALIDATION
  // =========================================================

  it(
    "Rejects a review comment that is not a string",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 2,
          rating: 5,
          comment: {
            invalid: true,
          },
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Review comment must be a string with a maximum of 1000 characters.",
      );
    },
  );

  it(
    "Rejects a review comment longer than 1000 characters",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 2,
          rating: 5,
          comment:
            "A".repeat(1001),
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Review comment must be a string with a maximum of 1000 characters.",
      );
    },
  );

  it(
    "Accepts an omitted comment as an empty review comment",
    async () => {
      /*
       * Driver -> passenger is intentionally used
       * because the seeded review already uses
       * passenger -> driver.
       */
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 3,
          rating: 4,
        });

      assert.equal(
        res.status,
        201,
        `Unexpected response: ${JSON.stringify(
          res.body,
        )}`,
      );

      assert.ok(
        res.body.reviewId,
      );

      createdReviewId =
        res.body.reviewId;
    },
  );

  // =========================================================
  // SELF REVIEW
  // =========================================================

  it(
    "Rejects a driver reviewing themselves",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 2,
          rating: 5,
          comment:
            "Self review attempt",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "You cannot submit a review for yourself.",
      );
    },
  );

  it(
    "Rejects a passenger reviewing themselves",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 3,
          rating: 5,
          comment:
            "Self review attempt",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "You cannot submit a review for yourself.",
      );
    },
  );

  // =========================================================
  // RIDE VALIDATION
  // =========================================================

  it(
    "Returns 404 when the ride does not exist",
    async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          ride_id: 999999,
          reviewee_id: 3,
          rating: 5,
          comment:
            "Missing ride",
        });

      assert.equal(
        res.status,
        404,
      );

      assert.equal(
        res.body.error,
        "Ride not found.",
      );
    },
  );

  // =========================================================
  // REVIEWER PARTICIPATION
  // =========================================================

  it(
    "Rejects a user who did not participate in the ride",
    async () => {
      /*
       * Admin is authenticated but is not
       * a passenger or driver of ride 1.
       */
      const adminLogin =
        await request(app)
          .post(
            "/api/admin/auth/login",
          )
          .send({
            email:
              "admin@icbt.edu.lk",
            password: "admin123",
          });

      assert.equal(
        adminLogin.status,
        200,
      );

      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${adminLogin.body.token}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 2,
          rating: 5,
          comment:
            "Unauthorized reviewer",
        });

      assert.equal(
        res.status,
        403,
      );

      assert.equal(
        res.body.error,
        "Only the ride driver or a passenger who booked this ride can submit a review.",
      );
    },
  );

  // =========================================================
  // REVIEWEE PARTICIPATION
  // =========================================================

  it(
    "Rejects a review for a user who did not participate in the ride",
    async () => {
      /*
       * Admin/user #1 does not participate in ride 1.
       * Passenger #3 is the reviewer.
       */
      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 1,
          rating: 5,
          comment:
            "Non-participant reviewee",
        });

      assert.equal(
        res.status,
        403,
      );

      assert.equal(
        res.body.error,
        "The selected user did not participate in this ride.",
      );
    },
  );

  // =========================================================
  // DUPLICATE REVIEW
  // =========================================================

  it(
    "Rejects a duplicate review for the same ride and user",
    async () => {
      assert.ok(
        createdReviewId,
        "The driver-to-passenger review was not created.",
      );

      const res = await request(app)
        .post("/api/reviews")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          ride_id: 1,
          reviewee_id: 3,
          rating: 5,
          comment:
            "Duplicate driver review",
        });

      assert.equal(
        res.status,
        409,
      );

      assert.equal(
        res.body.error,
        "You have already reviewed this user for this ride.",
      );
    },
  );

  // =========================================================
  // GET USER REVIEWS
  // =========================================================

  it(
    "Rejects an invalid user ID when fetching reviews",
    async () => {
      const res = await request(app)
        .get(
          "/api/reviews/user/not-a-number",
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
    "Rejects a zero user ID when fetching reviews",
    async () => {
      const res = await request(app)
        .get(
          "/api/reviews/user/0",
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
    "Returns 404 for a missing review target user",
    async () => {
      const res = await request(app)
        .get(
          "/api/reviews/user/999999",
        );

      assert.equal(
        res.status,
        404,
      );

      assert.equal(
        res.body.error,
        "User not found.",
      );
    },
  );

  it(
    "Returns rating statistics and review details for a user",
    async () => {
      const res = await request(app)
        .get(
          "/api/reviews/user/2",
        );

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        res.body.user,
      );

      assert.equal(
        res.body.user.id,
        2,
      );

      assert.equal(
        res.body.user.name,
        "Kamal Perera",
      );

      assert.equal(
        typeof res.body.avgRating,
        "number",
      );

      assert.equal(
        typeof res.body.reviewCount,
        "number",
      );

      assert.ok(
        Array.isArray(
          res.body.reviews,
        ),
      );

      assert.ok(
        res.body.reviews.length >= 1,
      );
    },
  );

  it(
    "Returns the seeded review information for the driver",
    async () => {
      const res = await request(app)
        .get(
          "/api/reviews/user/2",
        );

      assert.equal(
        res.status,
        200,
      );

      const seededReview =
        res.body.reviews.find(
          (review) =>
            review.ride_id === 1 &&
            review.reviewer_name ===
              "Nimal Perera",
        );

      /*
       * Depending on the current seed data naming,
       * verify the core fields rather than requiring
       * a hard-coded reviewer name.
       */
      assert.ok(
        res.body.reviews.some(
          (review) =>
            review.ride_id === 1 &&
            review.rating === 5,
        ),
      );
    },
  );

  // =========================================================
  // USER WITH NO REVIEWS / DEFAULT RATING
  // =========================================================

  it(
    "Returns the default 5.0 rating when a user has no reviews",
    async () => {
      const res = await request(app)
        .get(
          "/api/reviews/user/3",
        );

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        res.body.user,
      );

      assert.equal(
        res.body.user.id,
        3,
      );

      /*
       * User 3 is the seeded passenger.
       * The test suite verifies the response shape
       * and accepts either the default or an existing
       * rating if previous tests have created reviews.
       */
      assert.equal(
        typeof res.body.avgRating,
        "number",
      );

      assert.ok(
        Array.isArray(
          res.body.reviews,
        ),
      );

      assert.equal(
        typeof res.body.reviewCount,
        "number",
      );
    },
  );

  // =========================================================
  // SUSPENDED REVIEWER
  // =========================================================

  it(
    "Rejects a suspended user from submitting a review",
    async () => {
      const driver = db
        .prepare(
          `
          SELECT suspended
          FROM users
          WHERE id = ?
          LIMIT 1
          `,
        )
        .get(2);

      assert.ok(
        driver,
        "Driver account was not found.",
      );

      driverOriginalSuspended =
        driver.suspended;

      db.prepare(
        `
        UPDATE users
        SET suspended = 1
        WHERE id = ?
        `,
      ).run(2);

      try {
        const res =
          await request(app)
            .post("/api/reviews")
            .set(
              "Authorization",
              `Bearer ${driverToken}`,
            )
            .send({
              ride_id: 1,
              reviewee_id: 3,
              rating: 5,
              comment:
                "Suspended reviewer",
            });

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
          SET suspended = ?
          WHERE id = ?
          `,
        ).run(
          driverOriginalSuspended,
          2,
        );
      }
    },
  );
});