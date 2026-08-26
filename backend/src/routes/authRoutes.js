const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");

const db = require("../db");
const { generateToken, authenticateToken } = require("../auth");

const router = express.Router();

/*
 * =========================================================
 * RATE LIMITERS
 * =========================================================
 *
 * Login:
 * 10 attempts per IP / 15 minutes
 *
 * Registration:
 * 5 attempts per IP / 15 minutes
 */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts. Please try again later.",
  },
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many registration attempts. Please try again later.",
  },
});

/*
 * =========================================================
 * VALIDATION HELPERS
 * =========================================================
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALLOWED_USER_ROLES = ["student", "staff"];

/*
 * =========================================================
 * POST /api/auth/register
 * =========================================================
 */

const registerLimiterForEnvironment = (req, res, next) => {
  if (process.env.NODE_ENV === "test") {
    return next();
  }

  return registerLimiter(req, res, next);
};

router.post("/register", registerLimiterForEnvironment, (req, res) => {
  try {
    const { name, email, password, role, student_staff_id, phone } = req.body;

    /*
     * Basic validation
     */
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        error: "Name, email, and password are required.",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !password) {
      return res.status(400).json({
        error: "Name, email, and password are required.",
      });
    }

    /*
     * Name validation
     */
    if (normalizedName.length < 2) {
      return res.status(400).json({
        error: "Name must contain at least 2 characters.",
      });
    }

    if (normalizedName.length > 100) {
      return res.status(400).json({
        error: "Name must not exceed 100 characters.",
      });
    }

    /*
     * Email validation
     */
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        error: "Please provide a valid email address.",
      });
    }

    if (normalizedEmail.length > 150) {
      return res.status(400).json({
        error: "Email address is too long.",
      });
    }

    /*
     * Password validation
     */
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters.",
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        error: "Password must not exceed 128 characters.",
      });
    }

    /*
     * Only approved application roles can be
     * selected during registration.
     */
    const selectedRole = role || "student";

    if (!ALLOWED_USER_ROLES.includes(selectedRole)) {
      return res.status(400).json({
        error:
          "Invalid account role. Only student or staff accounts are allowed.",
      });
    }

    /*
     * Check duplicate account
     *
     * Parameterized query prevents SQL injection.
     */
    const existingUser = db
      .prepare(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = ?
        LIMIT 1
        `,
      )
      .get(normalizedEmail);

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email address already exists.",
      });
    }

    /*
     * Hash password
     */
    const passwordHash = bcrypt.hashSync(password, 10);

    /*
     * Create avatar safely from the user name.
     */
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
      normalizedName,
    )}`;

    /*
     * Insert user.
     *
     * system_role is ALWAYS "user".
     * The client cannot create an administrator.
     */
    const result = db
      .prepare(
        `
        INSERT INTO users (
          name,
          email,
          password_hash,
          role,
          system_role,
          student_staff_id,
          phone,
          avatar
        )
        VALUES (?, ?, ?, ?, 'user', ?, ?, ?)
        `,
      )
      .run(
        normalizedName,
        normalizedEmail,
        passwordHash,
        selectedRole,
        typeof student_staff_id === "string" ? student_staff_id.trim() : "",
        typeof phone === "string" ? phone.trim() : "",
        avatarUrl,
      );

    /*
     * Fetch safe user representation.
     */
    const newUser = db
      .prepare(
        `
          SELECT
            id,
            name,
            email,
            role,
            system_role,
            student_staff_id,
            phone,
            avatar,
            created_at
          FROM users
          WHERE id = ?
        `,
      )
      .get(result.lastInsertRowid);

    /*
     * Generate JWT using only safe identity fields.
     */
    const token = generateToken({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      system_role: newUser.system_role,
    });

    return res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        ...newUser,
        driver_verification: null,
        passenger_verification: null,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      error: "Server error during registration.",
    });
  }
});

/*
 * =========================================================
 * POST /api/auth/login
 * =========================================================
 */

router.post("/login", loginLimiter, (req, res) => {
  try {
    const { email, password } = req.body;

    /*
     * Basic validation
     */
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Email and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        error: "Please provide a valid email address.",
      });
    }

    /*
     * Find user
     */
    const user = db
      .prepare(
        `
        SELECT *
        FROM users
        WHERE LOWER(email) = ?
        LIMIT 1
        `,
      )
      .get(normalizedEmail);

    /*
     * Generic response prevents unnecessary
     * account enumeration.
     */
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    /*
     * Verify password before revealing
     * account-specific authorization information.
     */
    const validPassword = bcrypt.compareSync(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid email or password.",
      });
    }

    /*
     * Administrator accounts must use
     * the dedicated Admin Portal.
     */
    if (user.system_role === "admin") {
      return res.status(403).json({
        error: "Administrator account detected. Please use the Admin Portal.",
      });
    }

    /*
     * Latest verification information
     */
    const driverVerification = db
      .prepare(
        `
        SELECT *
        FROM driver_verifications
        WHERE user_id = ?
        `,
      )
      .get(user.id);

    const passengerVerification = db
      .prepare(
        `
        SELECT *
        FROM passenger_verifications
        WHERE user_id = ?
        `,
      )
      .get(user.id);

    /*
     * Never send password_hash to client.
     */
    const { password_hash, ...safeUser } = user;

    /*
     * Safe JWT payload
     */
    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      system_role: user.system_role,
    });

    return res.status(200).json({
      message: "Logged in successfully",
      token,
      user: {
        ...safeUser,
        driver_verification: driverVerification || null,
        passenger_verification: passengerVerification || null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Server error during login.",
    });
  }
});

/*
 * =========================================================
 * GET /api/auth/me
 * =========================================================
 */

router.get("/me", authenticateToken, (req, res) => {
  try {
    const user = db
      .prepare(
        `
          SELECT
            id,
            name,
            email,
            role,
            system_role,
            student_staff_id,
            phone,
            avatar,
            created_at,
            suspended
          FROM users
          WHERE id = ?
          `,
      )
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    if (user.suspended) {
      return res.status(403).json({
        error: "Your account has been suspended.",
      });
    }

    const driverVerification = db
      .prepare(
        `
          SELECT *
          FROM driver_verifications
          WHERE user_id = ?
          `,
      )
      .get(user.id);

    const passengerVerification = db
      .prepare(
        `
          SELECT *
          FROM passenger_verifications
          WHERE user_id = ?
          `,
      )
      .get(user.id);

    return res.status(200).json({
      user: {
        ...user,
        driver_verification: driverVerification || null,
        passenger_verification: passengerVerification || null,
      },
    });
  } catch (error) {
    console.error("Auth /me error:", error);

    return res.status(500).json({
      error: "Server error fetching user profile.",
    });
  }
});

/*
 * =========================================================
 * PUT /api/auth/profile
 * =========================================================
 */

router.put("/profile", authenticateToken, (req, res) => {
  try {
    const { name, phone, student_staff_id, current_password, new_password } =
      req.body;

    const user = db
      .prepare(
        `
          SELECT *
          FROM users
          WHERE id = ?
          `,
      )
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    if (user.suspended) {
      return res.status(403).json({
        error: "Your account has been suspended.",
      });
    }

    /*
     * Name validation
     */
    if (name !== undefined) {
      if (typeof name !== "string") {
        return res.status(400).json({
          error: "Name must be a string.",
        });
      }

      if (name.trim().length < 2 || name.trim().length > 100) {
        return res.status(400).json({
          error: "Name must contain between 2 and 100 characters.",
        });
      }
    }

    /*
     * Password update
     */
    if (new_password !== undefined) {
      if (typeof new_password !== "string" || !new_password) {
        return res.status(400).json({
          error: "New password must be provided.",
        });
      }

      if (!current_password) {
        return res.status(400).json({
          error: "Current password is required to set a new password.",
        });
      }

      const validCurrentPassword = bcrypt.compareSync(
        current_password,
        user.password_hash,
      );

      if (!validCurrentPassword) {
        return res.status(401).json({
          error: "Current password is incorrect.",
        });
      }

      if (new_password.length < 6) {
        return res.status(400).json({
          error: "New password must be at least 6 characters.",
        });
      }

      if (new_password.length > 128) {
        return res.status(400).json({
          error: "New password must not exceed 128 characters.",
        });
      }
    }

    const updatedName = name !== undefined ? name.trim() : user.name;

    const updatedPhone =
      phone !== undefined ? String(phone).trim() : user.phone;

    const updatedStudentStaffId =
      student_staff_id !== undefined
        ? String(student_staff_id).trim()
        : user.student_staff_id;

    const updatedHash = new_password
      ? bcrypt.hashSync(new_password, 10)
      : user.password_hash;

    const updatedAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
      updatedName,
    )}`;

    /*
     * Update only the authenticated user's record.
     */
    db.prepare(
      `
        UPDATE users
        SET
          name = ?,
          phone = ?,
          student_staff_id = ?,
          password_hash = ?,
          avatar = ?
        WHERE id = ?
        `,
    ).run(
      updatedName,
      updatedPhone,
      updatedStudentStaffId,
      updatedHash,
      updatedAvatar,
      req.user.id,
    );

    /*
     * Fetch updated safe profile
     */
    const updated = db
      .prepare(
        `
          SELECT
            id,
            name,
            email,
            role,
            system_role,
            student_staff_id,
            phone,
            avatar,
            created_at
          FROM users
          WHERE id = ?
          `,
      )
      .get(req.user.id);

    const driverVerification = db
      .prepare(
        `
          SELECT *
          FROM driver_verifications
          WHERE user_id = ?
          `,
      )
      .get(req.user.id);

    const passengerVerification = db
      .prepare(
        `
          SELECT *
          FROM passenger_verifications
          WHERE user_id = ?
          `,
      )
      .get(req.user.id);

    return res.status(200).json({
      message: "Profile updated successfully.",
      user: {
        ...updated,
        driver_verification: driverVerification || null,
        passenger_verification: passengerVerification || null,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return res.status(500).json({
      error: "Server error updating profile.",
    });
  }
});

module.exports = router;
