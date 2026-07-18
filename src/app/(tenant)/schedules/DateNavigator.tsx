"use client";

import { useRouter } from "next/navigation";

export function DateNavigator({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      defaultValue={defaultValue}
      onChange={(e) => router.push(`/schedules?date=${e.target.value}`)}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs"
    />
  );
}
