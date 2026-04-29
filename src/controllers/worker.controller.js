import { z } from "zod";
import mongoose from "mongoose";
import dayjs from "dayjs";
import { zodSchemaValidator } from "../utils/errors/utils.js";
import { isDateInPast, isValidTimeString } from "../utils/datetime.js";
import { DAYS_OF_WEEK } from "../models/availability.model.js";
import {
  createWorkerUnavailability,
  deleteWorkerUnavailability,
  getWorkerAvailability,
  getWorkerProfile,
  getWorkerUnavailability,
  saveWorkerAvailability,
  updateWorkerProfile,
} from "../services/worker/index.js";

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('express').NextFunction} NextFunction */

const schemaUpdateWorkerProfile = z.object({
  name: z
    .string({ error: "Name must be a string" })
    .trim()
    .nonempty({ error: "Name cannot be empty" })
    .optional(),
  phone: z
    .string({ error: "Phone must be a string" })
    .trim()
    .nonempty({ error: "Phone cannot be empty" })
    .optional(),
  city: z
    .string({ error: "City must be a string" })
    .trim()
    .nonempty({ error: "City cannot be empty" })
    .optional(),
  jobRole: z
    .string({ error: "Job role must be a string" })
    .trim()
    .nonempty({ error: "Job role cannot be empty" })
    .optional(),
  skills: z
    .array(
      z
        .string({ error: "Skill must be a string" })
        .trim()
        .nonempty({ error: "Skill cannot be empty" }),
      { error: "Skills must be an array" },
    )
    .optional(),
});

const objectIdValidator = (/** @type {string} */ errorMessage) =>
  z.string({ error: errorMessage }).refine(
    (val) => {
      return mongoose.Types.ObjectId.isValid(val);
    },
    {
      error: errorMessage,
    },
  );

const timeValidator = z
  .string({ error: "Time must be in HH:MM format" })
  .refine(
    (val) => {
      return isValidTimeString(val);
    },
    {
      error: "Time must be in HH:MM format",
    },
  );

const dateValidator = z.string({ error: "Invalid date" }).refine(
  (val) => {
    const date = dayjs(val);
    if (!date.isValid()) {
      return false;
    }
    return !isDateInPast(val);
  },
  {
    error: "Date cannot be in the past and must be a valid date",
  },
);

const schemaAvailabilityDay = z.object({
  day: z.enum(DAYS_OF_WEEK, { error: "Invalid day" }),
  isAvailable: z.boolean({ error: "Availability must be true or false" }),
  startTime: timeValidator.optional().default("08:00"),
  endTime: timeValidator.optional().default("21:00"),
});

const schemaWorkerAvailability = z.object({
  weeklySchedule: z
    .array(schemaAvailabilityDay, { error: "Weekly schedule must be an array" })
    .min(1, { error: "At least one availability day is required" }),
});

const schemaUnavailableDate = z
  .object({
    startDate: dateValidator,
    endDate: dateValidator,
    reason: z.string({ error: "Reason must be a string" }).trim().optional(),
  })
  .refine(
    (data) => {
      return !dayjs(data.startDate).isAfter(dayjs(data.endDate));
    },
    {
      path: ["endDate"],
      error: "End date must be the same as or after start date",
    },
  )
  .transform((data) => ({
    ...data,
    startDate: dayjs(data.startDate).startOf("day").toDate(),
    endDate: dayjs(data.endDate).startOf("day").toDate(),
  }));

const schemaWorkerUnavailability = z.object({
  unavailableDates: z
    .array(schemaUnavailableDate, {
      error: "Unavailable dates must be an array",
    })
    .min(1, { error: "At least one unavailable date range is required" }),
});

const schemaUnavailabilityQuery = z.object({
  month: z
    .string({ error: "Month must be in YYYY-MM format" })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, {
      error: "Month must be in YYYY-MM format",
    })
    .optional(),
});

/**
 * Controller to get authenticated worker profile
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const getWorkerProfileController = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    res.status(200).json(await getWorkerProfile(userId));
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to update authenticated worker profile
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const updateWorkerProfileController = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const validatedData = zodSchemaValidator(
      schemaUpdateWorkerProfile,
      req.body,
    );
    res.status(200).json(await updateWorkerProfile(userId, validatedData));
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to save authenticated worker availability
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const saveWorkerAvailabilityController = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const validatedData = zodSchemaValidator(
      schemaWorkerAvailability,
      req.body,
    );
    res
      .status(200)
      .json(await saveWorkerAvailability(userId, validatedData.weeklySchedule));
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to get authenticated worker availability
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const getWorkerAvailabilityController = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    res.status(200).json(await getWorkerAvailability(userId));
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to create authenticated worker unavailability entries
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const createWorkerUnavailabilityController = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const validatedData = zodSchemaValidator(
      schemaWorkerUnavailability,
      req.body,
    );
    res
      .status(201)
      .json(
        await createWorkerUnavailability(
          userId,
          validatedData.unavailableDates,
        ),
      );
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to get authenticated worker unavailability entries
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const getWorkerUnavailabilityController = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const options = zodSchemaValidator(schemaUnavailabilityQuery, req.query);
    res.status(200).json(await getWorkerUnavailability(userId, options));
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to delete authenticated worker unavailability entry
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
const deleteWorkerUnavailabilityController = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;

    zodSchemaValidator(objectIdValidator("Invalid unavailability ID"), id);

    res.status(200).json(await deleteWorkerUnavailability(userId, id));
  } catch (error) {
    next(error);
  }
};

export {
  getWorkerProfileController,
  updateWorkerProfileController,
  saveWorkerAvailabilityController,
  getWorkerAvailabilityController,
  createWorkerUnavailabilityController,
  getWorkerUnavailabilityController,
  deleteWorkerUnavailabilityController,
};
