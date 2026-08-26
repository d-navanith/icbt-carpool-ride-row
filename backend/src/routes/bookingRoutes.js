const express = require("express");
const crypto = require("crypto");

const db = require("../db");
const { authenticateToken } = require("../auth");

const router = express.Router();

/*
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const ALLOWED_BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
  "completed",
];

const ALLOWED_PAYMENT_METHODS = [
  "Cash Payment",
  "Cash",
  "Card",
  "Bank Transfer",
  "Online Payment",
];

/*
 * =========================================================
 * VALIDATION HELPERS
 * =========================================================
 */

const parsePositiveInteger = (value) => {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
};

const isValidStatus = (status) => {
  return (
    typeof status === "string" && ALLOWED_BOOKING_STATUSES.includes(status)
  );
};

const normalizePickupLocation = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const location = value.trim();

  if (!location || location.length > 250) {
    return null;
  }

  return location;
};

const isValidPaymentMethod = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();

  return ALLOWED_PAYMENT_METHODS.some(
    (method) => method.toLowerCase() === normalizedValue,
  );
};

const getCurrentUser = (userId) => {
  return db
    .prepare(
      `
      SELECT
        id,
        name,
        email,
        role,
        system_role,
        phone,
        avatar,
        suspended
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
    )
    .get(userId);
};

const ensureActiveUser = (userId) => {
  const user = getCurrentUser(userId);

  if (!user) {
    const error = new Error("User account not found.");
    error.statusCode = 401;
    throw error;
  }

  if (user.suspended) {
    const error = new Error("Your account has been suspended.");
    error.statusCode = 403;
    throw error;
  }

  return user;
};

/*
 * Generate a unique booking code.
 *
 * crypto.randomInt() is preferable to Math.random()
 * for unpredictable identifiers.
 */
const generateUniqueBookingCode = () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `CP-${crypto.randomInt(100000, 1000000)}`;

    const existing = db
      .prepare(
        `
        SELECT id
        FROM bookings
        WHERE booking_code = ?
        LIMIT 1
        `,
      )
      .get(code);

    if (!existing) {
      return code;
    }
  }

  const error = new Error("Unable to generate a unique booking code.");

  error.statusCode = 500;
  throw error;
};

/*
 * =========================================================
 * BOOKING STATE TRANSITIONS
 * =========================================================
 *
 * pending:
 *   passenger can cancel
 *   driver can confirm/reject
 *
 * confirmed:
 *   passenger can cancel
 *   driver cannot re-confirm
 *   driver/payment endpoint can complete payment
 *
 * rejected:
 *   terminal state
 *
 * cancelled:
 *   terminal state
 *
 * completed:
 *   terminal state
 */

const validateBookingTransition = ({
  previousStatus,
  newStatus,
  isPassenger,
  isDriver,
  isAdmin,
}) => {
  if (!ALLOWED_BOOKING_STATUSES.includes(newStatus)) {
    const error = new Error("Invalid booking status.");
    error.statusCode = 400;
    throw error;
  }

  /*
   * =======================================================
   * PASSENGER TRANSITIONS
   * =======================================================
   *
   * pending   -> cancelled
   * confirmed -> cancelled
   */
  if (isPassenger && !isDriver && !isAdmin) {
    if (previousStatus !== "pending" && previousStatus !== "confirmed") {
      const error = new Error("This booking can no longer be cancelled.");

      error.statusCode = 400;
      throw error;
    }

    if (newStatus !== "cancelled") {
      const error = new Error("Passengers can only cancel their booking.");

      error.statusCode = 403;
      throw error;
    }

    return;
  }

  /*
   * =======================================================
   * DRIVER TRANSITIONS
   * =======================================================
   *
   * pending   -> confirmed
   * pending   -> rejected
   * confirmed -> rejected
   *
   * confirmed -> confirmed is allowed as an idempotent
   * request, although the transaction later treats a
   * no-op as invalid.
   */
  if (isDriver && !isAdmin) {
    const validDriverTransition =
      (previousStatus === "pending" &&
        (newStatus === "confirmed" || newStatus === "rejected")) ||
      (previousStatus === "confirmed" &&
        (newStatus === "rejected" || newStatus === "confirmed"));

    if (validDriverTransition) {
      return;
    }

    const error = new Error(
      "Only active bookings can be accepted or rejected.",
    );

    error.statusCode = 400;
    throw error;
  }

  /*
   * =======================================================
   * ADMIN TRANSITIONS
   * =======================================================
   */
  if (isAdmin) {
    const allowedTransitions = {
      pending: ["confirmed", "rejected", "cancelled"],
      confirmed: ["cancelled", "completed", "rejected"],
      rejected: [],
      cancelled: [],
      completed: [],
    };

    if (!allowedTransitions[previousStatus]?.includes(newStatus)) {
      const error = new Error(
        `Invalid admin booking transition from ${previousStatus} to ${newStatus}.`,
      );

      error.statusCode = 400;
      throw error;
    }

    return;
  }

  /*
   * =======================================================
   * NO AUTHORIZATION
   * =======================================================
   */
  const error = new Error("Not authorized to change this booking.");

  error.statusCode = 403;
  throw error;
};

/*
 * =========================================================
 * ATOMIC BOOKING CREATION
 * =========================================================
 */

const createBookingTransaction = db.transaction(
  ({ rideId, passengerId, seatsBooked, pickupLocation, bookingCode }) => {
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
      const error = new Error("Ride not found.");
      error.statusCode = 404;
      throw error;
    }

    if (ride.status !== "active") {
      const error = new Error("This carpool ride is no longer active.");

      error.statusCode = 400;
      throw error;
    }

    if (ride.available_seats <= 0) {
      const error = new Error(
        "No seats are currently available on this carpool.",
      );

      error.statusCode = 400;
      throw error;
    }

    if (ride.driver_id === passengerId) {
      const error = new Error("You cannot book your own ride.");

      error.statusCode = 400;
      throw error;
    }

    if (!Number.isInteger(seatsBooked) || seatsBooked < 1) {
      const error = new Error("Please select at least 1 seat.");

      error.statusCode = 400;
      throw error;
    }

    if (seatsBooked > ride.available_seats) {
      const error = new Error(
        `Only ${ride.available_seats} seat${
          ride.available_seats !== 1 ? "s" : ""
        } available on this carpool.`,
      );

      error.statusCode = 400;
      throw error;
    }

    /*
     * Prevent duplicate active booking.
     */
    const existing = db
      .prepare(
        `
        SELECT id
        FROM bookings
        WHERE
          ride_id = ?
          AND passenger_id = ?
          AND status IN ('pending', 'confirmed')
        LIMIT 1
        `,
      )
      .get(rideId, passengerId);

    if (existing) {
      const error = new Error(
        "You already have an active booking for this ride.",
      );

      error.statusCode = 400;
      throw error;
    }

    /*
     * Insert pending booking.
     */
    const result = db
      .prepare(
        `
        INSERT INTO bookings (
          ride_id,
          passenger_id,
          seats_booked,
          pickup_location,
          booking_code,
          status,
          payment_status,
          payment_method,
          paid_amount,
          created_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          'pending',
          'unpaid',
          NULL,
          0,
          CURRENT_TIMESTAMP
        )
        `,
      )
      .run(rideId, passengerId, seatsBooked, pickupLocation, bookingCode);

    /*
     * Decrement available seats atomically.
     */
    const seatUpdate = db
      .prepare(
        `
        UPDATE rides
        SET available_seats = available_seats - ?
        WHERE
          id = ?
          AND available_seats >= ?
        `,
      )
      .run(seatsBooked, rideId, seatsBooked);

    if (seatUpdate.changes !== 1) {
      const error = new Error("Unable to reserve the requested seats.");

      error.statusCode = 409;
      throw error;
    }

    return db
      .prepare(
        `
        SELECT *
        FROM bookings
        WHERE id = ?
        `,
      )
      .get(result.lastInsertRowid);
  },
);

/*
 * =========================================================
 * ATOMIC BOOKING STATUS UPDATE
 * =========================================================
 */

const updateBookingStatusTransaction = db.transaction(
  ({ bookingId, newStatus, user }) => {
    const booking = db
      .prepare(
        `
          SELECT *
          FROM bookings
          WHERE id = ?
          `,
      )
      .get(bookingId);

    if (!booking) {
      const error = new Error("Booking not found.");

      error.statusCode = 404;
      throw error;
    }

    const ride = db
      .prepare(
        `
          SELECT *
          FROM rides
          WHERE id = ?
          `,
      )
      .get(booking.ride_id);

    if (!ride) {
      const error = new Error("Associated ride not found.");

      error.statusCode = 404;
      throw error;
    }

    const isPassenger = booking.passenger_id === user.id;
    const isDriver = ride.driver_id === user.id;
    const isAdmin = user.system_role === "admin";

    const previousStatus = String(booking.status || "")
      .trim()
      .toLowerCase();

    const normalizedNewStatus = String(newStatus || "")
      .trim()
      .toLowerCase();

    validateBookingTransition({
      previousStatus,
      newStatus: normalizedNewStatus,
      isPassenger,
      isDriver,
      isAdmin,
    });

    /*
     * No-op transitions are rejected.
     */
    if (previousStatus === normalizedNewStatus) {
      const error = new Error("Booking is already in this status.");

      error.statusCode = 400;
      throw error;
    }

    const wasActive =
      previousStatus === "pending" || previousStatus === "confirmed";

    const becomesActive =
      normalizedNewStatus === "pending" || normalizedNewStatus === "confirmed";

    const becomesInactive =
      normalizedNewStatus === "cancelled" || normalizedNewStatus === "rejected";

    /*
     * When an inactive booking is reactivated,
     * verify seats before activating it.
     *
     * In practice, terminal rejected/cancelled
     * states cannot be reactivated by normal users.
     */
    if (!wasActive && becomesActive) {
      if (ride.available_seats < booking.seats_booked) {
        const error = new Error("Not enough seats available on this carpool.");

        error.statusCode = 400;
        throw error;
      }

      db.prepare(
        `
          UPDATE rides
          SET available_seats =
            available_seats - ?
          WHERE id = ?
          `,
      ).run(booking.seats_booked, booking.ride_id);
    }

    /*
     * Active -> cancelled/rejected
     * restores seats.
     */
    if (wasActive && becomesInactive) {
      db.prepare(
        `
          UPDATE rides
          SET available_seats =
            MIN(
              total_seats,
              available_seats + ?
            )
          WHERE id = ?
          `,
      ).run(booking.seats_booked, booking.ride_id);
    }

    /*
     * Completed booking should not
     * manipulate available seats again.
     */

    db.prepare(
      `
        UPDATE bookings
        SET status = ?
        WHERE id = ?
        `,
    ).run(normalizedNewStatus, bookingId);

    return {
      bookingId: Number(bookingId),
      status: normalizedNewStatus,
    };
  },
);

/*
 * =========================================================
 * 1. CREATE BOOKING
 * =========================================================
 */

router.post("/", authenticateToken, (req, res) => {
  try {
    const user = ensureActiveUser(req.user.id);

    const rideId = parsePositiveInteger(req.body.ride_id);

    if (!rideId) {
      return res.status(400).json({
        error: "A valid ride ID is required.",
      });
    }

    const pickupLocation = normalizePickupLocation(req.body.pickup_location);

    if (!pickupLocation) {
      return res.status(400).json({
        error: "A valid pickup location is required.",
      });
    }

    let rawSeats = req.body.seats_booked ?? req.body.seats;

    if (rawSeats === undefined || rawSeats === null || rawSeats === "") {
      rawSeats = 1;
    }

    const requestedSeats = Number(rawSeats);

    if (!Number.isInteger(requestedSeats) || requestedSeats < 1) {
      return res.status(400).json({
        error: "Please select at least 1 seat to reserve.",
      });
    }

    /*
     * Prevent unrealistic seat requests.
     * Actual ride availability is checked
     * again inside the transaction.
     */

    const bookingCode = generateUniqueBookingCode();

    const newBooking = createBookingTransaction({
      rideId,
      passengerId: user.id,
      seatsBooked: requestedSeats,
      pickupLocation,
      bookingCode,
    });

    /*
     * Socket notification.
     */
    const io = req.app.get("io");

    if (io) {
      try {
        const ride = db
          .prepare(
            `
              SELECT *
              FROM rides
              WHERE id = ?
              `,
          )
          .get(rideId);

        const passenger = db
          .prepare(
            `
              SELECT
                id,
                name,
                phone,
                student_staff_id,
                avatar
              FROM users
              WHERE id = ?
              `,
          )
          .get(user.id);

        const bookingPayload = {
          bookingId: newBooking.id,

          id: newBooking.id,

          booking_code: newBooking.booking_code,

          ride_id: rideId,

          rideId: rideId,

          driver_id: ride ? ride.driver_id : null,

          driverId: ride ? ride.driver_id : null,

          passenger_id: user.id,

          passengerId: user.id,

          passenger_name: passenger?.name || user.name,

          passengerName: passenger?.name || user.name,

          passenger_phone: passenger?.phone || "",

          passengerPhone: passenger?.phone || "",

          passenger_avatar: passenger?.avatar || "",

          passengerAvatar: passenger?.avatar || "",

          student_staff_id: passenger?.student_staff_id || "",

          pickup_location: newBooking.pickup_location,

          pickupLocation: newBooking.pickup_location,

          seats_booked: newBooking.seats_booked,

          seats: newBooking.seats_booked,

          origin: ride?.origin || "",

          destination: ride?.destination || "",

          departure_date: ride?.departure_date || "",

          departureDate: ride?.departure_date || "",

          departure_time: ride?.departure_time || "",

          departureTime: ride?.departure_time || "",

          price_per_seat: ride?.price_per_seat || 0,

          pricePerSeat: ride?.price_per_seat || 0,

          available_seats: ride?.available_seats || 0,

          status: "pending",

          created_at: newBooking.created_at || new Date().toISOString(),
        };

        if (ride?.driver_id) {
          io.to(`user-${ride.driver_id}`).emit(
            "new_booking_request",
            bookingPayload,
          );
        }

        io.emit("booking_created", bookingPayload);
      } catch (notificationError) {
        console.error(
          "Socket notification error on new booking:",
          notificationError,
        );
      }
    }

    return res.status(201).json({
      message: "Ride booked successfully!",
      booking: newBooking,
    });
  } catch (error) {
    console.error("Booking transaction error:", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Failed to complete ride booking.",
    });
  }
});

/*
 * =========================================================
 * 2. GET MY BOOKINGS
 * =========================================================
 */

router.get("/my-bookings", authenticateToken, (req, res) => {
  try {
    ensureActiveUser(req.user.id);

    const bookings = db
      .prepare(
        `
          SELECT
            b.*,
            r.origin,
            r.destination,
            r.departure_date,
            r.departure_time,
            r.price_per_seat,
            r.vehicle_desc,
            r.odd_even_tag,
            r.status AS ride_status,
            u.name AS driver_name,
            u.phone AS driver_phone,
            u.avatar AS driver_avatar
          FROM bookings b
          JOIN rides r
            ON b.ride_id = r.id
          JOIN users u
            ON r.driver_id = u.id
          WHERE b.passenger_id = ?
          ORDER BY
            b.created_at DESC
          `,
      )
      .all(req.user.id);

    return res.status(200).json({
      bookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Failed to fetch your bookings.",
    });
  }
});

/*
 * =========================================================
 * 3. DRIVER BOOKING REQUESTS
 * =========================================================
 */

router.get("/driver/requests", authenticateToken, (req, res) => {
  try {
    ensureActiveUser(req.user.id);

    const rides = db
      .prepare(
        `
          SELECT id
          FROM rides
          WHERE driver_id = ?
          `,
      )
      .all(req.user.id);

    const rideIds = rides.map((ride) => ride.id);

    if (rideIds.length === 0) {
      return res.json({
        bookings: [],
      });
    }

    const allBookings = [];

    for (const rideId of rideIds) {
      const ride = db
        .prepare(
          `
            SELECT *
            FROM rides
            WHERE id = ?
            `,
        )
        .get(rideId);

      const bookings = db
        .prepare(
          `
            SELECT
              b.*,
              u.name AS passenger_name,
              u.email AS passenger_email,
              u.phone AS passenger_phone,
              u.student_staff_id,
              u.avatar AS passenger_avatar
            FROM bookings b
            JOIN users u
              ON b.passenger_id = u.id
            WHERE b.ride_id = ?
            ORDER BY
              b.created_at DESC
            `,
        )
        .all(rideId);

      for (const booking of bookings) {
        allBookings.push({
          ...booking,
          origin: ride?.origin || "",
          destination: ride?.destination || "",
          departure_date: ride?.departure_date || "",
          departure_time: ride?.departure_time || "",
          price_per_seat: ride?.price_per_seat || 0,
          vehicle_desc: ride?.vehicle_desc || "",
          available_seats: ride?.available_seats || 0,
        });
      }
    }

    allBookings.sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    );

    return res.status(200).json({
      bookings: allBookings,
    });
  } catch (error) {
    console.error("Get driver all bookings error:", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Failed to fetch driver booking requests.",
    });
  }
});

/*
 * =========================================================
 * 4. BOOKINGS FOR A SPECIFIC RIDE
 * =========================================================
 */

router.get("/ride/:rideId", authenticateToken, (req, res) => {
  try {
    ensureActiveUser(req.user.id);

    const rideId = parsePositiveInteger(req.params.rideId);

    if (!rideId) {
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

    if (ride.driver_id !== req.user.id && req.user.system_role !== "admin") {
      return res.status(403).json({
        error: "Unauthorized.",
      });
    }

    const bookings = db
      .prepare(
        `
          SELECT
            b.*,
            u.name AS passenger_name,
            u.email AS passenger_email,
            u.phone AS passenger_phone,
            u.student_staff_id,
            u.avatar AS passenger_avatar
          FROM bookings b
          JOIN users u
            ON b.passenger_id = u.id
          WHERE b.ride_id = ?
          ORDER BY
            b.created_at DESC
          `,
      )
      .all(rideId);

    return res.status(200).json({
      bookings,
    });
  } catch (error) {
    console.error("Get ride bookings error:", error);

    const status = error.statusCode || 500;

    return res.status(status).json({
      error: error.message || "Failed to fetch ride bookings.",
    });
  }
});

/*
 * =========================================================
 * 5. UPDATE BOOKING STATUS
 * =========================================================
 */

router.patch("/:id/status", authenticateToken, (req, res) => {
  try {
    const bookingId = parsePositiveInteger(req.params.id);

    if (!bookingId) {
      return res.status(400).json({
        error: "Invalid booking ID.",
      });
    }

    if (!isValidStatus(req.body.status)) {
      return res.status(400).json({
        error: "Invalid booking status.",
      });
    }

    ensureActiveUser(req.user.id);

    const result = updateBookingStatusTransaction({
      bookingId,
      newStatus: req.body.status,
      user: req.user,
    });

    /*
     * Socket notification
     */
    const io = req.app.get("io");

    if (io) {
      try {
        const booking = db
          .prepare(
            `
              SELECT *
              FROM bookings
              WHERE id = ?
              `,
          )
          .get(bookingId);

        const ride = db
          .prepare(
            `
              SELECT *
              FROM rides
              WHERE id = ?
              `,
          )
          .get(booking?.ride_id || null);

        const passenger = db
          .prepare(
            `
              SELECT
                name,
                avatar
              FROM users
              WHERE id = ?
              `,
          )
          .get(booking?.passenger_id || null);

        const statusPayload = {
          bookingId,
          id: bookingId,

          rideId: booking?.ride_id || null,

          ride_id: booking?.ride_id || null,

          passengerId: booking?.passenger_id || null,

          passenger_id: booking?.passenger_id || null,

          passengerName: passenger?.name || "",

          driverId: ride?.driver_id || null,

          driver_id: ride?.driver_id || null,

          seatsBooked: booking?.seats_booked || 0,

          seats_booked: booking?.seats_booked || 0,

          status: result.status,

          availableSeats: ride?.available_seats || 0,

          available_seats: ride?.available_seats || 0,

          origin: ride?.origin || "",

          destination: ride?.destination || "",
        };

        if (booking?.passenger_id) {
          io.to(`user-${booking.passenger_id}`).emit(
            "booking_status_updated",
            statusPayload,
          );
        }

        if (ride?.driver_id) {
          io.to(`user-${ride.driver_id}`).emit(
            "booking_status_updated",
            statusPayload,
          );
        }

        io.emit("booking_status_changed", statusPayload);
      } catch (notificationError) {
        console.error(
          "Socket status update notification error:",
          notificationError,
        );
      }
    }

    return res.status(200).json({
      message: `Booking status updated to ${result.status}`,
      status: result.status,
    });
  } catch (error) {
    console.error("Update booking status transaction error:", error);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      error: error.message || "Failed to update booking status.",
    });
  }
});

/*
 * =========================================================
 * 6. PASSENGER CANCEL BOOKING
 * =========================================================
 */

router.patch("/:id/cancel", authenticateToken, (req, res) => {
  try {
    const bookingId = parsePositiveInteger(req.params.id);

    if (!bookingId) {
      return res.status(400).json({
        error: "Invalid booking ID.",
      });
    }

    const user = ensureActiveUser(req.user.id);

    const booking = db
      .prepare(
        `
          SELECT *
          FROM bookings
          WHERE id = ?
          `,
      )
      .get(bookingId);

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
      });
    }

    if (booking.passenger_id !== user.id) {
      return res.status(403).json({
        error: "Not authorized.",
      });
    }

    /*
     * Cancellation window:
     * block cancellation within 2 hours.
     */
    const ride = db
      .prepare(
        `
          SELECT *
          FROM rides
          WHERE id = ?
          `,
      )
      .get(booking.ride_id);

    if (ride?.departure_date && ride?.departure_time) {
      const departure = new Date(
        `${ride.departure_date}T${ride.departure_time}`,
      );

      const now = new Date();

      const hoursUntilDeparture = (departure - now) / (1000 * 60 * 60);

      if (hoursUntilDeparture < 2 && hoursUntilDeparture > -1) {
        return res.status(400).json({
          error:
            "Cancellation window closed. You cannot cancel within 2 hours of departure. Contact the driver via Chat.",
          cancellationWindowClosed: true,
        });
      }
    }

    const result = updateBookingStatusTransaction({
      bookingId,
      newStatus: "cancelled",
      user,
    });

    const io = req.app.get("io");

    if (io && ride?.driver_id) {
      io.to(`user-${ride.driver_id}`).emit("booking_status_updated", {
        bookingId,
        rideId: ride.id,
        status: result.status,
      });
    }

    return res.status(200).json({
      message: "Booking cancelled successfully.",
    });
  } catch (error) {
    console.error("Booking cancellation error:", error);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      error: error.message || "Failed to cancel booking.",
    });
  }
});

/*
 * =========================================================
 * 7. CONFIRM PAYMENT
 * =========================================================
 */

router.patch("/:id/confirm-payment", authenticateToken, (req, res) => {
  try {
    const bookingId = parsePositiveInteger(req.params.id);

    if (!bookingId) {
      return res.status(400).json({
        error: "Invalid booking ID.",
      });
    }

    const user = ensureActiveUser(req.user.id);

    const booking = db
      .prepare(
        `
          SELECT *
          FROM bookings
          WHERE id = ?
          `,
      )
      .get(bookingId);

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
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
      .get(booking.ride_id);

    if (!ride) {
      return res.status(404).json({
        error: "Ride not found.",
      });
    }

    /*
     * Only driver/admin can confirm payment.
     */
    if (ride.driver_id !== user.id && user.system_role !== "admin") {
      return res.status(403).json({
        error: "Only the carpool driver can confirm payment.",
      });
    }

    /*
     * Only confirmed bookings can
     * become completed payments.
     */
    if (booking.status !== "confirmed") {
      return res.status(400).json({
        error: "Only confirmed bookings can be completed and paid.",
      });
    }

    /*
     * Prevent duplicate payment.
     */
    if (booking.payment_status === "paid") {
      return res.status(400).json({
        error: "Payment has already been confirmed for this booking.",
      });
    }

    const { paymentMethod = "Cash Payment", customAmount } = req.body || {};

    const normalizedPaymentMethod = String(paymentMethod).trim();

    if (!isValidPaymentMethod(normalizedPaymentMethod)) {
      return res.status(400).json({
        error: "Invalid payment method.",
      });
    }

    /*
     * Server-side amount calculation.
     *
     * The client cannot override the final fare.
     */
    const expectedTotal =
      Number(ride.price_per_seat || 0) * Number(booking.seats_booked || 0);

    /*
     * If frontend sends customAmount,
     * it must exactly match the server-calculated fare.
     */
    if (customAmount !== undefined) {
      const requestedAmount = Number(customAmount);

      if (
        !Number.isFinite(requestedAmount) ||
        requestedAmount < 0 ||
        requestedAmount !== expectedTotal
      ) {
        return res.status(400).json({
          error: "Payment amount does not match the booking fare.",
        });
      }
    }

    const completedAt = new Date().toISOString();

    db.prepare(
      `
        UPDATE bookings
        SET
          status = ?,
          payment_status = ?,
          payment_method = ?,
          paid_amount = ?,
          completed_at = ?
        WHERE id = ?
        `,
    ).run(
      "completed",
      "paid",
      normalizedPaymentMethod,
      expectedTotal,
      completedAt,
      bookingId,
    );

    const driver =
      db
        .prepare(
          `
          SELECT *
          FROM users
          WHERE id = ?
          `,
        )
        .get(ride.driver_id) || {};

    const driverVerification =
      db
        .prepare(
          `
            SELECT *
            FROM driver_verifications
            WHERE user_id = ?
            `,
        )
        .get(ride.driver_id) || {};

    const passenger =
      db
        .prepare(
          `
          SELECT *
          FROM users
          WHERE id = ?
          `,
        )
        .get(booking.passenger_id) || {};

    const receipt = {
      receiptNumber: `RR-REC-${new Date().getFullYear()}-${String(
        booking.id,
      ).padStart(6, "0")}`,

      bookingId: booking.id,

      bookingCode: booking.booking_code,

      rideId: ride.id,

      origin: ride.origin,

      destination: ride.destination,

      pickupLocation: booking.pickup_location,

      departureDate: ride.departure_date,

      departureTime: ride.departure_time,

      seatsBooked: booking.seats_booked,

      pricePerSeat: Number(ride.price_per_seat || 0),

      subtotal: expectedTotal,

      discount: 0,

      totalPaid: expectedTotal,

      paymentMethod: normalizedPaymentMethod,

      paymentStatus: "PAID",

      driverId: driver.id,

      driverName: driver.name,

      driverPhone: driver.phone,

      driverAvatar: driver.avatar,

      vehicleModel:
        driverVerification.vehicle_model ||
        ride.vehicle_desc ||
        "Campus Carpool",

      vehiclePlate: driverVerification.vehicle_plate || "CAMPUS-POOL",

      passengerId: passenger.id,

      passengerName: passenger.name,

      passengerEmail: passenger.email,

      passengerPhone: passenger.phone,

      studentStaffId: passenger.student_staff_id,

      completedAt,
    };

    const io = req.app.get("io");

    if (io) {
      const payload = {
        bookingId: booking.id,

        rideId: ride.id,

        status: "completed",

        paymentStatus: "paid",

        receipt,

        message: `Payment of LKR ${expectedTotal} has been confirmed and the ride completed.`,
      };

      io.to(`user-${booking.passenger_id}`).emit("payment_confirmed", payload);

      io.to(`user-${booking.passenger_id}`).emit(
        "booking_status_updated",
        payload,
      );

      io.to(`user-${ride.driver_id}`).emit("booking_status_updated", payload);

      io.emit("booking_status_changed", payload);
    }

    return res.status(200).json({
      message: "Payment confirmed & ride completed successfully!",
      bookingId: booking.id,
      status: "completed",
      receipt,
    });
  } catch (error) {
    console.error("Confirm payment error:", error);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      error: error.message || "Failed to confirm payment.",
    });
  }
});

/*
 * =========================================================
 * 8. GET DIGITAL RECEIPT
 * =========================================================
 */

router.get("/:id/receipt", authenticateToken, (req, res) => {
  try {
    const bookingId = parsePositiveInteger(req.params.id);

    if (!bookingId) {
      return res.status(400).json({
        error: "Invalid booking ID.",
      });
    }

    ensureActiveUser(req.user.id);

    const booking = db
      .prepare(
        `
          SELECT *
          FROM bookings
          WHERE id = ?
          `,
      )
      .get(bookingId);

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found.",
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
      .get(booking.ride_id);

    if (!ride) {
      return res.status(404).json({
        error: "Ride not found.",
      });
    }

    const isPassenger = booking.passenger_id === req.user.id;

    const isDriver = ride.driver_id === req.user.id;

    const isAdmin = req.user.system_role === "admin";

    if (!isPassenger && !isDriver && !isAdmin) {
      return res.status(403).json({
        error: "Not authorized to access this receipt.",
      });
    }

    const driver =
      db
        .prepare(
          `
          SELECT *
          FROM users
          WHERE id = ?
          `,
        )
        .get(ride.driver_id) || {};

    const driverVerification =
      db
        .prepare(
          `
            SELECT *
            FROM driver_verifications
            WHERE user_id = ?
            `,
        )
        .get(ride.driver_id) || {};

    const passenger =
      db
        .prepare(
          `
          SELECT *
          FROM users
          WHERE id = ?
          `,
        )
        .get(booking.passenger_id) || {};

    const serverCalculatedFare =
      Number(ride.price_per_seat || 0) * Number(booking.seats_booked || 0);

    const totalPaid = Number(booking.paid_amount || 0) || serverCalculatedFare;

    const receipt = {
      receiptNumber: `RR-REC-${new Date().getFullYear()}-${String(
        booking.id,
      ).padStart(6, "0")}`,

      bookingId: booking.id,

      bookingCode: booking.booking_code,

      rideId: ride.id,

      origin: ride.origin,

      destination: ride.destination,

      pickupLocation: booking.pickup_location,

      departureDate: ride.departure_date,

      departureTime: ride.departure_time,

      seatsBooked: booking.seats_booked,

      pricePerSeat: Number(ride.price_per_seat || 0),

      subtotal: totalPaid,

      discount: 0,

      totalPaid,

      paymentMethod: booking.payment_method || "Cash Payment",

      paymentStatus: (
        booking.payment_status ||
        (booking.status === "completed" ? "paid" : "pending")
      ).toUpperCase(),

      driverId: driver.id,

      driverName: driver.name,

      driverPhone: driver.phone,

      driverAvatar: driver.avatar,

      vehicleModel:
        driverVerification.vehicle_model ||
        ride.vehicle_desc ||
        "Campus Carpool",

      vehiclePlate: driverVerification.vehicle_plate || "CAMPUS-POOL",

      passengerId: passenger.id,

      passengerName: passenger.name,

      passengerEmail: passenger.email,

      passengerPhone: passenger.phone,

      studentStaffId: passenger.student_staff_id,

      completedAt: booking.completed_at || booking.created_at,
    };

    return res.status(200).json({
      receipt,
    });
  } catch (error) {
    console.error("Fetch receipt error:", error);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      error: error.message || "Failed to generate digital receipt.",
    });
  }
});

module.exports = router;
