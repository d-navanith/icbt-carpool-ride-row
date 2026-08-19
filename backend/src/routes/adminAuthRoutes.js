const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const db = require('../db');
const { generateToken } = require('../auth');

const router = express.Router();

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many administrator login attempts. Try again in 15 minutes.'
  }
});

// Dedicated administrator login endpoint
router.post('/login', adminAuthLimiter, (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Administrator email and password are required.'
      });
    }

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE LOWER(email) = LOWER(?)
      `)
      .get(email.trim());

    // Do not reveal whether the account exists.
    if (!user) {
      return res.status(401).json({
        error: 'Invalid administrator credentials.'
      });
    }

    const validPassword = bcrypt.compareSync(
      password,
      user.password_hash
    );

    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid administrator credentials.'
      });
    }

    // Critical server-side authorization check.
    if (user.system_role !== 'admin') {
      return res.status(403).json({
        error: 'Administrator access required.'
      });
    }

    const token = generateToken(user);

    const {
      password_hash,
      ...safeUser
    } = user;

    res.json({
      message: 'Administrator login successful.',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Admin login error:', error);

    res.status(500).json({
      error: 'Server error during administrator login.'
    });
  }
});

module.exports = router;