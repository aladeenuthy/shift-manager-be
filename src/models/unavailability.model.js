import mongoose from "mongoose";
import "./user.model.js";

const UnavailabilitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
    },
  },
  { timestamps: true },
);

UnavailabilitySchema.index({ user: 1, startDate: 1, endDate: 1 });

export default mongoose.model("Unavailability", UnavailabilitySchema);
