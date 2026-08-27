require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

const db = require("./db");

const authRoutes = require("./routes/authRoutes");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const rideRoutes = require("./routes/rideRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminRoutes = require("./routes/adminRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const { JWT_SECRET, canAccessRideChat } = require("./auth");

const app = express();

app.disable("x-powered-by");

/* =========================================================
   CORS CONFIGURATION
   ========================================================= */

const allowedOrigins = (process.env.CLIENT_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients such as:
    // Postman, curl, automated tests, server-to-server requests.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization"],

  credentials: false,
};

/* =========================================================
   SECURITY HEADERS
   ========================================================= */

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

/* =========================================================
   GENERAL API RATE LIMIT
   ========================================================= */

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests, please try again later.",
  },
});

app.use("/api/", apiLimiter);

/* =========================================================
   HTTP SERVER
   ========================================================= */

const server = http.createServer(app);

/* =========================================================
   SOCKET.IO
   ========================================================= */

const io = new Server(server, {
  cors: corsOptions,
});

app.set("io", io);

/* =========================================================
   EXPRESS MIDDLEWARE
   ========================================================= */

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: "10mb",
  }),
);

/* =========================================================
   SERVE BUILT FRONTEND
   ========================================================= */

const publicDir = path.join(__dirname, "..", "public");

app.use(express.static(publicDir));

/* =========================================================
   REST API ROUTES
   ========================================================= */

app.use("/api/auth", authRoutes);

app.use("/api/admin/auth", adminAuthRoutes);

app.use("/api/verification", verificationRoutes);

app.use("/api/rides", rideRoutes);

app.use("/api/bookings", bookingRoutes);

app.use("/api/messages", chatRoutes);

app.use("/api/admin", adminRoutes);

app.use("/api/reviews", reviewRoutes);

app.use("/api/analytics", analyticsRoutes);

/* =========================================================
   OPENAPI JSON
   ========================================================= */

app.get("/api/openapi.json", (req, res) => {
  const specPath = path.join(__dirname, "..", "openapi.json");

  res.sendFile(specPath);
});

/* =========================================================
   INTERACTIVE API DOCUMENTATION
   ========================================================= */

app.get("/api/docs", (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        >

        <title>Ride Row — Interactive API Documentation</title>

        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap"
        >

        <script
          type="module"
          src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"
        ></script>

        <style>
          body {
            margin: 0;
            font-family: 'Inter', sans-serif;
          }

          rapi-doc {
            width: 100vw;
            height: 100vh;
          }
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
        >
        </rapi-doc>
      </body>
    </html>
  `);
});

/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    timestamp: new Date().toISOString(),
    service: "ICBT Campus Carpooling REST API",
  });
});

/*
 * =========================================================
 * API 404 HANDLER
 * =========================================================
 *
 * Any unknown /api/* endpoint must return a JSON 404.
 * It must not fall through to the frontend SPA.
 */
app.use("/api", (req, res) => {
  return res.status(404).json({
    error: "API endpoint not found.",
  });
});

/*
 * =========================================================
 * SPA FALLBACK
 * =========================================================
 *
 * Non-API browser routes are handled by the frontend.
 */
app.get("*", (req, res) => {
  const indexFile = path.join(publicDir, "index.html");

  res.sendFile(indexFile, (error) => {
    if (error) {
      console.error("SPA fallback error:", error);

      return res.status(500).send("Frontend application unavailable.");
    }
  });
});

/* =========================================================
   SOCKET.IO HANDSHAKE AUTHENTICATION
   ========================================================= */

io.use((socket, next) => {
  try {
    const authHeader =
      socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;

    // Anonymous socket connection is allowed.
    // Protected chat actions are checked later.
    if (!token) {
      socket.user = null;
      return next();
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err || !decoded) {
        socket.user = null;
        return next();
      }

      // Fetch a fresh user snapshot from the database.
      const user = db
        .prepare(
          `
          SELECT
            id,
            name,
            email,
            role,
            system_role,
            avatar
          FROM users
          WHERE id = ?
          `,
        )
        .get(decoded.id);

      socket.user = user || decoded;

      next();
    });
  } catch (err) {
    socket.user = null;
    next();
  }
});

/* =========================================================
   SOCKET.IO CONNECTION HANDLING
   ========================================================= */

io.on("connection", (socket) => {
  const authUser = socket.user;

  console.log(
    "⚡ Socket connected:",
    socket.id,
    authUser ? `(User: ${authUser.name} #${authUser.id})` : "(Anonymous)",
  );

  /* =======================================================
     PERSONAL NOTIFICATION ROOM
     ======================================================= */

  if (authUser && authUser.id) {
    socket.join(`user-${authUser.id}`);

    console.log(
      `👤 Socket ${socket.id} joined personal notification room user-${authUser.id}`,
    );
  }

  /* =======================================================
     JOIN RIDE CHAT ROOM
     ======================================================= */

  socket.on("join_ride_room", ({ rideId }) => {
    if (!socket.user) {
      socket.emit("chat_error", {
        message: "Authentication required. Please log in to join chat.",
      });

      return;
    }

    if (!canAccessRideChat(socket.user.id, rideId)) {
      console.warn(
        `⛔ Unauthorized room join attempt by user #${socket.user.id} for ride #${rideId}`,
      );

      socket.emit("chat_error", {
        message:
          "Access denied: Only the carpool driver and confirmed passengers can access this ride room.",
      });

      return;
    }

    socket.join(`ride-${rideId}`);

    console.log(
      `✓ User ${socket.user.name} (#${socket.user.id}) joined authorized room ride-${rideId}`,
    );

    socket.emit("room_joined", {
      rideId,
      status: "authorized",
    });
  });

  /* =======================================================
     LEAVE RIDE CHAT ROOM
     ======================================================= */

  socket.on("leave_ride_room", ({ rideId }) => {
    socket.leave(`ride-${rideId}`);
  });

  /* =======================================================
     SEND CHAT MESSAGE
     ======================================================= */

  socket.on("send_message", ({ rideId, text }) => {
    try {
      if (!socket.user) {
        socket.emit("chat_error", {
          message: "Authentication required to send messages.",
        });

        return;
      }

      if (!text || !text.trim()) {
        return;
      }

      if (!canAccessRideChat(socket.user.id, rideId)) {
        console.warn(
          `⛔ Unauthorized message post attempt by user #${socket.user.id} for ride #${rideId}`,
        );

        socket.emit("chat_error", {
          message:
            "Access denied: Only the carpool driver and confirmed passengers can send messages.",
        });

        return;
      }

      // Identity is always derived from the authenticated socket.
      const verifiedSenderId = socket.user.id;
      const verifiedSenderName = socket.user.name;
      const verifiedSenderAvatar = socket.user.avatar || "";
      const verifiedSenderRole = socket.user.role || "student";

      const result = db
        .prepare(
          `
          INSERT INTO messages (
            ride_id,
            sender_id,
            text
          )
          VALUES (?, ?, ?)
          `,
        )
        .run(rideId, verifiedSenderId, text.trim());

      const msg = {
        id: result.lastInsertRowid,
        ride_id: Number(rideId),
        sender_id: verifiedSenderId,
        sender_name: verifiedSenderName,
        sender_avatar: verifiedSenderAvatar,
        sender_role: verifiedSenderRole,
        text: text.trim(),
        created_at: new Date().toISOString(),
      };

      // Broadcast only to the authorized ride room.
      io.to(`ride-${rideId}`).emit("new_message", msg);
    } catch (err) {
      console.error("Socket message error:", err);

      socket.emit("chat_error", {
        message: "Failed to deliver message.",
      });
    }
  });

  /* =======================================================
     DISCONNECT
     ======================================================= */

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

/* =========================================================
   START SERVER
   ========================================================= */

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Carpool Server listening on port ${PORT}`);

    console.log(`📡 WebSocket server initialized`);

    console.log(
      `🌐 Allowed CORS origins: ${
        allowedOrigins.length ? allowedOrigins.join(", ") : "NONE"
      }`,
    );
  });
}

/* =========================================================
   EXPORTS
   ========================================================= */

module.exports = {
  app,
  server,
};
