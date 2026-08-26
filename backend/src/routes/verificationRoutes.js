const express = require("express");
const db = require("../db");
const { authenticateToken } = require("../auth");

const router = express.Router();

/*
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const ALLOWED_FUEL_TYPES = ["Petrol", "Diesel", "Hybrid", "Electric"];

const ALLOWED_DRIVER_STATUSES = ["pending", "approved", "rejected"];

const MAX_LICENSE_LENGTH = 100;
const MAX_VEHICLE_MODEL_LENGTH = 100;
const MAX_VEHICLE_PLATE_LENGTH = 30;
const MAX_DOCUMENT_URL_LENGTH = 1000;
const MAX_ID_LENGTH = 100;

/*
 * =========================================================
 * VALIDATION HELPERS
 * =========================================================
 */

const isNonEmptyString = (value, maxLength) => {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
};

const isValidUrlOrEmpty = (value) => {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  if (typeof value !== "string" || value.length > MAX_DOCUMENT_URL_LENGTH) {
    return false;
  }

  try {
    const parsed = new URL(value);

    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isValidSeatCount = (value) => {
  const seats = Number(value);

  return Number.isInteger(seats) && seats >= 1 && seats <= 12;
};

/*
 * Determine Odd/Even from the vehicle plate.
 *
 * Example:
 * WP-CAB-4521 -> 1 -> ODD
 */
function calculateOddEven(plate) {
  if (!plate) {
    return "ODD";
  }

  const numbers = String(plate).replace(/\D/g, "");

  if (!numbers) {
    return "ODD";
  }

  const lastDigit = parseInt(numbers.slice(-1), 10);

  return lastDigit % 2 === 0 ? "EVEN" : "ODD";
}

/*
 * =========================================================
 * 1. SUBMIT / UPDATE DRIVER VERIFICATION
 * =========================================================
 */

router.post("/driver", authenticateToken, (req, res) => {
  try {
    const user = req.user;

    const {
      license_number,
      vehicle_model,
      vehicle_plate,
      seats,
      fuel_type,
      license_doc_url,
      vehicle_photo_url,
    } = req.body;

    /*
     * -----------------------------------------------------
     * Required field validation
     * -----------------------------------------------------
     */

    if (
      !isNonEmptyString(license_number, MAX_LICENSE_LENGTH) ||
      !isNonEmptyString(vehicle_model, MAX_VEHICLE_MODEL_LENGTH) ||
      !isNonEmptyString(vehicle_plate, MAX_VEHICLE_PLATE_LENGTH)
    ) {
      return res.status(400).json({
        error:
          "Valid license number, vehicle model, and vehicle plate number are required.",
      });
    }

    /*
     * -----------------------------------------------------
     * Seat validation
     * -----------------------------------------------------
     */

    const requestedSeats =
      seats === undefined || seats === null || seats === "" ? 3 : Number(seats);

    if (!isValidSeatCount(requestedSeats)) {
      return res.status(400).json({
        error: "Vehicle seat count must be between 1 and 12.",
      });
    }

    /*
     * -----------------------------------------------------
     * Fuel type validation
     * -----------------------------------------------------
     */

    const normalizedFuelType = fuel_type || "Petrol";

    if (typeof normalizedFuelType !== "string") {
      return res.status(400).json({
        error: "Invalid fuel type.",
      });
    }

    const normalizedFuelTypeValue = normalizedFuelType.trim().toLowerCase();

    const matchedFuelType = ALLOWED_FUEL_TYPES.find(
      (fuelType) => fuelType.toLowerCase() === normalizedFuelTypeValue,
    );

    if (!matchedFuelType) {
      return res.status(400).json({
        error: "Invalid fuel type.",
      });
    }

    /*
     * -----------------------------------------------------
     * URL validation
     * -----------------------------------------------------
     */

    if (
      !isValidUrlOrEmpty(license_doc_url) ||
      !isValidUrlOrEmpty(vehicle_photo_url)
    ) {
      return res.status(400).json({
        error:
          "License and vehicle document URLs must be valid HTTP/HTTPS URLs.",
      });
    }

    /*
     * -----------------------------------------------------
     * Normalize vehicle fields
     * -----------------------------------------------------
     */

    const normalizedLicenseNumber = license_number.trim();

    const normalizedVehicleModel = vehicle_model.trim();

    const normalizedVehiclePlate = vehicle_plate.trim().toUpperCase();

    /*
     * -----------------------------------------------------
     * Calculate Odd/Even server-side
     * -----------------------------------------------------
     */

    const calculatedOddEven = calculateOddEven(normalizedVehiclePlate);

    /*
     * -----------------------------------------------------
     * Existing verification
     * -----------------------------------------------------
     */

    const existing = db
      .prepare(
        `
          SELECT *
          FROM driver_verifications
          WHERE user_id = ?
          LIMIT 1
          `,
      )
      .get(user.id);

    const defaultLicenseDoc =
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80";

    const defaultVehiclePhoto =
      "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&auto=format&fit=crop&q=80";

    const safeLicenseDoc = license_doc_url?.trim() || defaultLicenseDoc;

    const safeVehiclePhoto = vehicle_photo_url?.trim() || defaultVehiclePhoto;

    /*
     * -----------------------------------------------------
     * UPDATE EXISTING APPLICATION
     * -----------------------------------------------------
     */

    if (existing) {
      db.prepare(
        `
          UPDATE driver_verifications
          SET
            license_number = ?,
            vehicle_model = ?,
            vehicle_plate = ?,
            odd_even_type = ?,
            seats = ?,
            fuel_type = ?,
            license_doc_url = ?,
            vehicle_photo_url = ?,
            status = 'pending',
            admin_comment = ?,
            submitted_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
          `,
      ).run(
        normalizedLicenseNumber,
        normalizedVehicleModel,
        normalizedVehiclePlate,
        calculatedOddEven,
        requestedSeats,
        normalizedFuelType,
        safeLicenseDoc,
        safeVehiclePhoto,
        "Updated credentials submitted for review",
        user.id,
      );
    } else {
      /*
       * ---------------------------------------------------
       * CREATE NEW APPLICATION
       * ---------------------------------------------------
       */

      db.prepare(
        `
          INSERT INTO driver_verifications (
            user_id,
            license_number,
            vehicle_model,
            vehicle_plate,
            odd_even_type,
            seats,
            fuel_type,
            license_doc_url,
            vehicle_photo_url,
            status,
            admin_comment
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'pending',
            ?
          )
          `,
      ).run(
        user.id,
        normalizedLicenseNumber,
        normalizedVehicleModel,
        normalizedVehiclePlate,
        calculatedOddEven,
        requestedSeats,
        normalizedFuelType,
        safeLicenseDoc,
        safeVehiclePhoto,
        "Awaiting campus admin verification",
      );
    }

    /*
     * -----------------------------------------------------
     * Fetch updated verification
     * -----------------------------------------------------
     */

    const updated = db
      .prepare(
        `
          SELECT
            id,
            user_id,
            license_number,
            vehicle_model,
            vehicle_plate,
            odd_even_type,
            seats,
            fuel_type,
            license_doc_url,
            vehicle_photo_url,
            status,
            admin_comment,
            submitted_at,
            reviewed_at
          FROM driver_verifications
          WHERE user_id = ?
          LIMIT 1
          `,
      )
      .get(user.id);

    return res.status(200).json({
      message:
        "Driver verification documents submitted successfully. Please wait for Admin approval.",
      driver_verification: updated,
    });
  } catch (error) {
    console.error("Driver verification error:", error);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      error:
        error.message || "Server error while submitting driver verification.",
    });
  }
});

/*
 * =========================================================
 * 2. GET DRIVER VERIFICATION STATUS
 * =========================================================
 */

router.get("/driver/status", authenticateToken, (req, res) => {
  try {
    const user = req.user;

    const record = db
      .prepare(
        `
          SELECT
            id,
            user_id,
            license_number,
            vehicle_model,
            vehicle_plate,
            odd_even_type,
            seats,
            fuel_type,
            license_doc_url,
            vehicle_photo_url,
            status,
            admin_comment,
            submitted_at,
            reviewed_at
          FROM driver_verifications
          WHERE user_id = ?
          LIMIT 1
          `,
      )
      .get(user.id);

    return res.status(200).json({
      verified: record?.status === "approved",

      status: record ? record.status : "unverified",

      details: record || null,
    });
  } catch (error) {
    console.error("Driver verification status error:", error);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      error: error.message || "Failed to fetch verification status.",
    });
  }
});

/*
 * =========================================================
 * 3. SUBMIT PASSENGER VERIFICATION
 * =========================================================
 */

router.post("/passenger", authenticateToken, (req, res) => {
  try {
    const user = req.user;

    const { id_card_number, id_doc_url } = req.body;

    /*
     * -----------------------------------------------------
     * ID validation
     * -----------------------------------------------------
     */

    if (!isNonEmptyString(id_card_number, MAX_ID_LENGTH)) {
      return res.status(400).json({
        error: "Valid Student/Staff ID card number is required.",
      });
    }

    /*
     * -----------------------------------------------------
     * Document URL validation
     * -----------------------------------------------------
     */

    if (!isValidUrlOrEmpty(id_doc_url)) {
      return res.status(400).json({
        error: "ID document URL must be a valid HTTP/HTTPS URL.",
      });
    }

    const normalizedId = id_card_number.trim();

    const normalizedDocUrl = id_doc_url?.trim() || "";

    /*
     * -----------------------------------------------------
     * Existing verification
     * -----------------------------------------------------
     */

    const existing = db
      .prepare(
        `
          SELECT *
          FROM passenger_verifications
          WHERE user_id = ?
          LIMIT 1
          `,
      )
      .get(user.id);

    if (existing) {
      /*
       * IMPORTANT:
       *
       * Do not trust the client to determine
       * verification status.
       *
       * The current system has no actual external
       * campus-registry lookup in this route, so an
       * application should not claim external verification
       * unless such a registry check exists.
       */
      db.prepare(
        `
          UPDATE passenger_verifications
          SET
            id_card_number = ?,
            id_doc_url = ?,
            status = 'approved',
            admin_comment = ?,
            reviewed_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
          `,
      ).run(
        normalizedId,
        normalizedDocUrl,
        "Auto-verified with campus registry",
        user.id,
      );
    } else {
      db.prepare(
        `
          INSERT INTO passenger_verifications (
            user_id,
            id_card_number,
            id_doc_url,
            status,
            admin_comment,
            submitted_at,
            reviewed_at
          )
          VALUES (
            ?,
            ?,
            ?,
            'approved',
            ?,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          `,
      ).run(
        user.id,
        normalizedId,
        normalizedDocUrl,
        "Auto-verified with campus registry",
      );
    }

    const updated = db
      .prepare(
        `
          SELECT
            id,
            user_id,
            id_card_number,
            id_doc_url,
            status,
            admin_comment,
            submitted_at,
            reviewed_at
          FROM passenger_verifications
          WHERE user_id = ?
          LIMIT 1
          `,
      )
      .get(user.id);

    return res.status(200).json({
      message: "Passenger verified successfully.",
      passenger_verification: updated,
    });
  } catch (error) {
    console.error("Passenger verification error:", error);

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      error: error.message || "Failed to submit passenger verification.",
    });
  }
});

module.exports = router;
