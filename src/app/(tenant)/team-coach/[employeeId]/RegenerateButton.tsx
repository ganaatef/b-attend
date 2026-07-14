"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { regenerateEmployeeSnapshotAction } from "./actions";
import { RefreshCw, Loader2 } from "lucide-react";

export function RegenerateButton({ employeeId, periodStart, periodEnd }: { employeeId: string; periodStart: string; periodEnd: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  async function handleRegenerate() {
    setLoading(true);
    setResult(null);
    const r = await regenerateEmployeeSnapshotAction(employeeId, periodStart, periodEnd);
    setResult(r);
    setLoading(false);
    if (r.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={loading} onClick={handleRegenerate}>
        {loading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Regenerating...</> : <><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate snapshot</>}
      </Button>
      {result?.error && <span className="text-xs text-destructive">{result.error}</span>}
      {result?.ok && <span className="text-xs text-brand-success">Snapshot regenerated.</span>}
    </div>
  );
}
