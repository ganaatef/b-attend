// ===================================================================
// LogoutButton — client component wrapping a server action form.
// ===================================================================

"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/(auth)/actions";

export function LogoutButton({
  variant = "ghost",
  size = "sm",
  className,
}: {
  variant?: "ghost" | "outline" | "default";
  size?: "sm" | "default" | "icon";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() => startTransition(async () => { await logoutAction(); })}
    >
      <LogOut className="h-4 w-4" />
      {size === "icon" ? null : <span>{pending ? "Logging out…" : "Logout"}</span>}
    </Button>
  );
}
