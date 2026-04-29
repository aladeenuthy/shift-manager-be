import express from "express";
import requireAuthMiddleware from "../middlewares/require-auth.middleware.js";
import {
  createWorkerUnavailabilityController,
  deleteWorkerUnavailabilityController,
  getWorkerAvailabilityController,
  getWorkerProfileController,
  getWorkerUnavailabilityController,
  saveWorkerAvailabilityController,
  updateWorkerProfileController,
} from "../controllers/worker.controller.js";
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Workers
 *   description: Worker profiles and worker management
 */

/**
 * @swagger
 * /workers/profile:
 *   get:
 *     summary: Get the authenticated worker profile
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Worker profile returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 69efa54d51ae6332d13adf99
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: john@example.com
 *                     phone:
 *                       type: string
 *                       example: "+447911123456"
 *                     city:
 *                       type: string
 *                       example: London
 *                     jobRole:
 *                       type: string
 *                       example: Nurse
 *                     skills:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: [First Aid, Caregiver]
 *                     profilePictureUrl:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     isProfileComplete:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - worker access required
 *       404:
 *         description: User not found
 */
router.get("/profile", requireAuthMiddleware, getWorkerProfileController);

/**
 * @swagger
 * /workers/profile:
 *   patch:
 *     summary: Update the authenticated worker profile
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               phone:
 *                 type: string
 *                 example: "+447911123456"
 *               city:
 *                 type: string
 *                 example: London
 *               jobRole:
 *                 type: string
 *                 example: Nurse
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [First Aid, Caregiver, Robotic]
 *     responses:
 *       200:
 *         description: Worker profile updated successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - worker access required
 *       404:
 *         description: User not found
 */
router.patch("/profile", requireAuthMiddleware, updateWorkerProfileController);

/**
 * @swagger
 * /workers/availability:
 *   post:
 *     summary: Save the authenticated worker weekly availability
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - weeklySchedule
 *             properties:
 *               weeklySchedule:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - day
 *                     - isAvailable
 *                   properties:
 *                     day:
 *                       type: string
 *                       enum: [Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday]
 *                     isAvailable:
 *                       type: boolean
 *                     startTime:
 *                       type: string
 *                       example: "08:00"
 *                     endTime:
 *                       type: string
 *                       example: "21:00"
 *     responses:
 *       200:
 *         description: Availability saved successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - worker access required
 */
router.post(
  "/availability",
  requireAuthMiddleware,
  saveWorkerAvailabilityController,
);

/**
 * @swagger
 * /workers/availability:
 *   get:
 *     summary: Get the authenticated worker weekly availability
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability returned successfully
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - worker access required
 */
router.get(
  "/availability",
  requireAuthMiddleware,
  getWorkerAvailabilityController,
);

/**
 * @swagger
 * /workers/unavailability:
 *   post:
 *     summary: Create authenticated worker unavailability date ranges
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - unavailableDates
 *             properties:
 *               unavailableDates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - startDate
 *                     - endDate
 *                   properties:
 *                     startDate:
 *                       type: string
 *                       format: date
 *                       example: "2026-12-24"
 *                     endDate:
 *                       type: string
 *                       format: date
 *                       example: "2026-12-26"
 *                     reason:
 *                       type: string
 *                       example: Christmas
 *     responses:
 *       201:
 *         description: Unavailability entries created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - worker access required
 */
router.post(
  "/unavailability",
  requireAuthMiddleware,
  createWorkerUnavailabilityController,
);

/**
 * @swagger
 * /workers/unavailability:
 *   get:
 *     summary: Get authenticated worker unavailability entries
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           pattern: "^\\d{4}-(0[1-9]|1[0-2])$"
 *           example: "2026-12"
 *         description: Optional month filter in YYYY-MM format
 *     responses:
 *       200:
 *         description: Unavailability entries returned successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - worker access required
 */
router.get(
  "/unavailability",
  requireAuthMiddleware,
  getWorkerUnavailabilityController,
);

/**
 * @swagger
 * /workers/unavailability/{id}:
 *   delete:
 *     summary: Delete one authenticated worker unavailability entry
 *     tags: [Workers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unavailability entry ID
 *     responses:
 *       200:
 *         description: Unavailability entry deleted successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - worker access required
 *       404:
 *         description: Entry not found
 */
router.delete(
  "/unavailability/:id",
  requireAuthMiddleware,
  deleteWorkerUnavailabilityController,
);

export default router;
