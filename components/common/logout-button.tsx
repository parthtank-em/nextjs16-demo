"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { logoutUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const onLogout = () => {
    startTransition(async () => {
      await logoutUser();
    });
  };

  return (
    <Button
      onClick={onLogout}
      disabled={isPending}
      variant="outline"
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      {isPending ? "Logging out..." : "Logout"}
    </Button>
  );
}
