require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const authRoutes = require('./routes/authRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const rideRoutes = require('./routes/rideRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', apiLimiter);

const server = http.createServer(app);

// Socket.io for Real-time chat & notifications
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve built frontend assets if present
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/messages', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/analytics', analyticsRoutes);


// Serve OpenAPI JSON Specification
app.get('/api/openapi.json', (req, res) => {
  const specPath = path.join(__dirname, '..', 'openapi.json');
  res.sendFile(specPath);
});

// Interactive API Documentation Web Page (Swagger-like via RapiDoc / Redoc)
app.get('/api/docs', (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
        <title>Ride Row — Interactive API Documentation</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap">
        <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
        <style>
          body { margin: 0; font-family: 'Inter', sans-serif; }
          rapi-doc { width: 100vw; height: 100vh; }
        </style>
      </head>
      <body>
        <rapi-doc
          spec-url="/api/openapi.json"
          theme="light"
          primary-color="#2563eb"
          bg-color="#ffffff"
          text-color="#0f172a"
          nav-bg-color="#0f172a"
          nav-text-color="#ffffff"
          nav-hover-bg-color="#1e293b"
          nav-accent-color="#3b82f6"
          show-header="true"
          heading-text="Ride Row API Reference"
          show-info="true"
          allow-try="true"
          render-style="read"
          schema-style="table"
        > </rapi-doc>
      </body>
    </html>
  `);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'ICBT Campus Carpooling REST API'
  });
});

// SPA fallback
app.get('*', (req, res) => {
  const indexFile = path.join(publicDir, 'index.html');
  res.sendFile(indexFile, (err) => {
    if (err) {
      res.status(200).send('ICBT Carpool REST API Online');
    }
  });
});

const jwt = require('jsonwebtoken');
const { JWT_SECRET, canAccessRideChat } = require('./auth');

// Socket.IO Handshake Authentication Middleware
io.use((socket, next) => {
  try {
    const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    if (!token) {
      socket.user = null;
      return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err || !decoded) {
        socket.user = null;
        return next();
      }

      // Fetch verified user snapshot from DB
      const user = db.prepare('SELECT id, name, email, role, system_role, avatar FROM users WHERE id = ?').get(decoded.id);
      socket.user = user || decoded;
      next();
    });
  } catch (err) {
    socket.user = null;
    next();
  }
});

// Real-time WebSocket connection handling
io.on('connection', (socket) => {
  const authUser = socket.user;
  console.log('⚡ Socket connected:', socket.id, authUser ? `(User: ${authUser.name} #${authUser.id})` : '(Anonymous)');

  if (authUser && authUser.id) {
    socket.join(`user-${authUser.id}`);
    console.log(`👤 Socket ${socket.id} joined personal notification room user-${authUser.id}`);
  }

  // Securely Join a specific ride chat room
  socket.on('join_ride_room', ({ rideId }) => {
    if (!socket.user) {
      socket.emit('chat_error', { message: 'Authentication required. Please log in to join chat.' });
      return;
    }

    if (!canAccessRideChat(socket.user.id, rideId)) {
      console.warn(`⛔ Unauthorized room join attempt by user #${socket.user.id} for ride #${rideId}`);
      socket.emit('chat_error', {
        message: 'Access denied: Only the carpool driver and confirmed passengers can access this ride room.'
      });
      return;
    }

    socket.join(`ride-${rideId}`);
    console.log(`✓ User ${socket.user.name} (#${socket.user.id}) joined authorized room ride-${rideId}`);
    socket.emit('room_joined', { rideId, status: 'authorized' });
  });

  // Leave room
  socket.on('leave_ride_room', ({ rideId }) => {
    socket.leave(`ride-${rideId}`);
  });

  // Handle instant chat message — Identity derived strictly from authenticated socket.user
  socket.on('send_message', ({ rideId, text }) => {
    try {
      if (!socket.user) {
        socket.emit('chat_error', { message: 'Authentication required to send messages.' });
        return;
      }

      if (!text || !text.trim()) return;

      if (!canAccessRideChat(socket.user.id, rideId)) {
        console.warn(`⛔ Unauthorized message post attempt by user #${socket.user.id} for ride #${rideId}`);
        socket.emit('chat_error', {
          message: 'Access denied: Only the carpool driver and confirmed passengers can send messages.'
        });
        return;
      }

      const verifiedSenderId = socket.user.id;
      const verifiedSenderName = socket.user.name;
      const verifiedSenderAvatar = socket.user.avatar || '';
      const verifiedSenderRole = socket.user.role || 'student';

      const result = db.prepare(`
        INSERT INTO messages (ride_id, sender_id, text)
        VALUES (?, ?, ?)
      `).run(rideId, verifiedSenderId, text.trim());

      const msg = {
        id: result.lastInsertRowid,
        ride_id: Number(rideId),
        sender_id: verifiedSenderId,
        sender_name: verifiedSenderName,
        sender_avatar: verifiedSenderAvatar,
        sender_role: verifiedSenderRole,
        text: text.trim(),
        created_at: new Date().toISOString()
      };

      // Broadcast verified message exclusively to authorized room
      io.to(`ride-${rideId}`).emit('new_message', msg);
    } catch (err) {
      console.error('Socket message error:', err);
      socket.emit('chat_error', { message: 'Failed to deliver message.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Carpool Server listening on port ${PORT}`);
    console.log(`📡 WebSocket server initialized`);
  });
}

module.exports = { app, server };
