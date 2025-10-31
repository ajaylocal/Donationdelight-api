export const TIMEZONE = process.env.TIMEZONE || "America/Toronto";
// Emailit:
export const FROM_EMAIL = process.env.FROM_EMAIL;
export const EMAILIT_API_BASE =
  process.env.EMAILIT_API_BASE || "https://api.emailit.com/v1";
export const EMAILIT_API_KEY = process.env.EMAILIT_API_KEY;

// GoHighLevel API Configuration
export const GHL_API_BASE =
  process.env.GHL_API_BASE || "https://services.leadconnectorhq.com";

// Import for GHL token retrieval
import { safeDecrypt } from "./encryption";
import { Types } from "mongoose";
