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

describe("Ride API Coverage Tests", () => {
  let driverToken;
  let passengerToken;
  let adminToken;

  const createdRideIds = [];
  const createdReviewIds = [];

  const tomorrow = () => {
    const date = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    return date
      .toISOString()
      .slice(0, 10);
  };

  const uniqueRide = (suffix = "") => ({
    origin: `Coverage Origin ${suffix}`,
    destination: `Coverage Destination ${suffix}`,
    route_waypoints: [
      "Kelaniya",
      "Wattala",
      "Peliyagoda",
    ],
    departure_date: tomorrow(),
    departure_time: "09:30",
    total_seats: 4,
    price_per_seat: 300,
    notes: `Coverage test ride ${suffix}`,
  });

  async function createRide(
    token,
    data = {},
  ) {
    const res = await request(app)
      .post("/api/rides")
      .set(
        "Authorization",
        `Bearer ${token}`,
      )
      .send({
        ...uniqueRide(
          Date.now().toString(),
        ),
        ...data,
      });

    assert.equal(
      res.status,
      201,
      `Ride creation failed: ${JSON.stringify(
        res.body,
      )}`,
    );

    assert.ok(res.body.ride?.id);

    createdRideIds.push(
      res.body.ride.id,
    );

    return res.body.ride;
  }

  // =========================================================
  // SETUP
  // =========================================================

  before(async () => {
    const driverLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email:
          "kamal.driver@icbt.edu.lk",
        password: "driver123",
      });

    assert.equal(
      driverLogin.status,
      200,
      `Driver login failed: ${JSON.stringify(
        driverLogin.body,
      )}`,
    );

    driverToken =
      driverLogin.body.token;

    const passengerLogin =
      await request(app)
        .post("/api/auth/login")
        .send({
          email:
            "nimal.student@icbt.edu.lk",
          password:
            "student123",
        });

    assert.equal(
      passengerLogin.status,
      200,
      `Passenger login failed: ${JSON.stringify(
        passengerLogin.body,
      )}`,
    );

    passengerToken =
      passengerLogin.body.token;

    const adminLogin =
      await request(app)
        .post(
          "/api/admin/auth/login",
        )
        .send({
          email:
            "admin@icbt.edu.lk",
          password:
            "admin123",
        });

    assert.equal(
      adminLogin.status,
      200,
      `Admin login failed: ${JSON.stringify(
        adminLogin.body,
      )}`,
    );

    adminToken =
      adminLogin.body.token;
  });

  // =========================================================
  // CLEANUP
  // =========================================================

  after(() => {
    /*
     * Only remove rides created by this coverage suite.
     *
     * Child records are removed first to keep
     * foreign-key relationships safe.
     */
    for (
      const rideId of createdRideIds
    ) {
      db.prepare(
        `
        DELETE FROM reviews
        WHERE ride_id = ?
        `,
      ).run(rideId);

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

    for (
      const reviewId of createdReviewIds
    ) {
      db.prepare(
        `
        DELETE FROM reviews
        WHERE id = ?
        `,
      ).run(reviewId);
    }
  });

  // =========================================================
  // SEARCH FILTERS
  // =========================================================

  it(
    "Rejects an invalid origin filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          origin: "A".repeat(101),
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid origin filter.",
      );
    },
  );

  it(
    "Rejects an invalid destination filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          destination:
            "A".repeat(101),
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid destination filter.",
      );
    },
  );

  it(
    "Rejects an invalid date filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          date: "25-08-2026",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Date must use YYYY-MM-DD format.",
      );
    },
  );

  it(
    "Rejects an invalid odd/even filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          oddEven: "INVALID",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Odd/even filter must be ODD or EVEN.",
      );
    },
  );

  it(
    "Rejects an invalid maximum price filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          maxPrice: "-10",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Maximum price must be a non-negative number.",
      );
    },
  );

  it(
    "Rejects an invalid time window filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          timeWindow:
            "A".repeat(31),
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid time window.",
      );
    },
  );

  it(
    "Accepts a valid date search filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          date: tomorrow(),
        });

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        Array.isArray(
          res.body.rides,
        ),
      );
    },
  );

  it(
    "Accepts the ODD search filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          oddEven: "odd",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        Array.isArray(
          res.body.rides,
        ),
      );
    },
  );

  it(
    "Accepts the EVEN search filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          oddEven: "even",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        Array.isArray(
          res.body.rides,
        ),
      );
    },
  );

  it(
    "Accepts a non-negative maximum price filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          maxPrice: 500,
        });

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        Array.isArray(
          res.body.rides,
        ),
      );
    },
  );

  it(
    "Accepts a valid time window filter",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          timeWindow:
            "morning",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        Array.isArray(
          res.body.rides,
        ),
      );
    },
  );

  it(
    "Searches rides with combined filters",
    async () => {
      const res = await request(app)
        .get("/api/rides")
        .query({
          origin: "Gampaha",
          destination:
            "ICBT Colombo Campus",
          date: tomorrow(),
          oddEven: "ODD",
          maxPrice: 1000,
          timeWindow: "morning",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        Array.isArray(
          res.body.rides,
        ),
      );
    },
  );

  // =========================================================
  // RIDE SEARCH RESPONSE SHAPE
  // =========================================================

  it(
    "Returns parsed route waypoints and rating information",
    async () => {
      const res = await request(app)
        .get("/api/rides");

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
        const ride =
          res.body.rides[0];

        assert.ok(
          Array.isArray(
            ride.route_waypoints,
          ),
        );

        assert.equal(
          typeof ride.avg_rating,
          "number",
        );

        assert.equal(
          typeof ride.total_reviews,
          "number",
        );
      }
    },
  );

  // =========================================================
  // MY RIDES
  // =========================================================

  it(
    "Rejects unauthenticated my-rides access",
    async () => {
      const res = await request(app)
        .get(
          "/api/rides/my-rides",
        );

      assert.equal(
        res.status,
        401,
      );
    },
  );

  it(
    "Returns the authenticated driver's rides with parsed waypoints",
    async () => {
      const res = await request(app)
        .get(
          "/api/rides/my-rides",
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
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
  // RIDE DETAILS
  // =========================================================

  it(
    "Rejects a non-positive ride ID",
    async () => {
      const res = await request(app)
        .get("/api/rides/0");

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid ride ID.",
      );
    },
  );

  it(
    "Rejects a non-numeric ride ID",
    async () => {
      const res = await request(app)
        .get(
          "/api/rides/not-a-number",
        );

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid ride ID.",
      );
    },
  );

  it(
    "Returns ride details including bookings and ratings",
    async () => {
      const rides = await request(app)
        .get("/api/rides");

      assert.equal(
        rides.status,
        200,
      );

      if (
        rides.body.rides.length ===
        0
      ) {
        return;
      }

      const rideId =
        rides.body.rides[0].id;

      const res = await request(app)
        .get(
          `/api/rides/${rideId}`,
        );

      assert.equal(
        res.status,
        200,
      );

      assert.ok(
        res.body.ride,
      );

      assert.equal(
        res.body.ride.id,
        rideId,
      );

      assert.ok(
        Array.isArray(
          res.body.ride
            .route_waypoints,
        ),
      );

      assert.ok(
        Array.isArray(
          res.body.ride.bookings,
        ),
      );

      assert.equal(
        typeof res.body.ride
          .avg_rating,
        "number",
      );

      assert.equal(
        typeof res.body.ride
          .total_reviews,
        "number",
      );
    },
  );

  // =========================================================
  // RIDE CREATION VALIDATION
  // =========================================================

  it(
    "Rejects empty origin and destination",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin: "   ",
          destination: "   ",
          departure_date:
            tomorrow(),
          departure_time:
            "08:00",
          total_seats: 4,
          price_per_seat: 300,
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Origin and destination cannot be empty.",
      );
    },
  );

  it(
    "Rejects an overly long origin",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin:
            "A".repeat(201),
          destination:
            "ICBT Colombo Campus",
          departure_date:
            tomorrow(),
          departure_time:
            "08:00",
          total_seats: 4,
          price_per_seat: 300,
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Origin and destination are too long.",
      );
    },
  );

  it(
    "Rejects an overly long destination",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin:
            "Gampaha",
          destination:
            "A".repeat(201),
          departure_date:
            tomorrow(),
          departure_time:
            "08:00",
          total_seats: 4,
          price_per_seat: 300,
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Origin and destination are too long.",
      );
    },
  );

  it(
    "Rejects an invalid departure time",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin:
            "Gampaha",
          destination:
            "ICBT Colombo Campus",
          departure_date:
            tomorrow(),
          departure_time:
            "99:99",
          total_seats: 4,
          price_per_seat: 300,
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Departure time must use HH:MM format.",
      );
    },
  );

  it(
    "Rejects an invalid return time",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin:
            "Gampaha",
          destination:
            "ICBT Colombo Campus",
          departure_date:
            tomorrow(),
          departure_time:
            "08:00",
          return_time:
            "99:99",
          total_seats: 4,
          price_per_seat: 300,
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Return time must use HH:MM format.",
      );
    },
  );

  it(
    "Accepts an omitted return time",
    async () => {
      const ride =
        await createRide(
          driverToken,
          {
            origin:
              "No Return Time Origin",
            destination:
              "ICBT Colombo Campus",
            return_time:
              undefined,
          },
        );

      assert.equal(
        ride.return_time,
        null,
      );
    },
  );

  it(
    "Rejects zero seats",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin:
            "Gampaha",
          destination:
            "ICBT Colombo Campus",
          departure_date:
            tomorrow(),
          departure_time:
            "08:00",
          total_seats: 0,
          price_per_seat: 300,
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Total seats must be a positive integer.",
      );
    },
  );

  it(
    "Rejects fractional seat counts",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin:
            "Gampaha",
          destination:
            "ICBT Colombo Campus",
          departure_date:
            tomorrow(),
          departure_time:
            "08:00",
          total_seats: 4.5,
          price_per_seat: 300,
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Total seats must be a positive integer.",
      );
    },
  );

  it(
    "Rejects a price greater than the allowed limit",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin:
            "Gampaha",
          destination:
            "ICBT Colombo Campus",
          departure_date:
            tomorrow(),
          departure_time:
            "08:00",
          total_seats: 4,
          price_per_seat:
            100001,
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Price per seat exceeds the allowed limit.",
      );
    },
  );

  it(
    "Accepts an omitted price per seat as zero",
    async () => {
      const ride =
        await createRide(
          driverToken,
          {
            origin:
              "Zero Price Origin",
            destination:
              "ICBT Colombo Campus",
            price_per_seat:
              undefined,
          },
        );

      assert.equal(
        Number(
          ride.price_per_seat,
        ),
        0,
      );
    },
  );

  it(
    "Rejects more than 20 route waypoints",
    async () => {
      const waypoints =
        Array.from(
          { length: 21 },
          (_, index) =>
            `Waypoint-${index}`,
        );

      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin:
            "Gampaha",
          destination:
            "ICBT Colombo Campus",
          route_waypoints:
            waypoints,
          departure_date:
            tomorrow(),
          departure_time:
            "08:00",
          total_seats: 4,
          price_per_seat: 300,
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "A maximum of 20 route waypoints is allowed.",
      );
    },
  );

  it(
    "Accepts empty route waypoints",
    async () => {
      const ride =
        await createRide(
          driverToken,
          {
            origin:
              "Empty Waypoint Origin",
            destination:
              "ICBT Colombo Campus",
            route_waypoints:
              [],
          },
        );

      assert.deepEqual(
        ride.route_waypoints,
        [],
      );
    },
  );

  it(
    "Rejects notes longer than 1000 characters",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          origin:
            "Gampaha",
          destination:
            "ICBT Colombo Campus",
          departure_date:
            tomorrow(),
          departure_time:
            "08:00",
          total_seats: 4,
          price_per_seat: 300,
          notes:
            "N".repeat(1001),
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Ride notes must not exceed 1000 characters.",
      );
    },
  );

  it(
    "Converts non-string notes to a safe string",
    async () => {
      const ride =
        await createRide(
          driverToken,
          {
            origin:
              "Notes Conversion Origin",
            destination:
              "ICBT Colombo Campus",
            notes: 12345,
          },
        );

      assert.equal(
        ride.notes,
        "12345",
      );
    },
  );

  it(
    "Accepts null notes as an empty string",
    async () => {
      const ride =
        await createRide(
          driverToken,
          {
            origin:
              "Null Notes Origin",
            destination:
              "ICBT Colombo Campus",
            notes: null,
          },
        );

      assert.equal(
        ride.notes,
        "",
      );
    },
  );

  it(
    "Creates a ride with all optional fields populated",
    async () => {
      const ride =
        await createRide(
          driverToken,
          {
            origin:
              "Complete Coverage Origin",
            destination:
              "Complete Coverage Destination",
            route_waypoints: [
              "Kiribathgoda",
              "Kelaniya",
              "Wattala",
            ],
            return_time:
              "18:30",
            total_seats: 6,
            price_per_seat: 1500,
            notes:
              "Complete optional field coverage",
          },
        );

      assert.equal(
        ride.status,
        "active",
      );

      assert.equal(
        ride.total_seats,
        6,
      );

      assert.equal(
        ride.available_seats,
        6,
      );

      assert.equal(
        ride.price_per_seat,
        1500,
      );

      assert.deepEqual(
        ride.route_waypoints,
        [
          "Kiribathgoda",
          "Kelaniya",
          "Wattala",
        ],
      );
    },
  );

  // =========================================================
  // STATUS
  // =========================================================

  it(
    "Rejects an invalid status ride ID",
    async () => {
      const res = await request(app)
        .patch(
          "/api/rides/not-a-number/status",
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          status: "active",
        });

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid ride ID.",
      );
    },
  );

  it(
    "Rejects a missing ride when updating status",
    async () => {
      const res = await request(app)
        .patch(
          "/api/rides/999999/status",
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          status: "active",
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

  it(
    "Rejects a passenger from modifying ride status",
    async () => {
      const ride =
        await createRide(
          driverToken,
        );

      const res = await request(app)
        .patch(
          `/api/rides/${ride.id}/status`,
        )
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        )
        .send({
          status:
            "completed",
        });

      assert.equal(
        res.status,
        403,
      );
    },
  );

  it(
    "Admin can modify a ride status",
    async () => {
      const ride =
        await createRide(
          driverToken,
        );

      const res = await request(app)
        .patch(
          `/api/rides/${ride.id}/status`,
        )
        .set(
          "Authorization",
          `Bearer ${adminToken}`,
        )
        .send({
          status:
            "cancelled",
        });

      assert.equal(
        res.status,
        200,
      );

      assert.equal(
        res.body.status,
        "cancelled",
      );
    },
  );

  // =========================================================
  // SOS
  // =========================================================

  it(
    "Rejects an invalid SOS ride ID",
    async () => {
      const res = await request(app)
        .post(
          "/api/rides/not-a-number/sos",
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({});

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid ride ID.",
      );
    },
  );

  it(
    "Returns 404 when triggering SOS for a missing ride",
    async () => {
      const res = await request(app)
        .post(
          "/api/rides/999999/sos",
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({});

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

  it(
    "Uses default SOS message and location",
    async () => {
      const ride =
        await createRide(
          driverToken,
        );

      const res = await request(app)
        .post(
          `/api/rides/${ride.id}/sos`,
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({});

      assert.equal(
        res.status,
        201,
      );

      assert.ok(
        res.body.alert,
      );

      assert.equal(
        res.body.alert.message,
        "Urgent assistance requested by commuter.",
      );

      assert.equal(
        res.body.alert.location,
        "En route to ICBT Campus",
      );
    },
  );

  it(
    "Truncates an oversized SOS message",
    async () => {
      const ride =
        await createRide(
          driverToken,
        );

      const res = await request(app)
        .post(
          `/api/rides/${ride.id}/sos`,
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        )
        .send({
          message:
            "M".repeat(700),
          location:
            "L".repeat(400),
        });

      assert.equal(
        res.status,
        201,
      );

      assert.equal(
        res.body.alert.message.length,
        500,
      );

      assert.equal(
        res.body.alert.location.length,
        300,
      );
    },
  );

  // =========================================================
  // COMPLETE
  // =========================================================

  it(
    "Rejects an invalid completion ride ID",
    async () => {
      const res = await request(app)
        .patch(
          "/api/rides/not-a-number/complete",
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        );

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid ride ID.",
      );
    },
  );

  it(
    "Returns 404 when completing a missing ride",
    async () => {
      const res = await request(app)
        .patch(
          "/api/rides/999999/complete",
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        );

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

  it(
    "Rejects a passenger from completing a ride",
    async () => {
      const ride =
        await createRide(
          driverToken,
        );

      const res = await request(app)
        .patch(
          `/api/rides/${ride.id}/complete`,
        )
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        );

      assert.equal(
        res.status,
        403,
      );

      assert.equal(
        res.body.error,
        "Only the driver can complete this ride.",
      );
    },
  );

  it(
    "Rejects completion of a cancelled ride",
    async () => {
      const ride =
        await createRide(
          driverToken,
        );

      db.prepare(
        `
        UPDATE rides
        SET status = 'cancelled'
        WHERE id = ?
        `,
      ).run(ride.id);

      const res = await request(app)
        .patch(
          `/api/rides/${ride.id}/complete`,
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        );

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Cancelled rides cannot be completed.",
      );
    },
  );

  // =========================================================
  // CANCEL
  // =========================================================

  it(
    "Rejects an invalid cancellation ride ID",
    async () => {
      const res = await request(app)
        .patch(
          "/api/rides/not-a-number/cancel",
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        );

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Invalid ride ID.",
      );
    },
  );

  it(
    "Returns 404 when cancelling a missing ride",
    async () => {
      const res = await request(app)
        .patch(
          "/api/rides/999999/cancel",
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        );

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

  it(
    "Rejects a passenger from cancelling a driver's ride",
    async () => {
      const ride =
        await createRide(
          driverToken,
        );

      const res = await request(app)
        .patch(
          `/api/rides/${ride.id}/cancel`,
        )
        .set(
          "Authorization",
          `Bearer ${passengerToken}`,
        );

      assert.equal(
        res.status,
        403,
      );

      assert.equal(
        res.body.error,
        "Only the driver can cancel this ride.",
      );
    },
  );

  it(
    "Rejects cancellation of an already completed ride",
    async () => {
      const ride =
        await createRide(
          driverToken,
        );

      db.prepare(
        `
        UPDATE rides
        SET status = 'completed'
        WHERE id = ?
        `,
      ).run(ride.id);

      const res = await request(app)
        .patch(
          `/api/rides/${ride.id}/cancel`,
        )
        .set(
          "Authorization",
          `Bearer ${driverToken}`,
        );

      assert.equal(
        res.status,
        400,
      );

      assert.equal(
        res.body.error,
        "Only active rides can be cancelled.",
      );
    },
  );

  // =========================================================
  // FINAL AUTHORIZATION CHECKS
  // =========================================================

  it(
    "Requires authentication for ride creation",
    async () => {
      const res = await request(app)
        .post("/api/rides")
        .send(
          uniqueRide("unauth"),
        );

      assert.equal(
        res.status,
        401,
      );
    },
  );

  it(
    "Requires authentication for ride status updates",
    async () => {
      const res = await request(app)
        .patch(
          "/api/rides/1/status",
        )
        .send({
          status: "active",
        });

      assert.equal(
        res.status,
        401,
      );
    },
  );

  it(
    "Requires authentication for SOS",
    async () => {
      const res = await request(app)
        .post(
          "/api/rides/1/sos",
        )
        .send({
          message:
            "Unauthenticated SOS",
        });

      assert.equal(
        res.status,
        401,
      );
    },
  );

  it(
    "Requires authentication for completion",
    async () => {
      const res = await request(app)
        .patch(
          "/api/rides/1/complete",
        );

      assert.equal(
        res.status,
        401,
      );
    },
  );

  it(
    "Requires authentication for cancellation",
    async () => {
      const res = await request(app)
        .patch(
          "/api/rides/1/cancel",
        );

      assert.equal(
        res.status,
        401,
      );
    },
  );
});