import express from "express";
import {
  resendOtpController,
  sendOtpController,
  verifyOtpController,
} from "../controllers/authentication.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Email verification and authentication helpers
 */

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     summary: Send an email verification OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: User not found
 */
router.post("/send-otp", sendOtpController);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify an email verification OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Email verified successfully
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 69efa54d51ae6332d13adf99
 *                     name:
 *                       type: string
 *                       example: Abdulmalik Uthman
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: Aladeenuthy@gmail.com
 *                     role:
 *                       type: string
 *                       example: worker
 *                     isEmailVerified:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Invalid or expired OTP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 name:
 *                   type: string
 *                   example: ValidationError
 *                 message:
 *                   type: string
 *                   example: Invalid or expired OTP
 *                 statusCode:
 *                   type: integer
 *                   example: 400
 *                 errorCode:
 *                   type: string
 *                   example: INVALID_OTP
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: User not found
 */
router.post("/verify-otp", verifyOtpController);

/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend an email verification OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Validation failed
 *       404:
 *         description: User not found
 *       429:
 *         description: Resend requested too soon
 */
router.post("/resend-otp", resendOtpController);

export default router;
