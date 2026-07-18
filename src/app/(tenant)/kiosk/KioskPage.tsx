"use client";

/**
 * /kiosk — Kiosk mode for shared tablets.
 */
import { useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clockAction, kioskLookupAction } from "../clock/actions";
import type { Branch } from "@prisma/client";
import { Loader2, LogIn, LogOut, Search, RotateCcw } from "lucide-react";
import { useLocale } from "next-intl";
import { employeeDisplayName } from "@/lib/employee-display";

interface KioskProps {
  branches: Branch[];
}

export function KioskPage({ branches }: KioskProps) {
  const locale = useLocale();
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [lookup, setLookup] = useState<{ ok: boolean; error?: string; employee?: any; schedule?: any; lastPunch?: any; nextAction?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [clockResult, setClockResult] = useState<{ ok: boolean; error?: string; insideGeofence?: boolean; distanceMeters?: number; type?: string } | null>(null);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setClockResult(null);
    const fd = new FormData();
    fd.set("branchId", branchId);
    fd.set("code", code);
    fd.set("pin", pin);
    const r = await kioskLookupAction({}, fd);
    setLookup(r);
    setPending(false);
  }

  async function handleClock(type: "CLOCK_IN" | "CLOCK_OUT") {
    if (!lookup?.employee) return;
    setPending(true);
    setClockResult(null);
    const fd = new FormData();
    fd.set("employeeId", lookup.employee.id);
    fd.set("type", type);
    fd.set("latitude", "0");
    fd.set("longitude", "0");
    fd.set("source", "KIOSK");
    const r = await clockAction({}, fd);
    setClockResult(r);
    setPending(false);
    if (r.ok) {
      setTimeout(() => {
        setLookup(null);
        setCode("");
        setPin("");
        setClockResult(null);
      }, 2500);
    }
  }

  function reset() {
    setLookup(null);
    setCode("");
    setPin("");
    setClockResult(null);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Kiosk Mode</h1>
        <p className="text-sm text-muted-foreground">Enter your employee code or PIN to clock in/out.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4">
            <Label htmlFor="branchId" className="text-sm font-medium">Branch</Label>
            <Select value={branchId} onValueChange={(v) => { setBranchId(v); reset(); }}>
              <SelectTrigger id="branchId" className="mt-1 h-12 text-base"><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {!lookup?.ok ? (
            <form onSubmit={handleLookup} className="space-y-3">
              <div>
                <Label htmlFor="code" className="text-sm font-medium">Employee code</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="mt-1 h-14 text-center text-2xl tracking-widest" placeholder="EMP001" autoFocus />
              </div>
              <div className="text-center text-xs text-muted-foreground">— or —</div>
              <div>
                <Label htmlFor="pin" className="text-sm font-medium">PIN</Label>
                <Input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} className="mt-1 h-14 text-center text-2xl tracking-widest" placeholder="0000" />
              </div>
              {lookup?.error && <p className="text-sm text-destructive text-center">{lookup.error}</p>}
              <Button type="submit" size="lg" className="w-full h-14 text-base" disabled={pending || !branchId || (!code && !pin)}>
                {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Search className="mr-2 h-5 w-5" /> Find employee</>}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card/50 p-4 text-center">
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent/10 text-2xl font-bold text-brand-accent">
                  {employeeDisplayName(lookup.employee, locale).charAt(0).toUpperCase()}
                </div>
                <p className="text-lg font-semibold text-foreground">{employeeDisplayName(lookup.employee, locale)}</p>
                <p className="text-sm text-muted-foreground">{lookup.employee.employeeCode} · {lookup.employee.jobTitle ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{lookup.employee.branchName ?? "—"}</p>
                {lookup.schedule && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Shift: {lookup.schedule.policyName} · {lookup.schedule.expectedStart ? new Date(lookup.schedule.expectedStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} → {lookup.schedule.expectedEnd ? new Date(lookup.schedule.expectedEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                )}
              </div>

              {clockResult?.ok ? (
                <div className="rounded-lg border border-brand-success/30 bg-brand-success/5 p-4 text-center">
                  <p className="text-lg font-semibold text-brand-success">{clockResult.type === "CLOCK_IN" ? "Clocked In" : "Clocked Out"}</p>
                  <p className="text-sm text-muted-foreground">{new Date().toLocaleTimeString()}</p>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full h-16 text-lg"
                  disabled={pending}
                  onClick={() => handleClock(lookup.nextAction as "CLOCK_IN" | "CLOCK_OUT")}
                >
                  {pending ? <Loader2 className="h-6 w-6 animate-spin" /> :
                    lookup.nextAction === "CLOCK_IN" ? <><LogIn className="mr-2 h-6 w-6" /> Clock In</> : <><LogOut className="mr-2 h-6 w-6" /> Clock Out</>}
                </Button>
              )}

              {clockResult?.error && <p className="text-sm text-destructive text-center">{clockResult.error}</p>}

              <Button variant="ghost" size="sm" onClick={reset} className="w-full">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Cancel / Look up another employee
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
