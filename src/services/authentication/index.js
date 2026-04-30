import UserModel from "../../models/user.model.js";
import { AppError } from "../../utils/errors/app.error.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as process from "node:process";
import crypto from "node:crypto";
import { sendEmail } from "../../utils/email.js";
import { ValidationError } from "../../utils/errors/validation.error.js";
import { getCurrentDateTime, addTime, isAfter } from "../../utils/datetime.js";

const OTP_EXPIRY_MINUTES = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 30;

/**
 * Normalize email input for storage and lookup
 * @param {string} email
 * @returns {string}
 */
const normalizeEmail = (email) => email.trim().toLowerCase();

/**
 * Find a user by email without treating casing as significant
 * @param {string} email
 * @returns {Promise<Object | null>} User document or null
 */
const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  return UserModel.findOne({
    email: { $regex: `^${normalizedEmail}$`, $options: "i" },
  });
};

/**
 * Create JWT token for user using userId as payload
 * @param {string} userId
 * @returns {string} JWT token
 */
const createJWTToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: 3 * 24 * 60 * 60,
  });
};

/**
 * Format user document for API responses
 * @param {Object} user
 * @returns {{id: string, name: string, email: string, role: string, isEmailVerified: boolean}}
 */
const formatUserForResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
});

/**
 * Generate a random 6-digit OTP
 * @returns {string}
 */
const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Send a fresh OTP to a user
 * @param {Object} user - User document
 * @returns {Promise<void>}
 */
const createAndSendOtp = async (user) => {
  const otp = generateOtp();
  const salt = await bcrypt.genSalt(10);
  user.otpHash = await bcrypt.hash(otp, salt);
  user.otpExpiry = addTime(getCurrentDateTime(), OTP_EXPIRY_MINUTES, "minute");
  user.otpLastSentAt = getCurrentDateTime();
  await user.save();

  await sendEmail(
    user.email,
    "ORTA - Email Verification OTP",
    `<h1>ORTA - Email Verification</h1><p>Your verification code is <strong>${otp}</strong>.</p><p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`,
  );
};

/**
 * Register a new user
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: {id: string, name: string, email: string}}>} Registered user info and JWT token
 * @throws {AppError} If user already exists
 */
const registerUser = async (name, email, password) => {
  const normalizedEmail = normalizeEmail(email);
  const exists = await findUserByEmail(normalizedEmail);
  if (exists) {
    throw new AppError({
      message: "User already exists",
      statusCode: 400,
      errorCode: "USER_EXISTS",
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = new UserModel({
    name,
    email: normalizedEmail,
    password: hashedPassword,
  });
  const user = await newUser.save();
  const token = createJWTToken(user._id);
  return {
    token,
    user: formatUserForResponse(user),
  };
};

/**
 * Login user with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: {id: string, name: string, email: string}}>} Logged in user info and JWT token
 * @throws {AppError} If user does not exist
 */
const loginUser = async (email, password) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError({
      message: "User does not exist",
      statusCode: 404,
      errorCode: "USER_NOT_FOUND",
    });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError({
      message: "Invalid email or password",
      statusCode: 400,
      errorCode: "INVALID_CREDENTIALS",
    });
  }
  const token = createJWTToken(user._id);
  return {
    token,
    user: formatUserForResponse(user),
  };
};

/**
 * Get user by ID
 * @param {string} id
 * @returns {Promise<{user: {id: string, name: string, email: string, role: string}}>} User info
 */
const getUser = async (id) => {
  const user = await UserModel.findOne({ _id: id });

  if (!user) {
    throw new AppError({
      message: "User does not exists",
      statusCode: 404,
      errorCode: "USER_NOT_FOUND",
    });
  }

  return {
    user: formatUserForResponse(user),
  };
};

/**
 * Send an email verification OTP to an existing user
 * @param {string} email
 * @returns {Promise<{success: boolean, message: string}>}
 * @throws {AppError} If user does not exist
 */
const sendOtp = async (email) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError({
      message: "User not found",
      statusCode: 404,
      errorCode: "USER_NOT_FOUND",
    });
  }

  await createAndSendOtp(user);

  return {
    success: true,
    message: `OTP sent to ${user.email}`,
  };
};

/**
 * Resend an email verification OTP, rate-limited per user
 * @param {string} email
 * @returns {Promise<{success: boolean, message: string}>}
 * @throws {AppError} If user does not exist or resend is too soon
 */
const resendOtp = async (email) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError({
      message: "User not found",
      statusCode: 404,
      errorCode: "USER_NOT_FOUND",
    });
  }

  if (user.otpLastSentAt) {
    const nextAllowedAt = addTime(
      user.otpLastSentAt,
      OTP_RESEND_COOLDOWN_SECONDS,
      "second",
    );

    if (isAfter(nextAllowedAt, getCurrentDateTime())) {
      throw new AppError({
        message: "Please wait 30 seconds before requesting another OTP",
        statusCode: 429,
        errorCode: "OTP_RATE_LIMITED",
      });
    }
  }

  await createAndSendOtp(user);

  return {
    success: true,
    message: `OTP sent to ${user.email}`,
  };
};

/**
 * Verify a user's email verification OTP
 * @param {string} email
 * @param {string} otp
 * @returns {Promise<{success: boolean, message: string, token: string, user: {id: string, name: string, email: string, role: string}}>}
 * @throws {AppError} If user does not exist
 * @throws {ValidationError} If OTP is invalid or expired
 */
const verifyOtp = async (email, otp) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError({
      message: "User not found",
      statusCode: 404,
      errorCode: "USER_NOT_FOUND",
    });
  }

  const isOtpExpired =
    !user.otpExpiry || isAfter(getCurrentDateTime(), user.otpExpiry);
  const isOtpValid =
    user.otpHash && !isOtpExpired && (await bcrypt.compare(otp, user.otpHash));

  if (!isOtpValid) {
    throw new ValidationError({
      message: "Invalid or expired OTP",
      errorCode: "INVALID_OTP",
    });
  }

  user.isEmailVerified = true;
  user.otpHash = null;
  user.otpExpiry = null;
  user.otpLastSentAt = null;
  await user.save();

  const token = createJWTToken(user._id);

  return {
    success: true,
    message: "Email verified successfully",
    token,
    user: formatUserForResponse(user),
  };
};

/**
 * Handle forgot password by generating a reset token and sending it via email
 * @param {string} email - User's email address
 * @throws {AppError} If user does not exist or email sending fails
 */
const forgotPassword = async (email) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new AppError({
      message: "User does not exist",
      statusCode: 404,
      errorCode: "USER_NOT_FOUND",
    });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  const ttlMinutes = 60; // Token valid for 60 minutes
  const resetTokenExpiresAt = addTime(
    getCurrentDateTime(),
    ttlMinutes,
    "minute",
  );

  user.passwordResetTokenHash = resetTokenHash;
  user.passwordResetTokenExpiry = resetTokenExpiresAt;
  await user.save();

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?uid=${user._id}&token=${resetToken}`;

  await sendEmail(
    email,
    "ORTA - Password Reset",
    `<h1>ORTA - Password Reset</h1><h2>Click on the link to reset your ORTA account password</h2><h3>${resetUrl}</h3><p>This link is valid for the next ${ttlMinutes} minutes.</p>`,
  );
};

/**
 * Reset user password using reset token
 * @param {string} id - User ID
 * @param {string} resetToken - Password reset token
 * @param {string} newPassword - New password
 * @throws {AppError} If user does not exist
 * @throws {ValidationError} If token is invalid or expired
 */
const resetPassword = async (id, resetToken, newPassword) => {
  const user = await UserModel.findOne({ _id: id });

  if (!user) {
    throw new AppError({
      message: "User does not exists",
      statusCode: 404,
      errorCode: "USER_NOT_FOUND",
    });
  }

  if (isAfter(getCurrentDateTime(), user.passwordResetTokenExpiry)) {
    throw new ValidationError({
      message: "Password reset token has expired",
      statusCode: 400,
      errorCode: "PASSWORD_RESET_TOKEN_EXPIRED",
    });
  }

  const resetTokenHash = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  const dbTokenHash = Buffer.from(user.passwordResetTokenHash, "hex");
  const inputTokenHash = Buffer.from(resetTokenHash, "hex");
  if (
    dbTokenHash.length !== inputTokenHash.length ||
    !crypto.timingSafeEqual(dbTokenHash, inputTokenHash)
  ) {
    throw new ValidationError({
      message: "Invalid password reset token",
      statusCode: 400,
      errorCode: "INVALID_PASSWORD_RESET_TOKEN",
    });
  }

  const salt = await bcrypt.genSalt(10);

  user.password = await bcrypt.hash(newPassword, salt);
  user.passwordResetTokenHash = null;
  user.passwordResetTokenExpiry = null;
  await user.save();
};

/**
 * Promote a user to admin role
 * @param {string} userId - ID of the user to promote
 * @returns {Promise<{user: {id: string, name: string, email: string, role: string}}>} Updated user info
 * @throws {AppError} If user does not exist
 */
const promoteToAdmin = async (userId) => {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new AppError({
      message: "User does not exist",
      statusCode: 404,
      errorCode: "USER_NOT_FOUND",
    });
  }

  user.role = "admin";
  await user.save();

  return {
    user: formatUserForResponse(user),
  };
};

export {
  registerUser,
  loginUser,
  getUser,
  sendOtp,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  promoteToAdmin,
};
