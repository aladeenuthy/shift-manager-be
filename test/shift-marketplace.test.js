import { expect } from "chai";
import request from "supertest";
import mongoose from "mongoose";
import dotenv from "dotenv";
import * as process from "node:process";
import dayjs from "dayjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import { app } from "../src/server.js";
import UserModel from "../src/models/user.model.js";
import ShiftModel from "../src/models/shifts.model.js";
import LocationModel from "../src/models/location.model.js";
import { SHIFT_STATUS, SHIFT_TYPES } from "../src/services/shift/constants.js";
dotenv.config();

describe("Shift Marketplace and Geofence API", () => {
  /** @type {MongoMemoryServer} */
  let mongoServer;

  /** @type {string} */
  let workerToken;

  /** @type {string} */
  let adminToken;

  /** @type {string} */
  let workerUserId;

  /** @type {mongoose.Document} */
  let testLocation;

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
    await ShiftModel.deleteMany({});
    await LocationModel.deleteMany({});

    const workerRes = await request(app).post("/api/user/register").send({
      name: "Worker User",
      email: "worker@example.com",
      password: "WorkerPass123!",
    });
    workerToken = workerRes.body.token;
    workerUserId = workerRes.body.user.id;

    const adminRes = await request(app).post("/api/user/register").send({
      name: "Admin User",
      email: "admin@example.com",
      password: "AdminPass123!",
    });
    adminToken = adminRes.body.token;

    const admin = await UserModel.findOne({ email: "admin@example.com" });
    admin.role = "admin";
    await admin.save();

    testLocation = await LocationModel.create({
      name: "Marketplace Location",
      address: "1 Test Street, London",
      postCode: "SW1A 1AA",
      cordinates: {
        latitude: 51.5074,
        longitude: -0.1276,
      },
    });
  });

  const createShift = async (overrides = {}) => {
    const date = overrides.date || dayjs().add(30, "day").toDate();
    return ShiftModel.create({
      title: "Open Morning Shift",
      role: "Nurse",
      typeOfShift: [SHIFT_TYPES.MORNING],
      user: null,
      startTime: dayjs(date).hour(8).minute(0).second(0).toDate(),
      finishTime: dayjs(date).hour(16).minute(0).second(0).toDate(),
      numOfShiftsPerDay: 1,
      location: testLocation._id,
      status: SHIFT_STATUS.SCHEDULED,
      date,
      ...overrides,
    });
  };

  describe("GET /api/shifts/marketplace", () => {
    it("should return only scheduled unassigned future shifts", async () => {
      const openShift = await createShift();
      await createShift({
        title: "Assigned Shift",
        user: workerUserId,
      });
      await createShift({
        title: "Cancelled Shift",
        status: SHIFT_STATUS.CANCELLED,
      });
      await createShift({
        title: "Past Shift",
        date: dayjs().subtract(1, "day").toDate(),
      });

      const res = await request(app)
        .get("/api/shifts/marketplace")
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(res.body.shifts).to.have.length(1);
      expect(res.body.shifts[0].id).to.equal(openShift._id.toString());
      expect(res.body.shifts[0].user).to.equal(null);
      expect(res.body.pagination.totalCount).to.equal(1);
    });

    it("should filter marketplace shifts by role, shift type, and date", async () => {
      const targetDate = dayjs().add(40, "day");
      const targetShift = await createShift({
        role: "Caregiver",
        typeOfShift: [SHIFT_TYPES.EVENING],
        date: targetDate.toDate(),
        startTime: targetDate.hour(16).minute(0).second(0).toDate(),
        finishTime: targetDate.hour(22).minute(0).second(0).toDate(),
      });
      await createShift({
        role: "Nurse",
        typeOfShift: [SHIFT_TYPES.MORNING],
      });

      const res = await request(app)
        .get("/api/shifts/marketplace")
        .query({
          role: "Caregiver",
          typeOfShift: SHIFT_TYPES.EVENING,
          date: targetDate.format("YYYY-MM-DD"),
        })
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(res.body.shifts).to.have.length(1);
      expect(res.body.shifts[0].id).to.equal(targetShift._id.toString());
    });

    it("should filter date query by UTC calendar day without timezone drift", async () => {
      await createShift({
        title: "April 30 UTC Late Shift",
        date: new Date("2026-04-30T23:00:00.000Z"),
        startTime: new Date("2026-04-30T23:00:00.000Z"),
        finishTime: new Date("2026-05-01T06:00:00.000Z"),
      });
      const mayFirstShift = await createShift({
        title: "May 1 UTC Shift",
        date: new Date("2026-05-01T00:00:00.000Z"),
        startTime: new Date("2026-05-01T10:00:00.000Z"),
        finishTime: new Date("2026-05-01T18:00:00.000Z"),
      });

      const res = await request(app)
        .get("/api/shifts/marketplace")
        .query({ date: "2026-05-01" })
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(res.body.shifts.map((shift) => shift.id)).to.deep.equal([
        mayFirstShift._id.toString(),
      ]);
    });
  });

  describe("PATCH /api/shifts/:id/claim", () => {
    it("should claim an open marketplace shift", async () => {
      const shift = await createShift();

      const res = await request(app)
        .patch(`/api/shifts/${shift._id}/claim`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(200);

      expect(res.body.success).to.equal(true);
      expect(res.body.message).to.equal("Shift claimed successfully");
      expect(res.body.data.shift.user.id).to.equal(workerUserId);

      const updatedShift = await ShiftModel.findById(shift._id);
      expect(updatedShift.user.toString()).to.equal(workerUserId);
    });

    it("should reject already claimed shifts", async () => {
      const shift = await createShift({ user: workerUserId });

      const res = await request(app)
        .patch(`/api/shifts/${shift._id}/claim`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(400);

      expect(res.body.errorCode).to.equal("SHIFT_ALREADY_CLAIMED");
    });

    it("should reject cancelled shifts", async () => {
      const shift = await createShift({ status: SHIFT_STATUS.CANCELLED });

      const res = await request(app)
        .patch(`/api/shifts/${shift._id}/claim`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(400);

      expect(res.body.errorCode).to.equal("SHIFT_NOT_AVAILABLE");
    });

    it("should reject shifts when the start date and time has passed", async () => {
      const now = dayjs();
      const shift = await createShift({
        date: now.startOf("day").toDate(),
        startTime: now.subtract(1, "hour").toDate(),
        finishTime: now.add(4, "hour").toDate(),
      });

      const res = await request(app)
        .patch(`/api/shifts/${shift._id}/claim`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(400);

      expect(res.body.errorCode).to.equal("SHIFT_NOT_AVAILABLE");
    });

    it("should reject stale shifts using the marketplace visible date and time", async () => {
      const now = dayjs();
      const shift = await createShift({
        date: new Date(
          Date.UTC(now.year(), now.month(), now.date(), 23, 0, 0, 0),
        ),
        startTime: now.subtract(1, "hour").toDate(),
        finishTime: now.add(4, "hour").toDate(),
      });

      const res = await request(app)
        .patch(`/api/shifts/${shift._id}/claim`)
        .set("Authorization", `Bearer ${workerToken}`)
        .expect(400);

      expect(res.body.errorCode).to.equal("SHIFT_NOT_AVAILABLE");
    });

    it("should reject non-worker users", async () => {
      const shift = await createShift();

      const res = await request(app)
        .patch(`/api/shifts/${shift._id}/claim`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);

      expect(res.body.errorCode).to.equal("WORKER_ROLE_REQUIRED");
    });
  });

  describe("POST /api/shifts/:id/verify-location", () => {
    it("should verify locations inside the geofence", async () => {
      const shift = await createShift();

      const res = await request(app)
        .post(`/api/shifts/${shift._id}/verify-location`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          latitude: 51.5074,
          longitude: -0.1276,
        })
        .expect(200);

      expect(res.body.success).to.equal(true);
      expect(res.body.message).to.equal("Location verified");
      expect(res.body.data.withinRange).to.equal(true);
      expect(res.body.data.radiusMeters).to.equal(200);
    });

    it("should reject locations outside the geofence", async () => {
      const shift = await createShift();

      const res = await request(app)
        .post(`/api/shifts/${shift._id}/verify-location`)
        .set("Authorization", `Bearer ${workerToken}`)
        .send({
          latitude: 51.5155,
          longitude: -0.1419,
        })
        .expect(400);

      expect(res.body.success).to.equal(false);
      expect(res.body.code).to.equal("OUTSIDE_GEOFENCE");
      expect(res.body.data.withinRange).to.equal(false);
      expect(res.body.data.radiusMeters).to.equal(200);
      expect(res.body.data.distanceMeters).to.be.greaterThan(200);
    });
  });
});
