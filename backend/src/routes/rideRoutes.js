const express = require("express");

const db = require("../db");

const { authenticateToken, requireApprovedDriver } = require("../auth");

const router = express.Router();

/*
 * =========================================================
 * VALIDATION HELPERS
 * =========================================================
 */

const ALLOWED_RIDE_STATUSES = [
  "active",
  "scheduled",
  "in_transit",
  "completed",
  "cancelled",
];

const ALLOWED_ODD_EVEN = ["ODD", "EVEN"];

const isValidPositiveInteger = (value) => {
  const number = Number(value);

  return Number.isInteger(number) && number > 0;
};

const isValidNonNegativeNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0;
};

const isValidISODate = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return !Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(value);
};

const isValidTime = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
};

const parseWaypoints = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return [];
};

const safeParseWaypoints = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
};

/*
 * =========================================================
 * GET /api/rides
 * Search available rides
 * =========================================================
 */

router.get("/", (req, res) => {
  try {
    const { origin, destination, date, timeWindow, oddEven, maxPrice } =
      req.query;

    let query = `
      SELECT
        r.*,
        u.name AS driver_name,
        u.email AS driver_email,
        u.phone AS driver_phone,
        u.avatar AS driver_avatar,
        u.role AS driver_role,
        dv.vehicle_model,
        dv.vehicle_plate,
        dv.odd_even_type,
        dv.fuel_type
      FROM rides r
      JOIN users u
        ON r.driver_id = u.id
      JOIN driver_verifications dv
        ON r.driver_id = dv.user_id
      WHERE r.status = 'active'
        AND r.available_seats > 0
        AND dv.status = 'approved'
    `;

    const params = [];

    /*
     * Origin filter
     */
    if (origin !== undefined) {
      if (typeof origin !== "string" || origin.trim().length > 100) {
        return res.status(400).json({
          error: "Invalid origin filter.",
        });
      }

      query += `
        AND (
          LOWER(r.origin) LIKE LOWER(?)
          OR LOWER(r.route_waypoints) LIKE LOWER(?)
        )
      `;

      const normalizedOrigin = origin.trim();

      params.push(`%${normalizedOrigin}%`, `%${normalizedOrigin}%`);
    }

    /*
     * Destination filter
     */
    if (destination !== undefined) {
      if (typeof destination !== "string" || destination.trim().length > 100) {
        return res.status(400).json({
          error: "Invalid destination filter.",
        });
      }

      query += `
        AND (
          LOWER(r.destination) LIKE LOWER(?)
          OR LOWER(r.route_waypoints) LIKE LOWER(?)
        )
      `;

      const normalizedDestination = destination.trim();

      params.push(`%${normalizedDestination}%`, `%${normalizedDestination}%`);
    }

    /*
     * Date filter
     */
    if (date !== undefined) {
      if (!isValidISODate(date)) {
        return res.status(400).json({
          error: "Date must use YYYY-MM-DD format.",
        });
      }

      query += `
        AND r.departure_date = ?
      `;

      params.push(date);
    }

    /*
     * Odd / Even filter
     */
    if (oddEven !== undefined) {
      const normalizedOddEven = String(oddEven).toUpperCase();

      if (!ALLOWED_ODD_EVEN.includes(normalizedOddEven)) {
        return res.status(400).json({
          error: "Odd/even filter must be ODD or EVEN.",
        });
      }

      query += `
        AND r.odd_even_tag = ?
      `;

      params.push(normalizedOddEven);
    }

    /*
     * Maximum price filter
     */
    if (maxPrice !== undefined) {
      if (!isValidNonNegativeNumber(maxPrice)) {
        return res.status(400).json({
          error: "Maximum price must be a non-negative number.",
        });
      }

      query += `
        AND r.price_per_seat <= ?
      `;

      params.push(Number(maxPrice));
    }

    /*
     * Time window
     *
     * The current API only accepts a simple
     * query value. Ignore unknown values safely
     * rather than constructing dynamic SQL.
     */
    if (timeWindow !== undefined) {
      if (typeof timeWindow !== "string" || timeWindow.length > 30) {
        return res.status(400).json({
          error: "Invalid time window.",
        });
      }
    }

    query += `
      ORDER BY
        r.departure_date ASC,
        r.departure_time ASC
    `;

    const rides = db.prepare(query).all(...params);

    const formattedRides = rides.map((ride) => {
      const reviews = db
        .prepare(
          `
            SELECT rating
            FROM reviews
            WHERE ride_id = ?
            `,
        )
        .all(ride.id);

      const totalReviews = reviews.length;

      const avgRating =
        totalReviews > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) /
            totalReviews
          : 0;

      return {
        ...ride,
        route_waypoints: safeParseWaypoints(ride.route_waypoints),
        avg_rating: avgRating,
        total_reviews: totalReviews,
      };
    });

    return res.status(200).json({
      rides: formattedRides,
    });
  } catch (error) {
    console.error("Fetch rides error:", error);

    return res.status(500).json({
      error: "Failed to search available rides.",
    });
  }
});

/*
 * =========================================================
 * GET /api/rides/my-rides
 * =========================================================
 */

router.get("/my-rides", authenticateToken, (req, res) => {
  try {
    const rides = db
      .prepare(
        `
          SELECT
            r.*,
            (
              SELECT COUNT(*)
              FROM bookings b
              WHERE
                b.ride_id = r.id
                AND b.status = 'confirmed'
            ) AS confirmed_passengers_count,
            (
              SELECT COUNT(*)
              FROM bookings b
              WHERE
                b.ride_id = r.id
                AND b.status = 'pending'
            ) AS pending_requests_count
          FROM rides r
          WHERE r.driver_id = ?
          ORDER BY
            r.departure_date DESC,
            r.departure_time DESC
          `,
      )
      .all(req.user.id);

    const formatted = rides.map((ride) => ({
      ...ride,
      route_waypoints: safeParseWaypoints(ride.route_waypoints),
    }));

    return res.status(200).json({
      rides: formatted,
    });
  } catch (error) {
    console.error("Fetch driver rides error:", error);

    return res.status(500).json({
      error: "Failed to fetch your rides.",
    });
  }
});

/*
 * =========================================================
 * GET /api/rides/:id
 * =========================================================
 */

router.get("/:id", (req, res) => {
  try {
    const rideId = Number(req.params.id);

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return res.status(400).json({
        error: "Invalid ride ID.",
      });
    }

    const ride = db
      .prepare(
        `
        SELECT
          r.*,
          u.name AS driver_name,
          u.email AS driver_email,
          u.phone AS driver_phone,
          u.avatar AS driver_avatar,
          u.role AS driver_role,
          dv.vehicle_model,
          dv.vehicle_plate,
          dv.odd_even_type,
          dv.fuel_type
        FROM rides r
        JOIN users u
          ON r.driver_id = u.id
        JOIN driver_verifications dv
          ON r.driver_id = dv.user_id
        WHERE
          r.id = ?
          AND dv.status = 'approved'
        `,
      )
      .get(rideId);

    if (!ride) {
      return res.status(404).json({
        error: "Ride not found.",
      });
    }

    /*
     * Privacy:
     * Do not expose passenger phone/details
     * publicly.
     */
    const bookings = db
      .prepare(
        `
        SELECT
          b.id,
          b.ride_id,
          b.seats_booked,
          b.booking_code,
          b.status,
          b.payment_status,
          b.created_at,
          u.name AS passenger_name,
          u.avatar AS passenger_avatar
        FROM bookings b
        JOIN users u
          ON b.passenger_id = u.id
        WHERE
          b.ride_id = ?
          AND b.status != 'cancelled'
        `,
      )
      .all(rideId);

    const reviews = db
      .prepare(
        `
        SELECT rating
        FROM reviews
        WHERE ride_id = ?
        `,
      )
      .all(rideId);

    const totalReviews = reviews.length;

    const avgRating =
      totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
        : 0;

    return res.status(200).json({
      ride: {
        ...ride,
        route_waypoints: safeParseWaypoints(ride.route_waypoints),
        bookings,
        avg_rating: avgRating,
        total_reviews: totalReviews,
      },
    });
  } catch (error) {
    console.error("Fetch ride details error:", error);

    return res.status(500).json({
      error: "Failed to fetch ride details.",
    });
  }
});

/*
 * =========================================================
 * POST /api/rides
 * Create new ride
 * =========================================================
 */

router.post("/", authenticateToken, requireApprovedDriver, (req, res) => {
  try {
    const {
      origin,
      destination,
      route_waypoints,
      departure_date,
      departure_time,
      return_time,
      total_seats,
      price_per_seat,
      notes,
    } = req.body;

    /*
     * Required fields
     */
    if (
      typeof origin !== "string" ||
      typeof destination !== "string" ||
      typeof departure_date !== "string" ||
      typeof departure_time !== "string"
    ) {
      return res.status(400).json({
        error:
          "Origin, destination, departure date and departure time are required.",
      });
    }

    const normalizedOrigin = origin.trim();

    const normalizedDestination = destination.trim();

    if (!normalizedOrigin || !normalizedDestination) {
      return res.status(400).json({
        error: "Origin and destination cannot be empty.",
      });
    }

    if (normalizedOrigin.length > 200 || normalizedDestination.length > 200) {
      return res.status(400).json({
        error: "Origin and destination are too long.",
      });
    }

    /*
     * Date validation
     */
    if (!isValidISODate(departure_date)) {
      return res.status(400).json({
        error: "Departure date must use YYYY-MM-DD format.",
      });
    }

    /*
     * Time validation
     */
    if (!isValidTime(departure_time)) {
      return res.status(400).json({
        error: "Departure time must use HH:MM format.",
      });
    }

    if (
      return_time !== undefined &&
      return_time !== null &&
      return_time !== "" &&
      !isValidTime(return_time)
    ) {
      return res.status(400).json({
        error: "Return time must use HH:MM format.",
      });
    }

    /*
     * Seat validation
     */
    if (!isValidPositiveInteger(total_seats)) {
      return res.status(400).json({
        error: "Total seats must be a positive integer.",
      });
    }

    const seats = Number(total_seats);

    if (seats > 12) {
      return res.status(400).json({
        error: "A ride cannot have more than 12 seats.",
      });
    }

    /*
     * Price validation
     */
    if (
      price_per_seat !== undefined &&
      !isValidNonNegativeNumber(price_per_seat)
    ) {
      return res.status(400).json({
        error: "Price per seat must be a non-negative number.",
      });
    }

    const pricePerSeat =
      price_per_seat === undefined ? 0 : Number(price_per_seat);

    if (pricePerSeat > 100000) {
      return res.status(400).json({
        error: "Price per seat exceeds the allowed limit.",
      });
    }

    /*
     * Waypoint validation
     */
    const waypoints = parseWaypoints(route_waypoints);

    if (waypoints.length > 20) {
      return res.status(400).json({
        error: "A maximum of 20 route waypoints is allowed.",
      });
    }

    /*
     * Notes validation
     */
    const normalizedNotes =
      notes === undefined || notes === null ? "" : String(notes).trim();

    if (normalizedNotes.length > 1000) {
      return res.status(400).json({
        error: "Ride notes must not exceed 1000 characters.",
      });
    }

    /*
     * Approved driver information comes
     * from server-side middleware.
     */
    const driverDoc = req.driverInfo;

    if (!driverDoc) {
      return res.status(403).json({
        error: "Approved driver verification is required.",
      });
    }

    if (
      !ALLOWED_ODD_EVEN.includes(String(driverDoc.odd_even_type).toUpperCase())
    ) {
      return res.status(400).json({
        error: "Driver has an invalid odd/even vehicle classification.",
      });
    }

    const result = db
      .prepare(
        `
          INSERT INTO rides (
            driver_id,
            origin,
            destination,
            route_waypoints,
            departure_date,
            departure_time,
            return_time,
            total_seats,
            available_seats,
            price_per_seat,
            vehicle_desc,
            odd_even_tag,
            notes,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
          `,
      )
      .run(
        req.user.id,
        normalizedOrigin,
        normalizedDestination,
        JSON.stringify(waypoints),
        departure_date,
        departure_time,
        return_time || null,
        seats,
        seats,
        pricePerSeat,
        `${driverDoc.vehicle_model} (${driverDoc.vehicle_plate})`,
        String(driverDoc.odd_even_type).toUpperCase(),
        normalizedNotes,
      );

    const newRide = db
      .prepare(
        `
          SELECT *
          FROM rides
          WHERE id = ?
          `,
      )
      .get(result.lastInsertRowid);

    return res.status(201).json({
      message: "Carpool ride published successfully.",
      ride: {
        ...newRide,
        route_waypoints: safeParseWaypoints(newRide.route_waypoints),
      },
    });
  } catch (error) {
    console.error("Create ride error:", error);

    return res.status(500).json({
      error: "Server error while publishing ride.",
    });
  }
});

/*
 * =========================================================
 * PATCH /api/rides/:id/status
 * =========================================================
 */

router.patch("/:id/status", authenticateToken, (req, res) => {
  try {
    const rideId = Number(req.params.id);

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return res.status(400).json({
        error: "Invalid ride ID.",
      });
    }

    const { status } = req.body;

    if (typeof status !== "string" || !ALLOWED_RIDE_STATUSES.includes(status)) {
      return res.status(400).json({
        error: "Invalid ride status.",
      });
    }

    const ride = db
      .prepare(
        `
          SELECT *
          FROM rides
          WHERE id = ?
          `,
      )
      .get(rideId);

    if (!ride) {
      return res.status(404).json({
        error: "Ride not found.",
      });
    }

    if (ride.driver_id !== req.user.id && req.user.system_role !== "admin") {
      return res.status(403).json({
        error: "You are not authorized to modify this ride.",
      });
    }

    db.prepare(
      `
        UPDATE rides
        SET status = ?
        WHERE id = ?
        `,
    ).run(status, rideId);

    const io = req.app.get("io");

    if (io) {
      io.to(`ride-${rideId}`).emit("ride_status_updated", {
        rideId,
        status,
        updatedBy: req.user.name,
      });
    }

    return res.status(200).json({
      message: `Ride status updated to ${status}`,
      status,
    });
  } catch (error) {
    console.error("Ride status update error:", error);

    return res.status(500).json({
      error: "Failed to update ride status.",
    });
  }
});

/*
 * =========================================================
 * POST /api/rides/:id/sos
 * =========================================================
 */

router.post("/:id/sos", authenticateToken, (req, res) => {
  try {
    const rideId = Number(req.params.id);

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return res.status(400).json({
        error: "Invalid ride ID.",
      });
    }

    const { message, location } = req.body;

    const ride = db
      .prepare(
        `
          SELECT *
          FROM rides
          WHERE id = ?
          `,
      )
      .get(rideId);

    if (!ride) {
      return res.status(404).json({
        error: "Ride not found.",
      });
    }

    /*
     * Only the driver or confirmed passenger
     * can trigger an SOS for this ride.
     */
    const isDriver = ride.driver_id === req.user.id;

    const confirmedBooking = db
      .prepare(
        `
            SELECT id
            FROM bookings
            WHERE
              ride_id = ?
              AND passenger_id = ?
              AND status = 'confirmed'
            LIMIT 1
            `,
      )
      .get(rideId, req.user.id);

    if (!isDriver && !confirmedBooking) {
      return res.status(403).json({
        error:
          "Only the driver or a confirmed passenger can trigger an SOS for this ride.",
      });
    }

    const safeMessage =
      message === undefined || message === null
        ? "Urgent assistance requested by commuter."
        : String(message).trim().slice(0, 500);

    const safeLocation =
      location === undefined || location === null
        ? "En route to ICBT Campus"
        : String(location).trim().slice(0, 300);

    const sosAlert = {
      alertId: `SOS-${Date.now()}-${req.user.id}`,

      rideId,

      userId: req.user.id,

      userName: req.user.name,

      userRole: req.user.role,

      userPhone: req.user.phone || null,

      driverId: ride.driver_id,

      vehicleDesc: ride.vehicle_desc,

      location: safeLocation,

      timestamp: new Date().toISOString(),

      message: safeMessage,
    };

    const io = req.app.get("io");

    if (io) {
      /*
       * Admin/security notification
       */
      io.emit("campus_sos_alert", sosAlert);

      /*
       * Ride participants
       */
      io.to(`ride-${rideId}`).emit("sos_triggered", sosAlert);
    }

    return res.status(201).json({
      message: "Emergency SOS broadcasted to ICBT Campus Security Hotline.",
      alert: sosAlert,
    });
  } catch (error) {
    console.error("SOS Alert error:", error);

    return res.status(500).json({
      error: "Failed to broadcast SOS alert.",
    });
  }
});

/*
 * =========================================================
 * PATCH /api/rides/:id/complete
 * =========================================================
 */

router.patch("/:id/complete", authenticateToken, (req, res) => {
  try {
    const rideId = Number(req.params.id);

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return res.status(400).json({
        error: "Invalid ride ID.",
      });
    }

    const ride = db
      .prepare(
        `
          SELECT *
          FROM rides
          WHERE id = ?
          `,
      )
      .get(rideId);

    if (!ride) {
      return res.status(404).json({
        error: "Ride not found.",
      });
    }

    if (ride.driver_id !== req.user.id) {
      return res.status(403).json({
        error: "Only the driver can complete this ride.",
      });
    }

    if (ride.status === "completed") {
      return res.status(400).json({
        error: "Ride is already completed.",
      });
    }

    if (ride.status === "cancelled") {
      return res.status(400).json({
        error: "Cancelled rides cannot be completed.",
      });
    }

    db.prepare(
      `
        UPDATE rides
        SET status = ?
        WHERE id = ?
        `,
    ).run("completed", rideId);

    db.prepare(
      `
        UPDATE bookings
        SET status = ?
        WHERE
          ride_id = ?
          AND status = ?
        `,
    ).run("completed", rideId, "confirmed");

    const completedBookings = db
      .prepare(
        `
            SELECT passenger_id
            FROM bookings
            WHERE
              ride_id = ?
              AND status = ?
            `,
      )
      .all(rideId, "completed");

    const io = req.app.get("io");

    if (io) {
      completedBookings.forEach((booking) => {
        io.to(`user-${booking.passenger_id}`).emit("ride_completed", {
          rideId,
          origin: ride.origin,
          destination: ride.destination,
        });
      });
    }

    return res.status(200).json({
      message: "Ride marked as completed",
      rideId,
    });
  } catch (error) {
    console.error("Ride complete error:", error);

    return res.status(500).json({
      error: "Failed to complete ride.",
    });
  }
});

/*
 * =========================================================
 * PATCH /api/rides/:id/cancel
 * =========================================================
 */

router.patch("/:id/cancel", authenticateToken, (req, res) => {
  try {
    const rideId = Number(req.params.id);

    if (!Number.isInteger(rideId) || rideId <= 0) {
      return res.status(400).json({
        error: "Invalid ride ID.",
      });
    }

    const ride = db
      .prepare(
        `
          SELECT *
          FROM rides
          WHERE id = ?
          `,
      )
      .get(rideId);

    if (!ride) {
      return res.status(404).json({
        error: "Ride not found.",
      });
    }

    if (ride.driver_id !== req.user.id) {
      return res.status(403).json({
        error: "Only the driver can cancel this ride.",
      });
    }

    if (ride.status !== "active") {
      return res.status(400).json({
        error: "Only active rides can be cancelled.",
      });
    }

    db.prepare(
      `
        UPDATE rides
        SET status = ?
        WHERE id = ?
        `,
    ).run("cancelled", rideId);

    const affectedBookings = db
      .prepare(
        `
            SELECT *
            FROM bookings
            WHERE
              ride_id = ?
              AND status IN (?, ?)
            `,
      )
      .all(rideId, "pending", "confirmed");

    db.prepare(
      `
        UPDATE bookings
        SET status = ?
        WHERE
          ride_id = ?
          AND status IN (?, ?)
        `,
    ).run("cancelled", rideId, "pending", "confirmed");

    const io = req.app.get("io");

    if (io) {
      affectedBookings.forEach((booking) => {
        io.to(`user-${booking.passenger_id}`).emit("booking_status_updated", {
          bookingId: booking.id,

          rideId,

          status: "cancelled",

          reason: "Driver cancelled the ride",
        });
      });
    }

    return res.status(200).json({
      message: "Ride cancelled",
      affectedPassengers: affectedBookings.length,
    });
  } catch (error) {
    console.error("Ride cancel error:", error);

    return res.status(500).json({
      error: "Failed to cancel ride.",
    });
  }
});

module.exports = router;
