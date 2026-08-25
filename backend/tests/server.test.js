const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { io: ioClient } = require("socket.io-client");

const { app, server } = require("../src/server");

describe("Server & Socket.IO Tests", () => {
  let driverToken;
  let passengerToken;

  let socketBaseUrl;
  let startedServer = false;

  before(async () => {
    const driverLogin = await request(app).post("/api/auth/login").send({
      email: "kamal.driver@icbt.edu.lk",
      password: "driver123",
    });

    assert.equal(
      driverLogin.status,
      200,
      `Driver login failed: ${JSON.stringify(driverLogin.body)}`,
    );

    assert.ok(driverLogin.body.token);

    driverToken = driverLogin.body.token;

    const passengerLogin = await request(app).post("/api/auth/login").send({
      email: "nimal.student@icbt.edu.lk",
      password: "student123",
    });

    assert.equal(
      passengerLogin.status,
      200,
      `Passenger login failed: ${JSON.stringify(passengerLogin.body)}`,
    );

    assert.ok(passengerLogin.body.token);

    passengerToken = passengerLogin.body.token;

    if (!server.listening) {
      await new Promise((resolve, reject) => {
        server.listen(0, "127.0.0.1", (error) => {
          if (error) {
            reject(error);
          } else {
            startedServer = true;
            resolve();
          }
        });
      });
    }

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Unable to determine test server address.");
    }

    socketBaseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (startedServer && server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
  });

  // =========================================================
  // HTTP SERVER
  // =========================================================

  it("Health endpoint returns online status", async () => {
    const res = await request(app).get("/api/health");

    assert.equal(res.status, 200);

    assert.equal(res.body.status, "online");

    assert.equal(res.body.service, "ICBT Campus Carpooling REST API");

    assert.ok(res.body.timestamp);
  });

  it("OpenAPI endpoint returns the API specification", async () => {
    const res = await request(app).get("/api/openapi.json");

    assert.equal(res.status, 200);

    assert.ok(res.body);
    assert.equal(res.body.openapi, "3.0.3");
  });

  it("Interactive API documentation page is served", async () => {
    const res = await request(app).get("/api/docs");

    assert.equal(res.status, 200);

    assert.match(res.text, /Ride Row API Reference/i);

    assert.match(res.text, /\/api\/openapi\.json/i);
  });

  it("Disables the Express x-powered-by header", async () => {
    const res = await request(app).get("/api/health");

    assert.equal(res.status, 200);

    assert.equal(res.headers["x-powered-by"], undefined);
  });

  it("Allows requests without an Origin header", async () => {
    const res = await request(app).get("/api/health");

    assert.equal(res.status, 200);
  });

  it("Allows the configured frontend origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:3000");

    assert.equal(res.status, 200);

    assert.equal(
      res.headers["access-control-allow-origin"],
      "http://localhost:3000",
    );
  });

  it("Rejects an unconfigured CORS origin", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://malicious.example");

    assert.equal(res.status, 500);
  });

  // =========================================================
  // SOCKET.IO HELPERS
  // =========================================================

  function createSocket(options = {}) {
    return ioClient(socketBaseUrl, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 3000,
      ...options,
    });
  }

  function closeSocket(socket) {
    return new Promise((resolve) => {
      if (!socket || !socket.connected) {
        socket?.close();
        resolve();
        return;
      }

      socket.once("disconnect", () => resolve());

      socket.close();
    });
  }

  function waitForConnection(socket) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Socket connection timed out."));
      }, 5000);

      socket.once("connect", () => {
        clearTimeout(timer);
        resolve();
      });

      socket.once("connect_error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function waitForEvent(socket, event, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for "${event}".`));
      }, timeout);

      socket.once(event, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  // =========================================================
  // SOCKET.IO CONNECTION
  // =========================================================

  it("Allows an anonymous Socket.IO connection", async () => {
    const socket = createSocket();

    try {
      await waitForConnection(socket);

      assert.equal(socket.connected, true);
    } finally {
      await closeSocket(socket);
    }
  });

  it("Allows a Socket.IO connection with a valid Bearer token", async () => {
    const socket = createSocket({
      auth: {
        token: `Bearer ${driverToken}`,
      },
    });

    try {
      await waitForConnection(socket);

      assert.equal(socket.connected, true);
    } finally {
      await closeSocket(socket);
    }
  });

  it("Allows a Socket.IO connection with a raw JWT token", async () => {
    const socket = createSocket({
      auth: {
        token: driverToken,
      },
    });

    try {
      await waitForConnection(socket);

      assert.equal(socket.connected, true);
    } finally {
      await closeSocket(socket);
    }
  });

  it("Allows a Socket.IO connection with an invalid token", async () => {
    const socket = createSocket({
      auth: {
        token: "invalid-token",
      },
    });

    try {
      await waitForConnection(socket);

      assert.equal(socket.connected, true);
    } finally {
      await closeSocket(socket);
    }
  });

  // =========================================================
  // RIDE ROOM AUTHORIZATION
  // =========================================================

  it("Rejects anonymous users from joining a ride room", async () => {
    const socket = createSocket();

    try {
      await waitForConnection(socket);

      const chatErrorPromise = waitForEvent(socket, "chat_error");

      socket.emit("join_ride_room", {
        rideId: 999999,
      });

      const error = await chatErrorPromise;

      assert.equal(
        error.message,
        "Authentication required. Please log in to join chat.",
      );
    } finally {
      await closeSocket(socket);
    }
  });

  it("Rejects unauthorized users from joining a ride room", async () => {
    const socket = createSocket({
      auth: {
        token: `Bearer ${passengerToken}`,
      },
    });

    try {
      await waitForConnection(socket);

      const chatErrorPromise = waitForEvent(socket, "chat_error");

      socket.emit("join_ride_room", {
        rideId: 999999,
      });

      const error = await chatErrorPromise;

      assert.equal(
        error.message,
        "Access denied: Only the carpool driver and confirmed passengers can access this ride room.",
      );
    } finally {
      await closeSocket(socket);
    }
  });

  // =========================================================
  // SOCKET MESSAGE VALIDATION
  // =========================================================

  it("Rejects anonymous users from sending messages", async () => {
    const socket = createSocket();

    try {
      await waitForConnection(socket);

      const chatErrorPromise = waitForEvent(socket, "chat_error");

      socket.emit("send_message", {
        rideId: 999999,
        text: "Hello",
      });

      const error = await chatErrorPromise;

      assert.equal(error.message, "Authentication required to send messages.");
    } finally {
      await closeSocket(socket);
    }
  });

  it("Ignores empty Socket.IO chat messages", async () => {
    const socket = createSocket({
      auth: {
        token: `Bearer ${driverToken}`,
      },
    });

    try {
      await waitForConnection(socket);

      let received = false;

      socket.once("new_message", () => {
        received = true;
      });

      socket.emit("send_message", {
        rideId: 999999,
        text: "   ",
      });

      await new Promise((resolve) => setTimeout(resolve, 300));

      assert.equal(received, false);
    } finally {
      await closeSocket(socket);
    }
  });

  it("Rejects unauthorized users from sending ride messages", async () => {
    const socket = createSocket({
      auth: {
        token: `Bearer ${passengerToken}`,
      },
    });

    try {
      await waitForConnection(socket);

      const chatErrorPromise = waitForEvent(socket, "chat_error");

      socket.emit("send_message", {
        rideId: 999999,
        text: "Unauthorized message",
      });

      const error = await chatErrorPromise;

      assert.equal(
        error.message,
        "Access denied: Only the carpool driver and confirmed passengers can send messages.",
      );
    } finally {
      await closeSocket(socket);
    }
  });

  it("Allows a connected user to leave a ride room", async () => {
    const socket = createSocket({
      auth: {
        token: `Bearer ${driverToken}`,
      },
    });

    try {
      await waitForConnection(socket);

      socket.emit("leave_ride_room", {
        rideId: 999999,
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      assert.equal(socket.connected, true);
    } finally {
      await closeSocket(socket);
    }
  });
});
