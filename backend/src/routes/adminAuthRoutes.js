const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const db = require('../db');
const { generateToken } = require('../auth');

const router = express.Router();

/*
 * =========================================================
 * ADMIN LOGIN RATE LIMITER
 * =========================================================
 *
 * Maximum 5 login attempts from the same IP
 * within a 15-minute window.
 */
const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error:
      'Too many administrator login attempts. Please try again in 15 minutes.',
  },
});

/*
 * =========================================================
 * POST /api/admin/auth/login
 * =========================================================
 *
 * Dedicated administrator login endpoint.
 */
router.post('/login', adminAuthLimiter, (req, res) => {
  try {
    const { email, password } = req.body;

    /*
     * Basic input validation
     */
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: 'Administrator email and password are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    /*
     * Find account
     */
    const user = db
      .prepare(`
        SELECT
          id,
          name,
          email,
          password_hash,
          role,
          system_role,
          student_staff_id,
          phone,
          avatar,
          suspended,
          created_at
        FROM users
        WHERE LOWER(email) = ?
        LIMIT 1
      `)
      .get(normalizedEmail);

    /*
     * Generic response to avoid revealing
     * whether an account exists.
     */
    if (!user) {
      return res.status(401).json({
        error: 'Invalid administrator credentials.',
      });
    }

    /*
     * Suspended account check
     */
    if (user.suspended) {
      return res.status(403).json({
        error: 'This administrator account is suspended.',
      });
    }

    /*
     * Password verification
     */
    const validPassword = bcrypt.compareSync(
      password,
      user.password_hash,
    );

    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid administrator credentials.',
      });
    }

    /*
     * Critical authorization check
     */
    if (user.system_role !== 'admin') {
      return res.status(403).json({
        error: 'Administrator access required.',
      });
    }

    /*
     * Generate JWT using only required identity fields.
     */
    const token = generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      system_role: user.system_role,
    });

    /*
     * Remove password hash from response.
     */
    const {
      password_hash,
      ...safeUser
    } = user;

    return res.status(200).json({
      message: 'Administrator login successful.',
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Admin login error:', error);

    return res.status(500).json({
      error: 'Server error during administrator login.',
    });
  }
});

module.exports = router;