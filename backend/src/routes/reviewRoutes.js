const express = require("express");
const db = require("../db");
const { authenticateToken } = require("../auth");

const router = express.Router();

/*
 * =========================================================
 * VALIDATION HELPERS
 * =========================================================
 */

const parsePositiveInteger = (value) => {
  const number = Number(value);

  return Number.isInteger(number) && number > 0
    ? number
    : null;
};

const parseRating = (value) => {
  const rating = Number(value);

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return null;
  }

  return rating;
};

const normalizeComment = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  if (typeof value !== "string") {
    return null;
  }

  const comment = value.trim();

  if (comment.length > 1000) {
    return null;
  }

  return comment;
};

/*
 * =========================================================
 * ACTIVE USER CHECK
 * =========================================================
 */

const getActiveUser = (userId) => {
  const user = db
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

  if (!user) {
    const error = new Error(
      "User account not found.",
    );

    error.statusCode = 401;
    throw error;
  }

  if (user.suspended) {
    const error = new Error(
      "Your account has been suspended.",
    );

    error.statusCode = 403;
    throw error;
  }

  return user;
};

/*
 * =========================================================
 * HISTORICAL PASSENGER BOOKING LOOKUP
 * =========================================================
 *
 * We keep the booking history available so that a booking
 * which was later cancelled/rejected can still be identified
 * as a participant relationship for the ride.
 *
 * The review endpoint itself still prevents self-review,
 * validates the reviewee, validates the rating/comment and
 * blocks duplicate reviews.
 */

const findPassengerBooking = (
  rideId,
  passengerId,
) => {
  return db
    .prepare(
      `
      SELECT
        id,
        status,
        seats_booked,
        completed_at
      FROM bookings
      WHERE
        ride_id = ?
        AND passenger_id = ?
      ORDER BY
        CASE
          WHEN status = 'completed' THEN 1
          WHEN status = 'confirmed' THEN 2
          WHEN status = 'pending' THEN 3
          WHEN status = 'cancelled' THEN 4
          WHEN status = 'rejected' THEN 5
          ELSE 6
        END,
        id DESC
      LIMIT 1
      `,
    )
    .get(
      rideId,
      passengerId,
    );
};

/*
 * =========================================================
 * 1. SUBMIT RATING & REVIEW
 * =========================================================
 *
 * Security rules:
 *
 * - Authenticated users only.
 * - Suspended users are blocked.
 * - Ride must exist.
 * - Reviewer must be the ride driver or have a booking
 *   associated with the ride.
 * - Reviewee must be the ride driver or have a booking
 *   associated with the ride.
 * - Self-review is blocked.
 * - Rating must be 1-5.
 * - Comment maximum length is 1000 characters.
 * - Duplicate review for the same ride/reviewer/reviewee
 *   is blocked.
 */

router.post(
  "/",
  authenticateToken,
  (req, res) => {
    try {
      const reviewer =
        getActiveUser(
          req.user.id,
        );

      /*
       * -----------------------------------------------------
       * Parse request input
       * -----------------------------------------------------
       */

      const rideId =
        parsePositiveInteger(
          req.body.ride_id,
        );

      const revieweeId =
        parsePositiveInteger(
          req.body.reviewee_id,
        );

      const rating =
        parseRating(
          req.body.rating,
        );

      const comment =
        normalizeComment(
          req.body.comment,
        );

      /*
       * -----------------------------------------------------
       * Basic validation
       * -----------------------------------------------------
       */

      if (!rideId || !revieweeId) {
        return res.status(400).json({
          error:
            "Valid ride ID and reviewee ID are required.",
        });
      }

      if (!rating) {
        return res.status(400).json({
          error:
            "Rating must be between 1 and 5 stars.",
        });
      }

      if (comment === null) {
        return res.status(400).json({
          error:
            "Review comment must be a string with a maximum of 1000 characters.",
        });
      }

      /*
       * -----------------------------------------------------
       * Prevent self-review
       * -----------------------------------------------------
       */

      if (
        Number(reviewer.id) ===
        Number(revieweeId)
      ) {
        return res.status(400).json({
          error:
            "You cannot submit a review for yourself.",
        });
      }

      /*
       * -----------------------------------------------------
       * Find ride
       * -----------------------------------------------------
       */

      const ride = db
        .prepare(
          `
          SELECT
            id,
            driver_id,
            status
          FROM rides
          WHERE id = ?
          LIMIT 1
          `,
        )
        .get(rideId);

      if (!ride) {
        return res.status(404).json({
          error:
            "Ride not found.",
        });
      }

      /*
       * -----------------------------------------------------
       * Determine reviewer participation
       * -----------------------------------------------------
       */

      const isDriver =
        Number(ride.driver_id) ===
        Number(reviewer.id);

      const passengerBooking =
        findPassengerBooking(
          rideId,
          reviewer.id,
        );

      const isPassenger =
        Boolean(
          passengerBooking,
        );

      /*
       * Reviewer must belong to the ride.
       */
      if (
        !isDriver &&
        !isPassenger
      ) {
        return res.status(403).json({
          error:
            "Only the ride driver or a passenger who booked this ride can submit a review.",
        });
      }

      /*
       * -----------------------------------------------------
       * Verify reviewee participation
       * -----------------------------------------------------
       */

      const revieweeIsDriver =
        Number(ride.driver_id) ===
        Number(revieweeId);

      const revieweePassenger =
        findPassengerBooking(
          rideId,
          revieweeId,
        );

      const revieweeIsPassenger =
        Boolean(
          revieweePassenger,
        );

      if (
        !revieweeIsDriver &&
        !revieweeIsPassenger
      ) {
        return res.status(403).json({
          error:
            "The selected user did not participate in this ride.",
        });
      }

      /*
       * -----------------------------------------------------
       * Prevent duplicate review
       * -----------------------------------------------------
       */

      const duplicateReview =
        db
          .prepare(
            `
            SELECT
              id
            FROM reviews
            WHERE
              ride_id = ?
              AND reviewer_id = ?
              AND reviewee_id = ?
            LIMIT 1
            `,
          )
          .get(
            rideId,
            reviewer.id,
            revieweeId,
          );

      if (duplicateReview) {
        return res.status(409).json({
          error:
            "You have already reviewed this user for this ride.",
        });
      }

      /*
       * -----------------------------------------------------
       * Create review
       * -----------------------------------------------------
       */

      const result = db
        .prepare(
          `
          INSERT INTO reviews (
            ride_id,
            reviewer_id,
            reviewee_id,
            rating,
            comment
          )
          VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(
          rideId,
          reviewer.id,
          revieweeId,
          rating,
          comment,
        );

      return res.status(201).json({
        message:
          "Review submitted successfully!",
        reviewId:
          result.lastInsertRowid,
      });
    } catch (error) {
      console.error(
        "Review submit error:",
        error,
      );

      const statusCode =
        error.statusCode || 500;

      return res
        .status(statusCode)
        .json({
          error:
            error.message ||
            "Failed to submit review.",
        });
    }
  },
);

/*
 * =========================================================
 * 2. GET USER RATINGS & REVIEWS
 * =========================================================
 */

router.get(
  "/user/:userId",
  (req, res) => {
    try {
      const userId =
        parsePositiveInteger(
          req.params.userId,
        );

      if (!userId) {
        return res.status(400).json({
          error:
            "Invalid user ID.",
        });
      }

      /*
       * -----------------------------------------------------
       * Verify target user exists
       * -----------------------------------------------------
       */

      const user = db
        .prepare(
          `
          SELECT
            id,
            name,
            avatar,
            role
          FROM users
          WHERE id = ?
          LIMIT 1
          `,
        )
        .get(userId);

      if (!user) {
        return res.status(404).json({
          error:
            "User not found.",
        });
      }

      /*
       * -----------------------------------------------------
       * Aggregate rating statistics
       * -----------------------------------------------------
       */

      const stats = db
        .prepare(
          `
          SELECT
            AVG(rating) AS avg_rating,
            COUNT(*) AS review_count
          FROM reviews
          WHERE reviewee_id = ?
          `,
        )
        .get(userId);

      /*
       * -----------------------------------------------------
       * Fetch reviews
       * -----------------------------------------------------
       */

      const reviews = db
        .prepare(
          `
          SELECT
            r.id,
            r.ride_id,
            r.rating,
            r.comment,
            r.created_at,
            u.name AS reviewer_name,
            u.avatar AS reviewer_avatar,
            u.role AS reviewer_role
          FROM reviews r
          JOIN users u
            ON r.reviewer_id = u.id
          WHERE
            r.reviewee_id = ?
          ORDER BY
            r.created_at DESC
          `,
        )
        .all(userId);

      return res.status(200).json({
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          role: user.role,
        },

        avgRating:
          stats?.avg_rating !==
            null &&
          stats?.avg_rating !==
            undefined
            ? Number(
                Number(
                  stats.avg_rating,
                ).toFixed(2),
              )
            : 5.0,

        reviewCount:
          Number(
            stats?.review_count ||
              0,
          ),

        reviews:
          reviews || [],
      });
    } catch (error) {
      console.error(
        "Get reviews error:",
        error,
      );

      return res.status(500).json({
        error:
          "Failed to fetch user reviews.",
      });
    }
  },
);

module.exports = router;