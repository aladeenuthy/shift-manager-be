import mongoose from "mongoose";
import "./user.model.js";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const WeeklyScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: DAYS_OF_WEEK,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    startTime: {
      type: String,
      default: "08:00",
    },
    endTime: {
      type: String,
      default: "21:00",
    },
  },
  { _id: false },
);

const AvailabilitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    weeklySchedule: {
      type: [WeeklyScheduleSchema],
      required: true,
    },
  },
  { timestamps: true },
);

export { DAYS_OF_WEEK };
export default mongoose.model("Availability", AvailabilitySchema);
