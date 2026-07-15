"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateLeadStatusAction, assignLeadAction } from "@/app/admin/actions";
import type { PlatformUser } from "@prisma/client";

export function LeadRowActions({ leadId, status, platformUsers }: { leadId: string; status: string; platformUsers: PlatformUser[] }) {
  const router = useRouter();
  const [s, setS] = useState(status);
  const [assignee, setAssignee] = useState("");
  const statuses = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];

  return (
    <div className="flex items-center gap-2">
      <Select value={s} onValueChange={async (v) => { setS(v); await updateLeadStatusAction(leadId, v); router.refresh(); }}>
        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {statuses.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={assignee} onValueChange={async (v) => { setAssignee(v); await assignLeadAction(leadId, v); router.refresh(); }}>
        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Assign to..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="">Unassigned</SelectItem>
          {platformUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
