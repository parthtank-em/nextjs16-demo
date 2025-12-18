"use server";

import { z } from "zod";
import crypto from "crypto";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getSession } from "@/lib/session";
import {
  sendInvitationEmailAs,
  sendInvitationEmailAsync,
} from "@/lib/sendgrid";

// Validation schemas
const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  role: z.enum(["ADMIN", "USER"]),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Get all users with pagination
export async function getUsers(page: number = 1, limit: number = 10) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as count FROM auth
    `;
    const totalCount = (countResult as Array<{ count: string }>)[0].count;

    // Get users with profiles
    const usersResult = await sql`
      SELECT 
        a.id,
        a.email,
        a.role,
        a.created_at,
        COALESCE(up.first_name, ad.first_name) as first_name,
        COALESCE(up.last_name, ad.last_name) as last_name
      FROM auth a
      LEFT JOIN user_profiles up ON a.id = up.user_id
      LEFT JOIN admins ad ON a.id = ad.user_id
      ORDER BY a.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const users = usersResult as Array<{
      id: string;
      email: string;
      role: string;
      created_at: string;
      first_name: string;
      last_name: string;
    }>;

    return {
      success: true,
      data: {
        users,
        total: parseInt(totalCount),
        page,
        limit,
        totalPages: Math.ceil(parseInt(totalCount) / limit),
      },
    };
  } catch (error) {
    console.error("Get users error:", error);
    return {
      success: false,
      error: "Failed to fetch users",
    };
  }
}

// Invite user
export async function inviteUser(data: unknown) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    const validatedData = inviteUserSchema.parse(data);

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM auth WHERE email = ${validatedData.email}
    `;

    if ((existingUser as Array<any>).length > 0) {
      return {
        success: false,
        error: "User with this email already exists",
      };
    }

    // Check if there's a pending invitation
    const existingInvitation = await sql`
      SELECT id FROM invitations 
      WHERE email = ${validatedData.email} 
      AND status = 'PENDING'
      AND expires_at > NOW()
    `;

    if ((existingInvitation as Array<any>).length > 0) {
      return {
        success: false,
        error: "A pending invitation already exists for this email",
      };
    }

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(invitationToken)
      .digest("hex");

    // Set expiry to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create invitation
    const invitationResult = await sql`
      INSERT INTO invitations (
        email, 
        first_name, 
        last_name, 
        role, 
        invitation_token, 
        invited_by, 
        expires_at
      )
      VALUES (
        ${validatedData.email},
        ${validatedData.firstName},
        ${validatedData.lastName},
        ${validatedData.role},
        ${hashedToken},
        ${session.id},
        ${expiresAt.toISOString()}
      )
      RETURNING id
    `;

    const invitation = (invitationResult as Array<{ id: string }>)[0];

    if (!invitation) {
      return {
        success: false,
        error: "Failed to create invitation",
      };
    }

    sendInvitationEmailAsync(
      validatedData.email,
      invitationToken,
      {
        first_name: validatedData.firstName,
        last_name: validatedData.lastName,
        role: validatedData.role,
      },
      `${session.firstName} ${session.lastName}`
    );

    return {
      success: true,
      message: "Invitation sent successfully",
    };
  } catch (error) {
    console.error("Invite user error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input data",
      };
    }

    return {
      success: false,
      error: "Failed to send invitation",
    };
  }
}

// Get all invitations
export async function getInvitations(page: number = 1, limit: number = 10) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as count FROM invitations
    `;
    const totalCount = (countResult as Array<{ count: string }>)[0].count;

    // Get invitations
    const invitationsResult = await sql`
      SELECT 
        i.id,
        i.email,
        i.first_name,
        i.last_name,
        i.role,
        i.status,
        i.created_at,
        i.expires_at,
        i.accepted_at,
        a.email as invited_by_email
      FROM invitations i
      LEFT JOIN auth a ON i.invited_by = a.id
      ORDER BY i.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const invitations = invitationsResult as Array<any>;

    return {
      success: true,
      data: {
        invitations,
        total: parseInt(totalCount),
        page,
        limit,
        totalPages: Math.ceil(parseInt(totalCount) / limit),
      },
    };
  } catch (error) {
    console.error("Get invitations error:", error);
    return {
      success: false,
      error: "Failed to fetch invitations",
    };
  }
}

// Resend invitation
export async function resendInvitation(invitationId: string) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    // Get invitation details
    const invitationResult = await sql`
      SELECT * FROM invitations WHERE id = ${invitationId}
    `;

    const invitations = invitationResult as Array<any>;

    if (invitations.length === 0) {
      return {
        success: false,
        error: "Invitation not found",
      };
    }

    const invitation = invitations[0];

    // Generate new token
    const invitationToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(invitationToken)
      .digest("hex");

    // Set new expiry to 7 days from now
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Update invitation
    await sql`
      UPDATE invitations 
      SET 
        invitation_token = ${hashedToken},
        status = 'PENDING',
        expires_at = ${expiresAt.toISOString()},
        updated_at = NOW()
      WHERE id = ${invitationId}
    `;

    sendInvitationEmailAsync(
      invitation.email,
      invitationToken,
      {
        first_name: invitation.first_name,
        last_name: invitation.last_name,
        role: invitation.role,
      },
      `${session.firstName} ${session.lastName}`
    );

    return {
      success: true,
      message: "Invitation resent successfully",
    };
  } catch (error) {
    console.error("Resend invitation error:", error);
    return {
      success: false,
      error: "Failed to resend invitation",
    };
  }
}

// Expire invitation
export async function expireInvitation(invitationId: string) {
  try {
    const session = await getSession();

    if (!session || session.role !== "ADMIN") {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    await sql`
      UPDATE invitations 
      SET 
        status = 'EXPIRED',
        updated_at = NOW()
      WHERE id = ${invitationId}
    `;

    return {
      success: true,
      message: "Invitation expired successfully",
    };
  } catch (error) {
    console.error("Expire invitation error:", error);
    return {
      success: false,
      error: "Failed to expire invitation",
    };
  }
}

// Verify invitation token
export async function verifyInvitationToken(token: string) {
  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const result = await sql`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        role,
        expires_at
      FROM invitations 
      WHERE 
        invitation_token = ${hashedToken}
        AND status = 'PENDING'
        AND expires_at > NOW()
    `;

    const invitations = result as Array<any>;

    if (invitations.length === 0) {
      return {
        valid: false,
        error: "Invalid or expired invitation",
      };
    }

    return {
      valid: true,
      invitation: invitations[0],
    };
  } catch (error) {
    console.error("Verify invitation token error:", error);
    return {
      valid: false,
      error: "Failed to verify invitation",
    };
  }
}

// Accept invitation and create account
export async function acceptInvitation(data: unknown) {
  try {
    const validatedData = acceptInvitationSchema.parse(data);

    // Hash the token to find invitation
    const hashedToken = crypto
      .createHash("sha256")
      .update(validatedData.token)
      .digest("hex");

    // Find valid invitation
    const invitationResult = await sql`
      SELECT * FROM invitations 
      WHERE 
        invitation_token = ${hashedToken}
        AND status = 'PENDING'
        AND expires_at > NOW()
    `;

    const invitations = invitationResult as Array<any>;

    if (invitations.length === 0) {
      return {
        success: false,
        error: "Invalid or expired invitation",
      };
    }

    const invitation = invitations[0];

    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM auth WHERE email = ${invitation.email}
    `;

    if ((existingUser as Array<any>).length > 0) {
      return {
        success: false,
        error: "An account with this email already exists",
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(validatedData.password);

    // Create user in auth table
    const authResult = await sql`
      INSERT INTO auth (email, password_hash, role) 
      VALUES (
        ${invitation.email}, 
        ${hashedPassword}, 
        ${invitation.role}
      ) 
      RETURNING id, email, role
    `;

    const authUsers = authResult as Array<{
      id: string;
      email: string;
      role: string;
    }>;
    const authUser = authUsers[0];

    if (!authUser) {
      return {
        success: false,
        error: "Failed to create account",
      };
    }

    // Create profile based on role
    if (invitation.role === "ADMIN") {
      await sql`
        INSERT INTO admins (user_id, first_name, last_name)
        VALUES (
          ${authUser.id},
          ${invitation.first_name},
          ${invitation.last_name}
        )
      `;
    } else {
      await sql`
        INSERT INTO user_profiles (user_id, first_name, last_name)
        VALUES (
          ${authUser.id},
          ${invitation.first_name},
          ${invitation.last_name}
        )
      `;
    }

    // Update invitation status
    await sql`
      UPDATE invitations 
      SET 
        status = 'ACCEPTED',
        accepted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${invitation.id}
    `;

    return {
      success: true,
      message: "Account created successfully. You can now login.",
    };
  } catch (error) {
    console.error("Accept invitation error:", error);

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: "Invalid input data",
      };
    }

    return {
      success: false,
      error: "Failed to create account",
    };
  }
}
