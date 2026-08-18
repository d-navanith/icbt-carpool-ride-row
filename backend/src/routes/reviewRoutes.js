const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../auth');

const router = express.Router();

// 1. Submit Rating & Review for a ride participant
router.post('/', authenticateToken, (req, res) => {
  try {
    const { ride_id, reviewee_id, rating, comment } = req.body;

    if (!ride_id || !reviewee_id || !rating) {
      return res.status(400).json({ error: 'Ride ID, reviewee ID, and numerical rating (1-5) are required.' });
    }

    const numRating = parseInt(rating, 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5 stars.' });
    }

    const result = db.prepare(`
      INSERT INTO reviews (ride_id, reviewer_id, reviewee_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)
    `).run(ride_id, req.user.id, reviewee_id, numRating, comment || '');

    res.status(201).json({
      message: 'Review submitted successfully!',
      reviewId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Review submit error:', error);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// 2. Get User Ratings and Reviews
router.get('/user/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const stats = db.prepare(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM reviews WHERE reviewee_id = ?
    `).get(userId);

    const reviews = db.prepare(`
      SELECT r.*, u.name as reviewer_name, u.avatar as reviewer_avatar, u.role as reviewer_role
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.id
      WHERE r.reviewee_id = ?
      ORDER BY r.created_at DESC
    `).all(userId);

    res.json({
      avgRating: stats ? stats.avg_rating || 5.0 : 5.0,
      reviewCount: stats ? stats.review_count || 0 : 0,
      reviews: reviews || []
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch user reviews.' });
  }
});

module.exports = router;
