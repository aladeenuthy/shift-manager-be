import { expect } from "chai";
import request from "supertest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as process from "node:process";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/server.js";
import UserModel from "../src/models/user.model.js";
dotenv.config();

describe("Worker API", () => {
  /** @type {MongoMemoryServer} */
  let mongoServer;

  /** @type {string} */
  let workerToken;

  /** @type {string} */
  let adminToken;

  before(async () => {
    if (process.env.NODE_ENV !== "test") {
      process.env.NODE_ENV = "test";
    }

    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(mongoUri);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await UserModel.deleteMany({});

    const workerRes = await request(app).post("/api/user/register").send({
      name: "Worker User",
      email: "worker@example.com",
      password: "WorkerPass123!",
    });
    workerToken = workerRes.body.token;

    const adminRes = await request(app).post("/api/user/register").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "AdminPass123!",
    });
    adminToken = adminRes.body.token;

    const admin = await UserModel.findOne({ email: "admin@example.com" });
    admin.role = "admin";
    await admin.save();
  });

  describe("GET /api/workers/profile", () => {
    it("should get the authenticated worker profile", async () => {
      const res = await request(app)
        .get("/api/workers/profile")
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(res.body.success).to.equal(true);
      expect(res.body.data.email).to.equal("worker@example.com");
      expect(res.body.data.phone).to.equal("");
      expect(res.body.data.city).to.equal("");
      expect(res.body.data.jobRole).to.equal("");
      expect(res.body.data.skills).to.deep.equal([]);
      expect(res.body.data.profilePictureUrl).to.equal(null);
      expect(res.body.data.isProfileComplete).to.equal(false);
    });

    it("should reject unauthenticated requests", async () => {
      await request(app).get("/api/workers/profile").expect(401);
    });

    it("should reject non-worker users", async () => {
      const res = await request(app)
        .get("/api/workers/profile")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);

      expect(res.body.errorCode).to.equal("WORKER_ROLE_REQUIRED");
    });
  });

  describe("PATCH /api/workers/profile", () => {
    it("should update personal information and mark profile complete", async () => {
      const profileData = {
        phone: "+447911123456",
        city: "London",
        jobRole: "Nurse",
      };

      const res = await request(app)
        .patch("/api/workers/profile")
        .set("Authorization", `Bearer ${workerToken}`)
        .send(profileData)
        .expect(200);

      expect(res.body.success).to.equal(true);
      expect(res.body.data.phone).to.equal(profileData.phone);
      expect(res.body.data.city).to.equal(profileData.city);
      expect(res.body.data.jobRole).to.equal(profileData.jobRole);
      expect(res.body.data.isProfileComplete).to.equal(true);
    });

    it("should update skills without requiring personal information", async () => {
      const res = await request(app)
        .patch("/api/workers/profile")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          skills: ["First Aid", "Caregiver", "Robotic"],
        })
        .expect(200);

      expect(res.body.data.skills).to.deep.equal([
        "First Aid",
        "Caregiver",
        "Robotic",
      ]);
      expect(res.body.data.isProfileComplete).to.equal(false);
    });

    it("should preserve profile completion after a skills-only update", async () => {
      await request(app)
        .patch("/api/workers/profile")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          phone: "+447911123456",
          city: "London",
          jobRole: "Nurse",
        })
        .expect(200);

      const res = await request(app)
        .patch("/api/workers/profile")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          skills: ["First Aid"],
        })
        .expect(200);

      expect(res.body.data.skills).to.deep.equal(["First Aid"]);
      expect(res.body.data.isProfileComplete).to.equal(true);
    });

    it("should validate empty profile fields", async () => {
      const res = await request(app)
        .patch("/api/workers/profile")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          phone: "",
        })
        .expect(400);

      expect(res.body.issues).to.deep.include({
        path: "phone",
        error: "Phone cannot be empty",
      });
    });
  });
});
