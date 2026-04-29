import express from "express";
import requireAuthMiddleware from "../middlewares/require-auth.middleware.js";
import {
  getWorkerProfileController,
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

export default router;
