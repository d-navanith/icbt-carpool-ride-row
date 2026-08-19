const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { generateToken, authenticateToken } = require("../auth");
const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
});

const router = express.Router();

// Register new student/staff user
router.post("/register", authLimiter, (req, res) => {
  try {
    const { name, email, password, role, student_staff_id, phone } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required." });
    }

    // Check existing
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email.toLowerCase());
    if (existing) {
      return res
        .status(400)
        .json({ error: "An account with this email address already exists." });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare(
        `
      INSERT INTO users (name, email, password_hash, role, system_role, student_staff_id, phone, avatar)
      VALUES (?, ?, ?, ?, 'user', ?, ?, ?)
    `,
      )
      .run(
        name,
        email.toLowerCase(),
        password_hash,
        role || "student",
        student_staff_id || "",
        phone || "",
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`,
      );

    const newUser = db
      .prepare(
        "SELECT id, name, email, role, system_role, student_staff_id, phone, avatar, created_at FROM users WHERE id = ?",
      )
      .get(result.lastInsertRowid);
    const token = generateToken(newUser);

    res.status(201).json({
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
    res.status(500).json({ error: "Server error during registration." });
  }
});

// Login
router.post("/login", authLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = db
      .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")
      .get(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const validPass = bcrypt.compareSync(password, user.password_hash);
    if (!validPass) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (user.system_role === "admin") {
      return res.status(403).json({
        error: "Administrator account detected. Please use the Admin Portal.",
      });
    }

    const driverVerification = db
      .prepare("SELECT * FROM driver_verifications WHERE user_id = ?")
      .get(user.id);
    const passengerVerification = db
      .prepare("SELECT * FROM passenger_verifications WHERE user_id = ?")
      .get(user.id);

    const token = generateToken(user);
    const { password_hash, ...safeUser } = user;

    res.json({
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
    res.status(500).json({ error: "Server error during login." });
  }
});

// Get Current Profile with latest verification info
router.get("/me", authenticateToken, (req, res) => {
  try {
    const user = db
      .prepare(
        "SELECT id, name, email, role, system_role, student_staff_id, phone, avatar, created_at FROM users WHERE id = ?",
      )
      .get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const driverVerification = db
      .prepare("SELECT * FROM driver_verifications WHERE user_id = ?")
      .get(user.id);
    const passengerVerification = db
      .prepare("SELECT * FROM passenger_verifications WHERE user_id = ?")
      .get(user.id);

    res.json({
      user: {
        ...user,
        driver_verification: driverVerification || null,
        passenger_verification: passengerVerification || null,
      },
    });
  } catch (error) {
    console.error("Auth /me error:", error);
    res.status(500).json({ error: "Server error fetching user profile." });
  }
});

// Update Profile — name, phone, student_staff_id, password
router.put("/profile", authenticateToken, (req, res) => {
  try {
    const { name, phone, student_staff_id, current_password, new_password } =
      req.body;

    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found." });

    // If changing password, verify current password first
    if (new_password) {
      if (!current_password) {
        return res
          .status(400)
          .json({
            error: "Current password is required to set a new password.",
          });
      }
      const valid = bcrypt.compareSync(current_password, user.password_hash);
      if (!valid) {
        return res
          .status(401)
          .json({ error: "Current password is incorrect." });
      }
      if (new_password.length < 6) {
        return res
          .status(400)
          .json({ error: "New password must be at least 6 characters." });
      }
    }

    const updatedName = (name || user.name).trim();
    const updatedPhone = phone !== undefined ? phone : user.phone;
    const updatedStudentStaffId =
      student_staff_id !== undefined ? student_staff_id : user.student_staff_id;
    const updatedHash = new_password
      ? bcrypt.hashSync(new_password, 10)
      : user.password_hash;

    db.prepare(
      `
      UPDATE users
      SET name = ?, phone = ?, student_staff_id = ?, password_hash = ?, avatar = ?
      WHERE id = ?
    `,
    ).run(
      updatedName,
      updatedPhone,
      updatedStudentStaffId,
      updatedHash,
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(updatedName)}`,
      req.user.id,
    );

    const updated = db
      .prepare(
        "SELECT id, name, email, role, system_role, student_staff_id, phone, avatar, created_at FROM users WHERE id = ?",
      )
      .get(req.user.id);

    const driverVerification = db
      .prepare("SELECT * FROM driver_verifications WHERE user_id = ?")
      .get(req.user.id);
    const passengerVerification = db
      .prepare("SELECT * FROM passenger_verifications WHERE user_id = ?")
      .get(req.user.id);

    res.json({
      message: "Profile updated successfully.",
      user: {
        ...updated,
        driver_verification: driverVerification || null,
        passenger_verification: passengerVerification || null,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Server error updating profile." });
  }
});

module.exports = router;
