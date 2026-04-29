import { z } from "zod";
import { zodSchemaValidator } from "../utils/errors/utils.js";
import {
  getWorkerProfile,
  updateWorkerProfile,
} from "../services/worker/index.js";

/** @typedef {import('express').Request} Request */
/** @typedef {import('express').Response} Response */
/** @typedef {import('express').NextFunction} NextFunction */

const schemaUpdateWorkerProfile = z.object({
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

export { getWorkerProfileController, updateWorkerProfileController };
