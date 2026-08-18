const express = require('express');
const db = require('../db');
const { authenticateToken, canAccessRideChat } = require('../auth');

const router = express.Router();

// 1. Get Chat History for a Ride (Authorized for Driver & Confirmed Passengers)
router.get('/:rideId', authenticateToken, (req, res) => {
  try {
    const { rideId } = req.params;

    if (!canAccessRideChat(req.user.id, rideId)) {
      return res.status(403).json({
        error: 'Access denied. Only the carpool driver and confirmed passengers can view this chat.'
      });
    }

    const messages = db.prepare(`
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.ride_id = ?
      ORDER BY m.created_at ASC
    `).all(rideId);

    // Mark unread messages as read
    db.prepare(`
      UPDATE messages SET is_read = 1
      WHERE ride_id = ? AND sender_id != ?
    `).run(rideId, req.user.id);

    res.json({ messages });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// 2. Post New Message via REST (Authorized for Driver & Confirmed Passengers)
router.post('/', authenticateToken, (req, res) => {
  try {
    const { ride_id, text, receiver_id } = req.body;

    if (!ride_id || !text || !text.trim()) {
      return res.status(400).json({ error: 'Ride ID and text are required.' });
    }

    if (!canAccessRideChat(req.user.id, ride_id)) {
      return res.status(403).json({
        error: 'Access denied. Only the carpool driver and confirmed passengers can send messages.'
      });
    }

    const result = db.prepare(`
      INSERT INTO messages (ride_id, sender_id, receiver_id, text)
      VALUES (?, ?, ?, ?)
    `).run(ride_id, req.user.id, receiver_id || null, text.trim());

    const message = db.prepare(`
      SELECT m.*, u.name as sender_name, u.avatar as sender_avatar, u.role as sender_role
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    // Broadcast if io instance exists on req.app
    const io = req.app.get('io');
    if (io) {
      io.to(`ride-${ride_id}`).emit('new_message', message);
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

module.exports = router;
