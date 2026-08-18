require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is missing. Please configure JWT_SECRET in your .env file.');
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      system_role: user.system_role
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please login.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token.' });
    }
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.system_role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Administrator access required.' });
  }
}

function requireApprovedDriver(req, res, next) {
  const driverRecord = db.prepare('SELECT * FROM driver_verifications WHERE user_id = ?').get(req.user.id);
  if (!driverRecord || driverRecord.status !== 'approved') {
    return res.status(403).json({
      error: 'Driver verification required. You cannot offer rides until campus security/admin approves your vehicle and license documents.',
      driver_status: driverRecord ? driverRecord.status : 'unverified'
    });
  }
  req.driverInfo = driverRecord;
  next();
}

function canAccessRideChat(userId, rideId) {
  if (!userId || !rideId) return false;

  const user = db.prepare('SELECT id, system_role FROM users WHERE id = ?').get(userId);
  if (user && user.system_role === 'admin') return true;

  const ride = db.prepare('SELECT driver_id FROM rides WHERE id = ?').get(rideId);
  if (!ride) return false;

  // 1. Driver of this ride
  if (ride.driver_id === Number(userId)) return true;

  // 2. Accepted/Confirmed passenger of this ride
  const booking = db.prepare('SELECT id FROM bookings WHERE ride_id = ? AND passenger_id = ? AND status = ?').get(rideId, userId, 'confirmed');
  if (booking) return true;

  return false;
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
  requireAdmin,
  requireApprovedDriver,
  canAccessRideChat
};
