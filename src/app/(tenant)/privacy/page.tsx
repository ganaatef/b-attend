/**
 * /privacy — Employee data access / deletion request page.
 * Creates a support ticket for the privacy officer.
 */
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Mail } from "lucide-react";

type RequestType = "ACCESS" | "EXPORT" | "DELETION" | "CORRECTION";

export default function PrivacyRequestPage() {
  const t = useTranslations("privacy");
  const { toast } = useToast();
  const [requestType, setRequestType] = useState<RequestType>("ACCESS");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Privacy Request: ${requestType}`,
          message: `Request type: ${requestType}\n\nAdditional details:\n${details || "None provided."}`,
          category: "PRIVACY_REQUEST",
        }),
      });

      if (!res.ok) throw new Error("Failed to submit request");

      setSubmitted(true);
      toast({ title: "Request submitted", description: "Your privacy request has been received." });
    } catch {
      toast({ title: "Error", description: "Failed to submit request. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Request Received</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Your privacy request has been submitted as a support ticket. Our privacy officer will
              review and respond within 5 business days.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              For urgent matters, email{" "}
              <a href="mailto:privacy@b-attend.app" className="text-brand-accent hover:underline">
                privacy@b-attend.app
              </a>
            </p>
            <Button variant="outline" className="mt-6" onClick={() => { setSubmitted(false); setDetails(""); }}>
              Submit Another Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Data Request</CardTitle>
          <CardDescription>
            Request access to, export, or deletion of your personal data. Requests are processed as
            support tickets and reviewed by our privacy officer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <Label>Request Type</Label>
              <RadioGroup
                value={requestType}
                onValueChange={(v) => setRequestType(v as RequestType)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ACCESS" id="access" />
                  <Label htmlFor="access" className="font-normal">Access — view all data held about me</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="EXPORT" id="export" />
                  <Label htmlFor="export" className="font-normal">Export — receive a copy of my data</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="DELETION" id="deletion" />
                  <Label htmlFor="deletion" className="font-normal">Deletion — request removal of my data</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CORRECTION" id="correction" />
                  <Label htmlFor="correction" className="font-normal">Correction — fix inaccurate data</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="details">Additional Details (optional)</Label>
              <Textarea
                id="details"
                placeholder="Provide any additional context for your request..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
              />
            </div>

            <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  You can also email our Privacy Officer directly at{" "}
                  <a href="mailto:privacy@b-attend.app" className="font-medium text-brand-accent hover:underline">
                    privacy@b-attend.app
                  </a>
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
