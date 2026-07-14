"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { markInvoicePaidAction, voidInvoiceAction } from "@/app/admin/actions";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function InvoiceActions({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [loading, setLoading] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Select value={method} onValueChange={setMethod}>
        <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
          <SelectItem value="CASH">Cash</SelectItem>
          <SelectItem value="MANUAL">Manual</SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={loading === "paid"}
        onClick={async () => {
          setLoading("paid");
          const r = await markInvoicePaidAction(invoiceId, method);
          if (!r.ok) alert(r.error);
          router.refresh();
          setLoading(null);
        }}
      >
        {loading === "paid" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
        Mark paid
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-destructive"
        disabled={loading === "void"}
        onClick={async () => {
          if (!confirm("Void this invoice?")) return;
          setLoading("void");
          const r = await voidInvoiceAction(invoiceId);
          if (!r.ok) alert(r.error);
          router.refresh();
          setLoading(null);
        }}
      >
        <XCircle className="mr-1 h-3 w-3" /> Void
      </Button>
    </div>
  );
}
