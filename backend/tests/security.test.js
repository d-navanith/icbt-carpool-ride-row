const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { app } = require("../src/server");

describe("ICBT Campus Carpool Security Tests", () => {
  let adminToken = "";
  let userToken = "";

  it("Security headers are present on API responses", async () => {
    const res = await request(app).get("/api/health");

    assert.equal(res.status, 200);

    // Helmet baseline
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.ok(res.headers["x-frame-options"]);
  });

  it("Protected endpoint rejects unauthenticated access", async () => {
    const res = await request(app).get("/api/auth/me");

    assert.equal(res.status, 401);
  });

  it("Admin endpoint rejects unauthenticated access", async () => {
    const res = await request(app).get("/api/admin/users");

    assert.equal(res.status, 401);
  });

  it("Normal user cannot access administrator resources", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        email: "sanduni.user@icbt.edu.lk",
        password: "user123",
      });

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.token);

    userToken = loginRes.body.token;

    const adminRes = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${userToken}`);

    assert.equal(adminRes.status, 403);
  });

  it("Administrator login is separated from normal user login", async () => {
    const adminLogin = await request(app)
      .post("/api/admin/auth/login")
      .send({
        email: "admin@icbt.edu.lk",
        password: "admin123",
      });

    assert.equal(adminLogin.status, 200);
    assert.ok(adminLogin.body.token);
    assert.equal(adminLogin.body.user.system_role, "admin");

    adminToken = adminLogin.body.token;

    const normalLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@icbt.edu.lk",
        password: "admin123",
      });

    assert.equal(normalLogin.status, 403);
  });

  it("Admin token can access protected administrator resources", async () => {
    assert.ok(adminToken);

    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.users));
  });

  it("Allowed frontend origin receives CORS permission", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:3000");

    assert.equal(res.status, 200);
    assert.equal(
      res.headers["access-control-allow-origin"],
      "http://localhost:3000",
    );
  });
});