import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import ResetPasswordForm from "./reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { verifyResetToken } from "@/actions/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ResetPasswordPageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const token = (await searchParams).token;

  // If no token provided, show error
  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 mb-2 text-destructive" />
            <CardTitle className="text-2xl">Invalid Reset Link</CardTitle>
            <CardDescription>
              Invalid reset link. Please request a new password reset.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password">
              <Button className="w-full">Request New Reset Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Verify token on server side
  const verificationResult = await verifyResetToken(token);

  // If token is invalid or expired, show error
  if (!verificationResult.valid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 mb-2 text-destructive" />
            <CardTitle className="text-2xl">Invalid Reset Link</CardTitle>
            <CardDescription>Invalid or expired reset link</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password">
              <Button className="w-full">Request New Reset Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token is valid, render the reset password form
  return <ResetPasswordForm token={token} />;
}
