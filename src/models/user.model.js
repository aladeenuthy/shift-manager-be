import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "worker"],
    default: "worker",
    required: true,
  },
  passwordResetTokenHash: { type: String, required: false },
  passwordResetTokenExpiry: { type: Date, required: false },
  otpHash: { type: String, required: false },
  otpExpiry: { type: Date, required: false },
  otpLastSentAt: { type: Date, required: false },
  isEmailVerified: { type: Boolean, default: false },
  phone: { type: String, required: false },
  city: { type: String, required: false },
  jobRole: { type: String, required: false },
  skills: [{ type: String }],
  profilePictureUrl: { type: String, default: null },
  isProfileComplete: { type: Boolean, default: false },
});

const UserModel = mongoose.model("User", userSchema);
export default UserModel;
