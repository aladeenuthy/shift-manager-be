import UserModel from "../../models/user.model.js";
import { AppError } from "../../utils/errors/app.error.js";
import { AuthorizationError } from "../../utils/errors/auth.error.js";

/**
 * Format a worker profile for API responses
 * @param {Object} worker - Mongoose user document
 * @returns {Object} Worker profile data
 */
const formatWorkerProfile = (worker) => ({
  id: worker._id,
  name: worker.name,
  email: worker.email,
  phone: worker.phone || "",
  city: worker.city || "",
  jobRole: worker.jobRole || "",
  skills: worker.skills || [],
  profilePictureUrl: worker.profilePictureUrl || null,
  isProfileComplete: worker.isProfileComplete,
});

/**
 * Get an authenticated worker by ID
 * @param {string} userId - Authenticated user ID
 * @returns {Promise<Object>} Worker user document
 * @throws {AppError} If user is not found
 * @throws {AuthorizationError} If user is not a worker
 */
const getWorkerById = async (userId) => {
  const worker = await UserModel.findById(userId);

  if (!worker) {
    throw new AppError({
      message: "User not found",
      statusCode: 404,
      errorCode: "USER_NOT_FOUND",
    });
  }

  if (worker.role !== "worker") {
    throw new AuthorizationError({
      message: "Worker access required",
      errorCode: "WORKER_ROLE_REQUIRED",
    });
  }

  return worker;
};

/**
 * Get the authenticated worker's profile
 * @param {string} userId - Authenticated user ID
 * @returns {Promise<{success: boolean, data: Object}>} Worker profile response
 */
const getWorkerProfile = async (userId) => {
  const worker = await getWorkerById(userId);

  return {
    success: true,
    data: formatWorkerProfile(worker),
  };
};

/**
 * Update the authenticated worker's profile
 * @param {string} userId - Authenticated user ID
 * @param {Object} profileData - Profile fields to update
 * @param {string} [profileData.phone] - Phone number
 * @param {string} [profileData.city] - City
 * @param {string} [profileData.jobRole] - Job role
 * @param {string[]} [profileData.skills] - Worker skills
 * @returns {Promise<{success: boolean, data: Object}>} Updated worker profile response
 */
const updateWorkerProfile = async (userId, profileData) => {
  const worker = await getWorkerById(userId);

  Object.entries(profileData).forEach(([key, value]) => {
    if (value !== undefined) {
      worker[key] = value;
    }
  });

  worker.isProfileComplete = Boolean(
    worker.phone?.trim() && worker.city?.trim() && worker.jobRole?.trim(),
  );

  await worker.save();

  return {
    success: true,
    data: formatWorkerProfile(worker),
  };
};

export { getWorkerProfile, updateWorkerProfile };
