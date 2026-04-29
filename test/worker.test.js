import { expect } from "chai";
import request from "supertest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as process from "node:process";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/server.js";
import UserModel from "../src/models/user.model.js";
import AvailabilityModel from "../src/models/availability.model.js";
import UnavailabilityModel from "../src/models/unavailability.model.js";
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
    await AvailabilityModel.deleteMany({});
    await UnavailabilityModel.deleteMany({});

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
        name: "Updated Worker",
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
      expect(res.body.data.name).to.equal(profileData.name);
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

  describe("POST /api/workers/availability", () => {
    const weeklySchedule = [
      {
        day: "Monday",
        isAvailable: true,
        startTime: "08:00",
        endTime: "21:00",
      },
      {
        day: "Tuesday",
        isAvailable: true,
        startTime: "08:00",
        endTime: "21:00",
      },
      {
        day: "Wednesday",
        isAvailable: false,
      },
    ];

    it("should save worker weekly availability", async () => {
      const res = await request(app)
        .post("/api/workers/availability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ weeklySchedule })
        .expect(200);

      expect(res.body.success).to.equal(true);
      expect(res.body.data.weeklySchedule).to.have.length(3);
      expect(res.body.data.weeklySchedule[2]).to.deep.include({
        day: "Wednesday",
        isAvailable: false,
        startTime: "08:00",
        endTime: "21:00",
      });
    });

    it("should update existing worker weekly availability", async () => {
      await request(app)
        .post("/api/workers/availability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({ weeklySchedule })
        .expect(200);

      const res = await request(app)
        .post("/api/workers/availability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          weeklySchedule: [
            {
              day: "Friday",
              isAvailable: true,
              startTime: "10:00",
              endTime: "18:00",
            },
          ],
        })
        .expect(200);

      expect(res.body.data.weeklySchedule).to.have.length(1);
      expect(res.body.data.weeklySchedule[0]).to.deep.include({
        day: "Friday",
        isAvailable: true,
        startTime: "10:00",
        endTime: "18:00",
      });

      const savedCount = await AvailabilityModel.countDocuments({});
      expect(savedCount).to.equal(1);
    });

    it("should validate invalid time strings", async () => {
      const res = await request(app)
        .post("/api/workers/availability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          weeklySchedule: [
            {
              day: "Monday",
              isAvailable: true,
              startTime: "25:00",
              endTime: "21:00",
            },
          ],
        })
        .expect(400);

      expect(res.body.issues).to.deep.include({
        path: "weeklySchedule.0.startTime",
        error: "Time must be in HH:MM format",
      });
    });

    it("should reject non-worker users", async () => {
      const res = await request(app)
        .post("/api/workers/availability")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ weeklySchedule })
        .expect(403);

      expect(res.body.errorCode).to.equal("WORKER_ROLE_REQUIRED");
    });
  });

  describe("GET /api/workers/availability", () => {
    it("should return saved worker weekly availability", async () => {
      await request(app)
        .post("/api/workers/availability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          weeklySchedule: [
            {
              day: "Monday",
              isAvailable: true,
              startTime: "08:00",
              endTime: "21:00",
            },
          ],
        })
        .expect(200);

      const res = await request(app)
        .get("/api/workers/availability")
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(res.body.success).to.equal(true);
      expect(res.body.data.weeklySchedule[0]).to.deep.include({
        day: "Monday",
        isAvailable: true,
        startTime: "08:00",
        endTime: "21:00",
      });
    });
  });

  describe("POST /api/workers/unavailability", () => {
    it("should create worker unavailability entries", async () => {
      const res = await request(app)
        .post("/api/workers/unavailability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          unavailableDates: [
            {
              startDate: "2026-12-24",
              endDate: "2026-12-26",
              reason: "Christmas",
            },
            {
              startDate: "2027-01-01",
              endDate: "2027-01-01",
            },
          ],
        })
        .expect(201);

      expect(res.body.success).to.equal(true);
      expect(res.body.data).to.have.length(2);
      expect(res.body.data[0].reason).to.equal("Christmas");
    });

    it("should validate date order", async () => {
      const res = await request(app)
        .post("/api/workers/unavailability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          unavailableDates: [
            {
              startDate: "2026-12-26",
              endDate: "2026-12-24",
            },
          ],
        })
        .expect(400);

      expect(res.body.issues).to.deep.include({
        path: "unavailableDates.0.endDate",
        error: "End date must be the same as or after start date",
      });
    });

    it("should validate past dates", async () => {
      const res = await request(app)
        .post("/api/workers/unavailability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          unavailableDates: [
            {
              startDate: "2024-12-24",
              endDate: "2024-12-26",
            },
          ],
        })
        .expect(400);

      expect(res.body.issues).to.deep.include({
        path: "unavailableDates.0.startDate",
        error: "Date cannot be in the past and must be a valid date",
      });
    });
  });

  describe("GET /api/workers/unavailability", () => {
    it("should return worker unavailability entries filtered by month", async () => {
      await request(app)
        .post("/api/workers/unavailability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          unavailableDates: [
            {
              startDate: "2026-12-24",
              endDate: "2026-12-26",
              reason: "Christmas",
            },
            {
              startDate: "2027-01-01",
              endDate: "2027-01-01",
              reason: "New year",
            },
          ],
        })
        .expect(201);

      const res = await request(app)
        .get("/api/workers/unavailability?month=2026-12")
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(res.body.success).to.equal(true);
      expect(res.body.data).to.have.length(1);
      expect(res.body.data[0].reason).to.equal("Christmas");
    });

    it("should validate invalid month query", async () => {
      const res = await request(app)
        .get("/api/workers/unavailability?month=2026-13")
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(400);

      expect(res.body.issues).to.deep.include({
        path: "month",
        error: "Month must be in YYYY-MM format",
      });
    });
  });

  describe("DELETE /api/workers/unavailability/:id", () => {
    it("should delete only the authenticated worker's own entry", async () => {
      const createRes = await request(app)
        .post("/api/workers/unavailability")
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          unavailableDates: [
            {
              startDate: "2026-12-24",
              endDate: "2026-12-26",
            },
          ],
        })
        .expect(201);

      const id = createRes.body.data[0].id;

      const deleteRes = await request(app)
        .delete(`/api/workers/unavailability/${id}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(deleteRes.body.message).to.equal(
        "Unavailability entry deleted successfully",
      );

      const count = await UnavailabilityModel.countDocuments({});
      expect(count).to.equal(0);
    });

    it("should not delete another worker's entry", async () => {
      const otherWorkerRes = await request(app)
        .post("/api/user/register")
        .send({
          name: "Other Worker",
          email: "other@example.com",
          password: "OtherPass123!",
        });

      const createRes = await request(app)
        .post("/api/workers/unavailability")
        .set("Authorization", `Bearer ${otherWorkerRes.body.token}`)
        .send({
          unavailableDates: [
            {
              startDate: "2026-12-24",
              endDate: "2026-12-26",
            },
          ],
        })
        .expect(201);

      const id = createRes.body.data[0].id;

      const res = await request(app)
        .delete(`/api/workers/unavailability/${id}`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(404);

      expect(res.body.errorCode).to.equal("UNAVAILABILITY_NOT_FOUND");
    });
  });
});
