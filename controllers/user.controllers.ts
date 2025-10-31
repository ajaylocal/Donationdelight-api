import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { genToken, logger } from "~/utils";
import { Role, User } from "~/models";
import { IRole, IStore, type IUser } from "~/types";
import { Types } from "mongoose";
import { wsManager } from "~/utils/websocket";
import { emailService } from "~/utils/email";
import jwt from "jsonwebtoken";

// Helper function to mask email address for privacy
function maskEmail(email: string): string {
  if (!email) return "";
  const [localPart, domain] = email.split("@");
  if (!domain) return email;

  // Show only first character and last character of local part
  let maskedLocal = localPart;
  if (localPart.length > 2) {
    maskedLocal =
      localPart.charAt(0) +
      "*".repeat(localPart.length - 2) +
      localPart.charAt(localPart.length - 1);
  }

  // Mask domain except for the TLD
  const domainParts = domain.split(".");
  if (domainParts.length > 1) {
    const tld = domainParts.pop(); // Get the TLD (com, org, etc.)
    const domainName = domainParts.join(".");

    let maskedDomain = domainName;
    if (domainName.length > 2) {
      maskedDomain =
        domainName.charAt(0) +
        "*".repeat(domainName.length - 2) +
        domainName.charAt(domainName.length - 1);
    }

    return `${maskedLocal}@${maskedDomain}.${tld}`;
  }

  return `${maskedLocal}@${domain}`;
}

/**
 * @api {get} /users Get All Users
 * @apiGroup Users
 * @access Private
 */
export const getUsers = async (c: Context) => {
  try {
    logger.info("Fetching all users");

    const users = await User.find({ deletedAt: null })
      .sort({ createdAt: -1 }) // Newest first
      .lean(); // improves performance if you don't need methods like matchPassword

    logger.info(`Successfully fetched ${users.length} users`);

    return c.json({
      success: true,
      data: users,
      message: `${users.length} users found`,
    });
  } catch (error) {
    // If it's already an HTTPException, re-throw it as is
    if (error instanceof HTTPException) {
      throw error;
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching users", { error: errorMessage });

    throw new HTTPException(500, { message: "Failed to fetch users" });
  }
};

/**
 * @api {post} /users Create User
 * @apiGroup Users
 * @access Public
 */
export const createUser = async (c: Context) => {
  try {
    const currentUser = c.get("user") as IUser;
    const {
      username,
      firstName,
      lastName,
      email,
      password,
      phone,
      avatar,
      pin,
      updatedBy,
      role,
      store,
    } = await c.req.json();

    // ✅ Required fields check
    if (!username || !email || !password || !firstName) {
      throw new HTTPException(400, {
        message: "Username, email, password, and first name are required",
      });
    }

    // ✅ Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new HTTPException(400, {
        message: "Invalid email format",
      });
    }

    // ✅ Password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(password)) {
      throw new HTTPException(400, {
        message:
          "Password must contain at least 1 uppercase, 1 lowercase and 1 number",
      });
    }

    // ✅ Phone format validation (if present)
    if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone)) {
      throw new HTTPException(400, {
        message: "Invalid phone number format",
      });
    }

    // ✅ Store ID validation - use provided store or user's store
    let storeId = store;
    if (!storeId) {
      storeId =
        currentUser.store ||
        (currentUser.stores && currentUser.stores.length > 0
          ? currentUser.stores[0]
          : null);
      if (!storeId) {
        throw new HTTPException(400, {
          message:
            "Store is required. Please provide store in request body or ensure user has access to a store.",
        });
      }
    }

    // ✅ Role validation and role-based restrictions
    if (role) {
      if (!Types.ObjectId.isValid(role)) {
        throw new HTTPException(400, {
          message: "Invalid role ID format",
        });
      }

      const roleDoc = await Role.findById(role);
      if (!roleDoc) {
        throw new HTTPException(400, {
          message: "Role does not exist",
        });
      }

      // ✅ Role-based restrictions
      // Check if the role being assigned is a reserved role (admin or superadmin)
      const isReservedRole =
        roleDoc.isAdmin ||
        roleDoc.isSuperAdmin ||
        roleDoc.name === "admin" ||
        roleDoc.name === "superadmin";

      if (isReservedRole) {
        // Only superadmins can assign reserved roles
        if (!currentUser.isSuperAdmin) {
          throw new HTTPException(403, {
            message:
              "Only superadmins can create users with admin or superadmin roles",
          });
        }
      }
    }

    // ✅ Check if user already exists
    let existingUserQuery: any = {
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() },
      ],
    };

    // Remove PIN from uniqueness check since PIN should not be unique
    // if (pin) {
    //   existingUserQuery.$or.push({ pin })
    // }

    // Determine the store scope for uniqueness check
    let storeScope = storeId; // First try to get from request body

    // If not in request body, try to get from current user's store
    if (!storeScope) {
      storeScope =
        currentUser.store ||
        (currentUser.stores && currentUser.stores.length > 0
          ? currentUser.stores[0]
          : null);
    }

    // For admin/superadmin users (no store), email should be unique globally
    // For regular users (with store), check within the store scope
    if (storeScope) {
      // Add store restriction using $and to combine with the $or conditions
      existingUserQuery = {
        $and: [
          existingUserQuery,
          {
            $or: [
              { store: storeScope }, // Check single store field
              { stores: storeScope }, // Check stores array
            ],
          },
        ],
      };
    }

    const existingUser = await User.findOne(existingUserQuery);
    if (existingUser) {
      const scope = storeScope ? "in this store" : "globally";
      throw new HTTPException(400, {
        message: `User with this email or username already exists ${scope}`,
      });
    }

    // is createdBy is passed then the phone number is optional. Otherwise phone number required
    if (!updatedBy && !phone) {
      throw new HTTPException(400, {
        message: "Phone number is required unless created by another user",
      });
    }

    // ✅ Create user
    const user = await User.create({
      username: username.toLowerCase(),
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phone,
      avatar,
      pin,
      role,
      store: storeId, // Use the validated store ID (can be undefined for regular admins)
      createdBy: currentUser?._id, // Track who created this user
    });

    return c.json({
      success: true,
      data: user, // password is stripped by Mongoose's toJSON
      message: "User created successfully",
    });
  } catch (err: any) {
    console.error(err);
    throw new HTTPException(500, {
      message: err?.message || "Server error while creating user",
    });
  }
};

/**
 * @api {post} /users/login Login User
 * @apiGroup Users
 * @access Public
 */
export const loginUser = async (c: Context) => {
  try {
    const { user: userInput, password, store } = await c.req.json();

    // ✅ Check for required fields
    if (!password) {
      throw new HTTPException(400, {
        message: "Password is required",
      });
    }

    // ✅ Check for user field
    if (!userInput) {
      throw new HTTPException(400, {
        message: "User (email or username) is required",
      });
    }

    // ✅ Build user query
    const userQuery: any = {};

    // Determine if user field is email or username
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInput);

    if (isEmail) {
      userQuery.email = userInput.toLowerCase();
    } else {
      userQuery.username = userInput.toLowerCase();
    }

    if (store) {
      // If store is provided, find user in that specific store
      if (!Types.ObjectId.isValid(store)) {
        throw new HTTPException(400, {
          message: "Invalid store ID format",
        });
      }
      userQuery.store = store;
    }

    // ✅ Find user
    const user = await User.findOne(userQuery);
    if (!user) {
      throw new HTTPException(401, {
        message: "No user found with this email/username",
      });
    }

    // ✅ Check password match
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      throw new HTTPException(401, {
        message: "Invalid credentials",
      });
    }

    // ✅ Check if 2FA is enabled (if user has email in their record)
    if (user.email) {
      // Check if email service is configured
      if (!emailService.isConfigured()) {
        logger.warn("Email service not configured, proceeding without 2FA");
      } else {
        // Generate and send OTP
        const otp = user.createOTP(10); // 10 minutes expiry
        await user.save();

        // In development mode, use fixed OTP instead of sending email
        if (process.env.NODE_ENV === "development") {
          // Use fixed OTP for development
          const fixedOTP = "000000";
          user.otp = {
            code: fixedOTP,
            expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          };
          await user.save();

          logger.info("Development mode: Using fixed OTP", {
            userId: user._id,
            fixedOTP,
            originalEmail: user.email,
          });

          return c.json({
            success: true,
            data: {
              requiresOTP: true,
              message: "Development mode: Use OTP 000000",
              userId: user._id,
              email: maskEmail(user.email),
              developmentOTP: fixedOTP, // Include OTP in response for development
            },
            message: "Development mode: Use OTP 000000 for verification",
          });
        }

        // Send OTP email for production
        const emailSent = await emailService.sendOTPEmail({
          email: user.email,
          otp: otp,
          username: user.firstName,
        });

        if (!emailSent) {
          logger.error("Failed to send OTP email", {
            userId: user._id,
            email: user.email,
          });
          throw new HTTPException(500, {
            message: "Failed to send verification code. Please try again.",
          });
        }

        // Mask email address for privacy (show only first 3 characters and domain)
        const maskedEmail = maskEmail(user.email);

        return c.json({
          success: true,
          data: {
            requiresOTP: true,
            message: "Verification code sent to your email",
            userId: user._id,
            email: maskedEmail,
          },
          message: "Please enter the verification code sent to your email",
        });
      }
    }

    // ✅ Generate JWT (for users without email or when email service is not configured)
    const token = await genToken(user._id.toString());

    // Add store ID to user object
    const userObject = user.toObject({ versionKey: false }) as any;

    return c.json({
      success: true,
      data: {
        user: userObject, // Convert to plain object and remove version key
        token,
      },
      message: "User logged in successfully",
    });
  } catch (err: any) {
    console.error(err);
    throw new HTTPException(500, {
      message: err.message || "Server error during login",
    });
  }
};

/**
 * @api {post} /users/resend-otp Resend OTP
 * @apiGroup Users
 * @access Public
 */
/**
 * @api {post} /users/verify-otp Verify OTP
 * @apiGroup Users
 * @access Public
 */
export const verifyOTP = async (c: Context) => {
  try {
    const { userId, otp } = await c.req.json();

    // ✅ Check for required fields
    if (!userId || !otp) {
      throw new HTTPException(400, {
        message: "User ID and OTP are required",
      });
    }

    // ✅ Validate user ID format
    if (!Types.ObjectId.isValid(userId)) {
      throw new HTTPException(400, {
        message: "Invalid user ID format",
      });
    }

    // ✅ Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new HTTPException(404, {
        message: "User not found",
      });
    }

    if (!user.email) {
      throw new HTTPException(400, {
        message: "User does not have an email address",
      });
    }

    // ✅ Verify OTP
    const isValid = user.verifyOTP(otp);
    if (!isValid) {
      throw new HTTPException(401, {
        message: "Invalid or expired verification code",
      });
    }

    // ✅ Save user to clear the OTP
    await user.save();

    // ✅ Generate JWT
    const token = await genToken(user._id.toString());

    // Add store ID to user object
    const userObject = user.toObject({ versionKey: false }) as any;

    return c.json({
      success: true,
      data: {
        user: userObject,
        token,
      },
      message: "OTP verified successfully",
    });
  } catch (err: any) {
    console.error(err);
    throw new HTTPException(500, {
      message: err.message || "Server error during OTP verification",
    });
  }
};

/**
 * @api {post} /users/resend-otp Resend OTP
 * @apiGroup Users
 * @access Public
 */
export const resendOTP = async (c: Context) => {
  try {
    const { userId } = await c.req.json();

    // ✅ Check for required fields
    if (!userId) {
      throw new HTTPException(400, {
        message: "User ID is required",
      });
    }

    // ✅ Validate user ID format
    if (!Types.ObjectId.isValid(userId)) {
      throw new HTTPException(400, {
        message: "Invalid user ID format",
      });
    }

    // ✅ Find user
    const user = await User.findById(userId);

    if (!user) {
      throw new HTTPException(404, {
        message: "User not found",
      });
    }

    if (!user.email) {
      throw new HTTPException(400, {
        message: "User does not have an email address",
      });
    }

    // ✅ Check if email service is configured
    if (!emailService.isConfigured()) {
      throw new HTTPException(500, {
        message: "Email service is not configured",
      });
    }

    // ✅ Generate and send new OTP
    const otp = user.createOTP(10); // 10 minutes expiry
    await user.save();

    // In development mode, use fixed OTP instead of sending email
    if (process.env.NODE_ENV === "development") {
      // Use fixed OTP for development
      const fixedOTP = "123456";
      user.otp = {
        code: fixedOTP,
        expires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      };
      await user.save();

      logger.info("Development mode: Using fixed OTP for resend", {
        userId: user._id,
        fixedOTP,
        originalEmail: user.email,
      });

      return c.json({
        success: true,
        data: {
          message: "Development mode: Use OTP 123456",
          userId: user._id,
          email: maskEmail(user.email),
          developmentOTP: fixedOTP, // Include OTP in response for development
        },
        message: "Development mode: Use OTP 123456 for verification",
      });
    }

    // Send OTP email for production
    const emailSent = await emailService.sendOTPEmail({
      email: user.email,
      otp: otp,
      username: user.firstName,
    });

    if (!emailSent) {
      logger.error("Failed to send OTP email", {
        userId: user._id,
        email: user.email,
      });
      throw new HTTPException(500, {
        message: "Failed to send verification code. Please try again.",
      });
    }

    // Mask email address for privacy
    const maskedEmail = maskEmail(user.email);

    return c.json({
      success: true,
      data: {
        message: "Verification code sent to your email",
        userId: user._id,
        email: maskedEmail,
      },
      message: "Verification code sent successfully",
    });
  } catch (err: any) {
    console.error(err);
    throw new HTTPException(500, {
      message: err.message || "Server error while resending OTP",
    });
  }
};

/**
 * @api {post} /users/pin-login PIN Login
 * @apiGroup Users
 * @access Public
 * @bodyParam {string} storeSlug - Store slug
 * @bodyParam {string} user - Email or username
 * @bodyParam {string} pin - User PIN
 */
export const pinLogin = async (c: Context) => {
  try {
    const { storeSlug, user: userInput, pin } = await c.req.json();

    // ✅ Check for required fields
    if (!storeSlug || !userInput || !pin) {
      throw new HTTPException(400, {
        message: "Store slug, user (email/username), and PIN are required",
      });
    }

    // ✅ Determine if user field is email or username
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInput);

    // ✅ Find user by store and user field (check both store field and stores array)
    // For admin/superadmin, email is unique so no store restriction needed
    let userQuery: any = {
      [isEmail ? "email" : "username"]: userInput.toLowerCase(),
      pin,
      deletedAt: null,
    };

    const user = await User.findOne(userQuery);

    if (!user) {
      throw new HTTPException(401, {
        message: "Invalid credentials",
      });
    }

    // ✅ Check if user is active
    if (user.status !== "active") {
      throw new HTTPException(401, {
        message: "Account is not active",
      });
    }

    // ✅ Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // ✅ Generate JWT
    const token = await genToken(user._id.toString());

    // Add store ID to user object
    const userObject = user.toObject({ versionKey: false }) as any;

    return c.json({
      success: true,
      data: {
        user: userObject,
        token,
      },
      message: "User logged in successfully",
    });
  } catch (err: any) {
    console.error(err);
    throw new HTTPException(500, {
      message: err.message || "Server error during PIN login",
    });
  }
};

/**
 * @api {get} /users/:id Get Single User
 * @apiGroup Users
 * @access Private
 */
export const getUserById = async (c: Context) => {
  try {
    const id = c.req.param("id");
    const user = await User.findById(id).select("-password");

    if (!user) {
      throw new HTTPException(404, { message: "User not found" });
    }

    return c.json({ success: true, data: user });
  } catch (err: any) {
    throw new HTTPException(500, {
      message: err?.message || "Server error fetching user",
    });
  }
};

/**
 * @api {get} /users/profile Get User Profile
 * @apiGroup Users
 * @access Private
 */
export const getProfile = async (c: Context) => {
  const user = c.get("user") as IUser;

  // Get store data if user has a store
  let store: IStore | null = null;

  // Get role data
  let role: IRole | null | undefined = undefined;
  if (user.role) {
    role = await Role.findById(user.role).select("name").lean();
  }

  // Create response data with store and role information
  const responseData = {
    ...user,
    role,
  };

  return c.json({ success: true, data: responseData });
};

/**
 * @api {put} /users/profile Edit User Profile
 * @apiGroup Users
 * @access Private
 */
export const editProfile = async (c: Context) => {
  try {
    const userFromContext = c.get("user") as IUser;
    const { firstName, lastName, email, password, phone, pin } =
      await c.req.json();

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HTTPException(400, { message: "Invalid email format" });
    }

    if (phone && !/^\+?[1-9]\d{1,14}$/.test(phone)) {
      throw new HTTPException(400, { message: "Invalid phone number format" });
    }

    // Fetch the actual user document from database for updates
    const user = await User.findById(userFromContext._id);
    if (!user) {
      throw new HTTPException(404, { message: "User not found" });
    }

    // PIN validation (if provided)
    if (pin !== undefined) {
      if (
        pin &&
        (typeof pin !== "string" || pin.length < 4 || pin.length > 8)
      ) {
        throw new HTTPException(400, {
          message: "PIN must be between 4 and 8 characters",
        });
      }

      // Check if PIN is already used by another user in the same store
      const userStore =
        user.store ||
        (user.stores && user.stores.length > 0 ? user.stores[0] : null);
      if (pin && userStore) {
        const existingUser = await User.findOne({
          store: userStore,
          pin,
          _id: { $ne: user._id }, // Exclude current user
          deletedAt: null,
        });

        if (existingUser) {
          throw new HTTPException(400, {
            message: "PIN is already in use by another user in this store",
          });
        }
      }
    }

    if (firstName) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email) user.email = email.toLowerCase();
    if (phone) user.phone = phone;
    if (password) user.password = password;
    if (pin !== undefined) user.pin = pin || null; // Allow setting to null to remove PIN

    await user.save();

    let role: IRole | null | undefined = undefined;
    if (user.role) {
      role = await Role.findById(user.role).select("name").lean();
    }

    const updatedProfile = {
      ...user.toObject(),
      role,
    };

    // Send WebSocket notification for profile update
    try {
      wsManager.sendProfileUpdate(user._id.toString(), {
        action: "profile_updated",
        profile: updatedProfile,
        updatedFields: {
          firstName: firstName !== undefined,
          lastName: lastName !== undefined,
          email: email !== undefined,
          phone: phone !== undefined,
          pin: pin !== undefined,
          password: password !== undefined,
        },
      });
      logger.info(
        `Profile update WebSocket notification sent for user: ${user._id}`
      );
    } catch (error) {
      logger.error(
        "Failed to send WebSocket notification for profile update:",
        error
      );
    }

    return c.json({
      success: true,
      data: updatedProfile,
      message: "Profile updated successfully",
    });
  } catch (err: any) {
    throw new HTTPException(500, {
      message: err?.message || "Server error updating profile",
    });
  }
};

/**
 * @api {get} /users/staff Get Users Created by Current User
 * @apiGroup Users
 * @access Private
 * @queryParam {string} status - Filter by status (active, inactive, suspended)
 * @queryParam {string} role - Filter by role ID
 * @queryParam {string} search - Search by name, email, or username
 * @queryParam {number} page - Page number (default: 1)
 * @queryParam {number} limit - Items per page (default: 10, max: 100)
 * @queryParam {string} sort - Sort field (default: createdAt)
 * @queryParam {string} order - Sort order (asc, desc, default: desc)
 */
export const getUsersCreatedByMe = async (c: Context) => {
  try {
    const currentUser = c.get("user") as IUser;
    logger.info("Fetching users created by user:", currentUser._id);

    // Get query parameters
    const {
      status,
      role,
      search,
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "desc",
    } = c.req.query();

    // Build filter object
    const filter: any = {
      createdBy: new Types.ObjectId(currentUser._id),
      deletedAt: null, // Only non-deleted users
    };

    // Status filter
    if (status && ["active", "inactive", "suspended"].includes(status)) {
      filter.status = status;
    }

    // Role filter
    if (role && Types.ObjectId.isValid(role)) {
      filter.role = role;
    }

    // Search filter
    if (search?.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { username: searchRegex },
      ];
    }

    // Parse pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 10, 100);
    const skip = (pageNum - 1) * limitNum;

    // Parse sorting
    const sortOrder = order === "asc" ? 1 : -1;
    const sortObj: any = { [sort]: sortOrder };

    // Execute query with population
    const users = await User.find(filter)
      .populate("role", "name description")
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const total = await User.countDocuments(filter);

    return c.json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
      message: "Users fetched successfully",
    });
  } catch (error) {
    // If it's already an HTTPException, re-throw it as is
    if (error instanceof HTTPException) {
      throw error;
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Error fetching users created by me", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      fullError: error,
    });

    throw new HTTPException(500, { message: "Failed to fetch users" });
  }
};

/**
 * @api {post} /users/forget-password Forget Password
 * @apiGroup Users
 * @access Public
 */
export const forgetPassword = async (c: Context) => {
  try {
    const { email } = await c.req.json();

    // ✅ Check for required fields
    if (!email) {
      throw new HTTPException(400, {
        message: "Email is required",
      });
    }

    // ✅ Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new HTTPException(400, {
        message: "Invalid email format",
      });
    }

    // ✅ Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists or not for security
      return c.json({
        success: true,
        data: {
          message:
            "If an account with this email exists, a password reset link has been sent.",
        },
        message: "Password reset link sent successfully",
      });
    }

    // ✅ Check if email service is configured
    if (!emailService.isConfigured()) {
      throw new HTTPException(500, {
        message: "Email service is not configured",
      });
    }

    // ✅ Generate reset token (JWT with short expiry)
    const resetToken = await genToken(user._id.toString()); // 15 minutes expiry

    // ✅ Create reset token in user document
    (user as any).resetPasswordToken = resetToken;
    (user as any).resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    // ✅ Send magic link email
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/reset-password?token=${resetToken}`;

    const emailSent = await emailService.sendPasswordResetEmail({
      email: user.email,
      resetUrl,
      username: user.firstName,
    });

    if (!emailSent) {
      logger.error("Failed to send password reset email", {
        userId: user._id,
        email: user.email,
      });
      throw new HTTPException(500, {
        message: "Failed to send password reset link. Please try again.",
      });
    }

    return c.json({
      success: true,
      data: {
        message:
          "If an account with this email exists, a password reset link has been sent.",
      },
      message: "Password reset link sent successfully",
    });
  } catch (err: any) {
    console.error(err);
    throw new HTTPException(500, {
      message: err?.message || "Server error while processing password reset",
    });
  }
};

/**
 * @api {post} /users/reset-password Reset Password
 * @apiGroup Users
 * @access Public
 */
export const resetPassword = async (c: Context) => {
  try {
    const { token, newPassword, confirmPassword } = await c.req.json();

    // ✅ Check for required fields
    if (!token || !newPassword || !confirmPassword) {
      throw new HTTPException(400, {
        message: "Token, new password, and confirm password are required",
      });
    }

    // ✅ Validate password match
    if (newPassword !== confirmPassword) {
      throw new HTTPException(400, {
        message: "Passwords do not match",
      });
    }

    // ✅ Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(newPassword)) {
      throw new HTTPException(400, {
        message:
          "Password must contain at least 1 uppercase, 1 lowercase and 1 number",
      });
    }

    // ✅ Verify and decode token
    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      userId = decoded.id;
    } catch (error) {
      throw new HTTPException(401, {
        message: "Invalid or expired reset token",
      });
    }

    // ✅ Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new HTTPException(404, {
        message: "User not found",
      });
    }

    // ✅ Check if reset token matches and is not expired
    if (
      !(user as any).resetPasswordToken ||
      (user as any).resetPasswordToken !== token
    ) {
      throw new HTTPException(401, {
        message: "Invalid reset token",
      });
    }

    if (
      !(user as any).resetPasswordExpires ||
      new Date() > (user as any).resetPasswordExpires
    ) {
      throw new HTTPException(401, {
        message: "Reset token has expired",
      });
    }

    // ✅ Update password
    user.password = newPassword;
    (user as any).resetPasswordToken = undefined;
    (user as any).resetPasswordExpires = undefined;
    await user.save();

    return c.json({
      success: true,
      data: {
        message: "Password has been reset successfully",
      },
      message: "Password reset successfully",
    });
  } catch (err: any) {
    console.error(err);
    throw new HTTPException(500, {
      message: err?.message || "Server error while resetting password",
    });
  }
};
