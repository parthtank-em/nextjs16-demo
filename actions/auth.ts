"use server";

import { z } from "zod";
import crypto from "crypto";
import { redirect } from "next/navigation";

import { sql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession, deleteSession } from "@/lib/session";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth.schema";
import { sendPasswordResetEmailAsync } from "@/lib/sendgrid";

interface AuthUser {
  id: string;
  email: string;
  password_hash: string;
  role: "ADMIN" | "USER";
}

interface UserProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

interface AdminProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

export async function registerUser(data: unknown) {
  try {
    // Validate input
    const validatedData = registerSchema.parse(data);

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM auth WHERE email = ${validatedData.email}
    `;

    const users = existingUser as Array<{ id: string }>;

    if (users.length > 0) {
      return {
        success: false,
        error: "User with this email already exists",
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Insert user into auth table with USER role by default
    const authResult = await sql`
      INSERT INTO auth (email, password_hash, role) 
      VALUES (
        ${validatedData.email}, 
        ${hashedPassword}, 
        'USER'
      ) 
      RETURNING id, email, role
    `;

    const insertedAuthUsers = authResult as Array<{
      id: string;
      email: string;
      role: string;
    }>;
    const authUser = insertedAuthUsers[0];

    if (!authUser) {
      return {
        success: false,
        error: "Failed to create user",
      };
    }

    // Insert into user_profiles table
    const profileResult = await sql`
      INSERT INTO user_profiles (user_id, first_name, last_name)
      VALUES (
        ${authUser.id},
        ${validatedData.firstName},
        ${validatedData.lastName}
      )
      RETURNING id, first_name, last_name
    `;

    const insertedProfiles = profileResult as Array<{
      id: string;
      first_name: string;
      last_name: string;
    }>;
    const profile = insertedProfiles[0];

    if (!profile) {
      // Rollback: delete the auth entry if profile creation fails
      await sql`DELETE FROM auth WHERE id = ${authUser.id}`;
      return {
        success: false,
        error: "Failed to create user profile",
      };
    }

    // Create session
    await createSession({
      id: authUser.id,
      email: authUser.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      role: authUser.role as "ADMIN" | "USER",
    });

    return {
      success: true,
      message: "Registration successful",
    };
  } catch (error) {
    console.error("Registration error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input data",
      };
    }

    return {
      success: false,
      error: "Registration failed. Please try again.",
    };
  }
}

export async function loginUser(data: unknown) {
  try {
    // Validate input
    const validatedData = loginSchema.parse(data);

    // Get user by email from auth table
    const authResult = await sql`
      SELECT id, email, password_hash, role 
      FROM auth 
      WHERE email = ${validatedData.email}
    `;

    const authUsers = authResult as AuthUser[];

    if (authUsers.length === 0) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    const authUser = authUsers[0];

    // Verify password
    const isValidPassword = await verifyPassword(
      validatedData.password,
      authUser.password_hash
    );

    if (!isValidPassword) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    // Get profile data based on role
    let firstName = "";
    let lastName = "";

    if (authUser.role === "ADMIN") {
      const adminResult = await sql`
        SELECT first_name, last_name 
        FROM admins 
        WHERE user_id = ${authUser.id}
      `;
      const admins = adminResult as AdminProfile[];
      if (admins.length > 0) {
        firstName = admins[0].first_name;
        lastName = admins[0].last_name;
      }
    } else {
      const profileResult = await sql`
        SELECT first_name, last_name 
        FROM user_profiles 
        WHERE user_id = ${authUser.id}
      `;
      const profiles = profileResult as UserProfile[];
      if (profiles.length > 0) {
        firstName = profiles[0].first_name;
        lastName = profiles[0].last_name;
      }
    }

    // Create session
    await createSession({
      id: authUser.id,
      email: authUser.email,
      firstName,
      lastName,
      role: authUser.role,
    });

    return {
      success: true,
      user: {
        id: authUser.id,
        email: authUser.email,
        firstName,
        lastName,
        role: authUser.role,
      },
    };
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input data",
      };
    }

    return {
      success: false,
      error: "Login failed. Please try again.",
    };
  }
}

export async function logoutUser() {
  try {
    await deleteSession();
  } catch (error) {
    console.error("Logout error:", error);
  }
  redirect("/login");
}

export async function forgotPassword(data: unknown) {
  try {
    // Validate input
    const validatedData = forgotPasswordSchema.parse(data);

    // Check if user exists
    const authResult = await sql`
      SELECT id, email, role 
      FROM auth 
      WHERE email = ${validatedData.email}
    `;

    const users = authResult as Array<{
      id: string;
      email: string;
      role: string;
    }>;

    // Always return success to prevent email enumeration
    if (users.length === 0) {
      return {
        success: true,
        message:
          "If an account exists with this email, you will receive a password reset link.",
      };
    }

    const user = users[0];

    // Get user's name based on role
    let firstName = "User";
    if (user.role === "ADMIN") {
      const adminResult = await sql`
        SELECT first_name FROM admins WHERE user_id = ${user.id}
      `;
      const admins = adminResult as Array<{ first_name: string }>;
      if (admins.length > 0) firstName = admins[0].first_name;
    } else {
      const profileResult = await sql`
        SELECT first_name FROM user_profiles WHERE user_id = ${user.id}
      `;
      const profiles = profileResult as Array<{ first_name: string }>;
      if (profiles.length > 0) firstName = profiles[0].first_name;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set token expiry (1 hour from now)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store hashed token in database
    await sql`
      UPDATE auth 
      SET 
        password_reset_token = ${hashedToken},
        password_reset_expires = ${expiresAt.toISOString()}
      WHERE id = ${user.id}
    `;

    // Send email with plain token (not hashed)
    sendPasswordResetEmailAsync(user.email, resetToken, firstName);

    return {
      success: true,
      message:
        "If an account exists with this email, you will receive a password reset link.",
    };
  } catch (error) {
    console.error("Forgot password error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid email address",
      };
    }

    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

export async function resetPassword(data: unknown) {
  try {
    // Validate input
    const validatedData = resetPasswordSchema.parse(data);

    // Hash the token from URL to compare with stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(validatedData.token)
      .digest("hex");

    // Find user with valid token
    const authResult = await sql`
      SELECT id, email 
      FROM auth 
      WHERE 
        password_reset_token = ${hashedToken}
        AND password_reset_expires > NOW()
    `;

    const users = authResult as Array<{ id: string; email: string }>;

    if (users.length === 0) {
      return {
        success: false,
        error: "Invalid or expired reset token. Please request a new one.",
      };
    }

    const user = users[0];

    // Hash new password
    const hashedPassword = await hashPassword(validatedData.password);

    // Update password and clear reset token
    await sql`
      UPDATE auth 
      SET 
        password_hash = ${hashedPassword},
        password_reset_token = NULL,
        password_reset_expires = NULL,
        password_updated_at = NOW(),
        updated_at = NOW()
      WHERE id = ${user.id}
    `;

    return {
      success: true,
      message:
        "Password reset successful. You can now login with your new password.",
    };
  } catch (error) {
    console.error("Reset password error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input data",
      };
    }

    return {
      success: false,
      error: "Failed to reset password. Please try again.",
    };
  }
}

export async function verifyResetToken(token: string) {
  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const result = await sql`
      SELECT id 
      FROM auth 
      WHERE 
        password_reset_token = ${hashedToken}
        AND password_reset_expires > NOW()
    `;

    const users = result as Array<{ id: string }>;

    return {
      valid: users.length > 0,
    };
  } catch (error) {
    console.error("Verify token error:", error);
    return {
      valid: false,
    };
  }
}
