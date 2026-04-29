import UserModel from "../../models/user.model.js";
import AvailabilityModel from "../../models/availability.model.js";
import UnavailabilityModel from "../../models/unavailability.model.js";
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
 * Format availability document for API responses
 * @param {Object | null} availability - Mongoose availability document
 * @returns {Object | null} Formatted availability data
 */
const formatAvailability = (availability) => {
  if (!availability) {
    return null;
  }

  return {
    id: availability._id,
    user: availability.user,
    weeklySchedule: availability.weeklySchedule,
    createdAt: availability.createdAt,
    updatedAt: availability.updatedAt,
  };
};

/**
 * Format unavailability document for API responses
 * @param {Object} unavailability - Mongoose unavailability document
 * @returns {Object} Formatted unavailability data
 */
const formatUnavailability = (unavailability) => ({
  id: unavailability._id,
  user: unavailability.user,
  startDate: unavailability.startDate,
  endDate: unavailability.endDate,
  reason: unavailability.reason || "",
  createdAt: unavailability.createdAt,
  updatedAt: unavailability.updatedAt,
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
 * @param {string} [profileData.name] - Worker name
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

/**
 * Save a worker's weekly recurring availability
 * @param {string} userId - Authenticated user ID
 * @param {Array<Object>} weeklySchedule - Weekly schedule entries
 * @returns {Promise<{success: boolean, data: Object}>} Saved availability
 */
const saveWorkerAvailability = async (userId, weeklySchedule) => {
  await getWorkerById(userId);

  const availability = await AvailabilityModel.findOneAndUpdate(
    { user: userId },
    { user: userId, weeklySchedule },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

  return {
    success: true,
    data: formatAvailability(availability),
  };
};

/**
 * Get a worker's weekly recurring availability
 * @param {string} userId - Authenticated user ID
 * @returns {Promise<{success: boolean, data: Object | null}>} Saved availability
 */
const getWorkerAvailability = async (userId) => {
  await getWorkerById(userId);

  const availability = await AvailabilityModel.findOne({ user: userId });

  return {
    success: true,
    data: formatAvailability(availability),
  };
};

/**
 * Create worker unavailability entries
 * @param {string} userId - Authenticated user ID
 * @param {Array<Object>} unavailableDates - Date ranges
 * @returns {Promise<{success: boolean, data: Object[]}>} Created entries
 */
const createWorkerUnavailability = async (userId, unavailableDates) => {
  await getWorkerById(userId);

  const entries = unavailableDates.map((entry) => ({
    ...entry,
    user: userId,
  }));

  const created = await UnavailabilityModel.insertMany(entries);

  return {
    success: true,
    data: created.map(formatUnavailability),
  };
};

/**
 * Get worker unavailability entries, optionally filtered by month
 * @param {string} userId - Authenticated user ID
 * @param {{month?: string}} options - Query options
 * @returns {Promise<{success: boolean, data: Object[]}>} Unavailability entries
 */
const getWorkerUnavailability = async (userId, options = {}) => {
  await getWorkerById(userId);

  const query = { user: userId };

  if (options.month) {
    const monthStart = new Date(`${options.month}-01T00:00:00.000Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

    query.startDate = { $lt: monthEnd };
    query.endDate = { $gte: monthStart };
  }

  const entries = await UnavailabilityModel.find(query).sort({
    startDate: 1,
  });

  return {
    success: true,
    data: entries.map(formatUnavailability),
  };
};

/**
 * Delete a worker's own unavailability entry
 * @param {string} userId - Authenticated user ID
 * @param {string} unavailabilityId - Entry ID
 * @returns {Promise<{success: boolean, message: string}>} Success response
 */
const deleteWorkerUnavailability = async (userId, unavailabilityId) => {
  await getWorkerById(userId);

  const deleted = await UnavailabilityModel.findOneAndDelete({
    _id: unavailabilityId,
    user: userId,
  });

  if (!deleted) {
    throw new AppError({
      message: "Unavailability entry not found",
      statusCode: 404,
      errorCode: "UNAVAILABILITY_NOT_FOUND",
    });
  }

  return {
    success: true,
    message: "Unavailability entry deleted successfully",
  };
};

export {
  getWorkerProfile,
  updateWorkerProfile,
  saveWorkerAvailability,
  getWorkerAvailability,
  createWorkerUnavailability,
  getWorkerUnavailability,
  deleteWorkerUnavailability,
};
