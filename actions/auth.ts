"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { sql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession, deleteSession } from "@/lib/session";
import { loginSchema, registerSchema } from "@/lib/validations/auth.schema";

// Define user type for better type safety
interface User {
  id: number;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export async function registerUser(data: unknown) {
  try {
    // Validate input
    const validatedData = registerSchema.parse(data);

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${validatedData.email}
    `;

    // Type assertion for array results
    const users = existingUser as Array<{ id: number }>;

    if (users.length > 0) {
      return {
        success: false,
        error: "User with this email already exists",
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Insert user
    const result = await sql`
      INSERT INTO users (email, password, first_name, last_name) 
      VALUES (
        ${validatedData.email}, 
        ${hashedPassword}, 
        ${validatedData.firstName}, 
        ${validatedData.lastName}
      ) 
      RETURNING id, email, first_name, last_name
    `;

    const insertedUsers = result as Array<Omit<User, "password">>;
    const user = insertedUsers[0];

    if (!user) {
      return {
        success: false,
        error: "Failed to create user",
      };
    }

    // Create session
    await createSession({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
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

    // Get user by email
    const result = await sql`
      SELECT id, email, password, first_name, last_name 
      FROM users 
      WHERE email = ${validatedData.email}
    `;

    // Type assertion for array results
    const users = result as User[];

    if (users.length === 0) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await verifyPassword(
      validatedData.password,
      user.password
    );

    if (!isValidPassword) {
      return {
        success: false,
        error: "Invalid email or password",
      };
    }

    // Create session
    await createSession({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
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
