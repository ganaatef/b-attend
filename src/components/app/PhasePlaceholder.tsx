// ===================================================================
// PhasePlaceholder — reusable "Coming in Phase X" content block for
// stub routes. Renders inside AppShell main content area.
// ===================================================================

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Construction } from "lucide-react";

export function PhasePlaceholder({
  phase,
  title,
  description,
  children,
  className,
}: {
  phase: number;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Badge className="bg-brand-warning/15 text-brand-warning border-brand-warning/30">
          Phase {phase} · Coming soon
        </Badge>
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-warning/10 text-brand-warning">
          <Construction className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          This module ships in Phase {phase}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          The route, navigation entry, and database models are in place. The
          full feature arrives in Phase {phase} per the B-Attend build plan.
        </p>
        {children ? <div className="mt-6 text-left">{children}</div> : null}
      </div>
    </div>
  );
}
