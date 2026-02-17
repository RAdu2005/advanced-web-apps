import mongoose from "mongoose";
import request from "supertest";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

let app: import("express").Express;
const testDbName = `cloud_drive_test_${Date.now()}`;
const testMongoUri = `mongodb://127.0.0.1:27017/${testDbName}`;

async function registerUser(email: string, password = "password1", displayName = "User") {
  return request(app).post("/auth/register").send({ email, password, displayName });
}

describe("API integration", () => {
  beforeAll(async () => {
    process.env.MONGO_URI = testMongoUri;
    const appModule = await import("../src/app");
    app = appModule.app;
    await mongoose.connect(testMongoUri);
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const collection of Object.values(collections)) {
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it("register/login/me/logout flow", async () => {
    const registerRes = await registerUser("a@test.com");
    expect(registerRes.status).toBe(201);
    expect(registerRes.headers["set-cookie"]).toBeTruthy();

    const loginRes = await request(app).post("/auth/login").send({ email: "a@test.com", password: "password1" });
    expect(loginRes.status).toBe(200);

    const cookie = loginRes.headers["set-cookie"][0];
    const meRes = await request(app).get("/auth/me").set("Cookie", cookie);
    expect(meRes.status).toBe(200);

    const logoutRes = await request(app).post("/auth/logout").set("Cookie", cookie);
    expect(logoutRes.status).toBe(204);
  });

  it("auth guard blocks protected routes", async () => {
    const res = await request(app).get("/documents");
    expect(res.status).toBe(401);
  });

  it("returns specific validation messages for auth payloads", async () => {
    const shortNameRes = await request(app).post("/auth/register").send({
      email: "valid@test.com",
      password: "password1",
      displayName: "A"
    });
    expect(shortNameRes.status).toBe(422);
    expect(shortNameRes.body.message).toBe("Display name must be at least 2 characters");

    const shortPasswordRes = await request(app).post("/auth/register").send({
      email: "valid2@test.com",
      password: "123",
      displayName: "Valid Name"
    });
    expect(shortPasswordRes.status).toBe(422);
    expect(shortPasswordRes.body.message).toBe("Password must be at least 6 characters");
  });

  it("returns invalid credentials for wrong or inexisting account", async () => {
    await registerUser("exists@test.com", "password1", "Exists");

    const wrongPasswordRes = await request(app).post("/auth/login").send({
      email: "exists@test.com",
      password: "wrong"
    });
    expect(wrongPasswordRes.status).toBe(401);
    expect(wrongPasswordRes.body.message).toBe("Invalid email or password");

    const missingAccountRes = await request(app).post("/auth/login").send({
      email: "missing@test.com",
      password: "whatever"
    });
    expect(missingAccountRes.status).toBe(401);
    expect(missingAccountRes.body.message).toBe("Invalid email or password");
  });

  it("owner can CRUD and editor can update but not delete", async () => {
    const owner = await registerUser("owner@test.com", "password1", "Owner");
    const ownerCookie = owner.headers["set-cookie"][0];

    await registerUser("editor@test.com", "password1", "Editor");

    const createRes = await request(app)
      .post("/documents")
      .set("Cookie", ownerCookie)
      .send({ title: "Doc 1", content: "hello" });

    expect(createRes.status).toBe(201);
    const docId = createRes.body._id;

    const grantRes = await request(app)
      .post(`/documents/${docId}/permissions/editors`)
      .set("Cookie", ownerCookie)
      .send({ email: "editor@test.com" });

    expect(grantRes.status).toBe(201);

    const editorLogin = await request(app).post("/auth/login").send({ email: "editor@test.com", password: "password1" });
    const editorCookie = editorLogin.headers["set-cookie"][0];

    const updateRes = await request(app)
      .patch(`/documents/${docId}`)
      .set("Cookie", editorCookie)
      .send({ content: "updated" });

    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app).delete(`/documents/${docId}`).set("Cookie", editorCookie);
    expect(deleteRes.status).toBe(403);
  });

  it("public share token returns read-only doc", async () => {
    const owner = await registerUser("share@test.com", "password1", "Owner");
    const ownerCookie = owner.headers["set-cookie"][0];

    const createRes = await request(app)
      .post("/documents")
      .set("Cookie", ownerCookie)
      .send({ title: "Shared", content: "public text" });
    const docId = createRes.body._id;

    const shareRes = await request(app).post(`/documents/${docId}/share-link`).set("Cookie", ownerCookie);
    expect(shareRes.status).toBe(200);

    const publicRes = await request(app).get(`/share/${shareRes.body.token}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.content).toBe("public text");
  });

  it("single writer lock blocks other users", async () => {
    const owner = await registerUser("lock-owner@test.com", "password1", "Owner");
    const ownerCookie = owner.headers["set-cookie"][0];

    await registerUser("lock-editor@test.com", "password1", "Editor");

    const createRes = await request(app)
      .post("/documents")
      .set("Cookie", ownerCookie)
      .send({ title: "Lock doc", content: "x" });
    const docId = createRes.body._id;

    await request(app)
      .post(`/documents/${docId}/permissions/editors`)
      .set("Cookie", ownerCookie)
      .send({ email: "lock-editor@test.com" });

    const editorLogin = await request(app).post("/auth/login").send({ email: "lock-editor@test.com", password: "password1" });
    const editorCookie = editorLogin.headers["set-cookie"][0];

    const ownerStart = await request(app).post(`/documents/${docId}/edit-session/start`).set("Cookie", ownerCookie);
    expect(ownerStart.status).toBe(200);

    const editorStart = await request(app).post(`/documents/${docId}/edit-session/start`).set("Cookie", editorCookie);
    expect(editorStart.status).toBe(409);

    const ownerEnd = await request(app).post(`/documents/${docId}/edit-session/end`).set("Cookie", ownerCookie);
    expect(ownerEnd.status).toBe(204);

    const editorStartAfter = await request(app).post(`/documents/${docId}/edit-session/start`).set("Cookie", editorCookie);
    expect(editorStartAfter.status).toBe(200);
  });

  it("concurrent start requests from same user do not return duplicate key 500", async () => {
    const owner = await registerUser("race-owner@test.com", "password1", "Owner");
    const ownerCookie = owner.headers["set-cookie"][0];

    const createRes = await request(app)
      .post("/documents")
      .set("Cookie", ownerCookie)
      .send({ title: "Race doc", content: "" });
    const docId = createRes.body._id;

    const [startA, startB] = await Promise.all([
      request(app).post(`/documents/${docId}/edit-session/start`).set("Cookie", ownerCookie),
      request(app).post(`/documents/${docId}/edit-session/start`).set("Cookie", ownerCookie)
    ]);

    const statuses = [startA.status, startB.status];
    expect(statuses.every((status) => status === 200)).toBe(true);
  });
});
