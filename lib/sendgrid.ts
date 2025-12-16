import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
  console.error("SENDGRID_API_KEY is not defined in environment variables");
} else {
  sgMail.setApiKey(apiKey);
}

export const SENDGRID_TEMPLATES = {
  PASSWORD_RESET: process.env.SENDGRID_TEMPLATE_PASSWORD_RESET || "",
} as const;

export function sendEmailAsync<T extends (...args: any[]) => Promise<any>>(
  emailFn: T
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    setImmediate(async () => {
      try {
        await emailFn(...args);
        console.log("Email sent successfully");
      } catch (error) {
        console.error("Failed to send email:", error);
      }
    });
  };
}

export async function sendEmail({
  to,
  subject,
  templateId,
  dynamicTemplateData = {},
}: {
  to: string;
  subject: string;
  templateId: string;
  dynamicTemplateData?: Record<string, unknown>;
}) {
  const normalizedEmail = to.trim().toLowerCase();
  const fromEmail =
    process.env.SENDGRID_FROM_EMAIL || "noreply@scriptblend.com";

  try {
    const [response] = await sgMail.send({
      to: normalizedEmail,
      from: fromEmail,
      subject,
      templateId,
      dynamicTemplateData,
    });

    const messageId = response.headers["x-message-id"] || "unknown";

    return { success: true, messageId };
  } catch (error: any) {
    console.error(`Error sending email to ${normalizedEmail}:`, error);
    throw error;
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetToken: string,
  userName?: string
) {
  const resetLink = `${
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  }/reset-password?token=${resetToken}`;

  return sendEmail({
    to: email,
    subject: "Reset Your Password",
    templateId: SENDGRID_TEMPLATES.PASSWORD_RESET,
    dynamicTemplateData: {
      user_name: userName || "User",
      reset_link: resetLink,
      expiry_time: "1 hour",
    },
  });
}

export const sendPasswordResetEmailAsync = sendEmailAsync(
  sendPasswordResetEmail
);
