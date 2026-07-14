// ===================================================================
// B-Attend brand logo — inline SVG, no external asset.
// Renders the navy "B" mark + wordmark. Sized via className.
// ===================================================================

import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  showWordmark = true,
  variant = "default",
}: {
  className?: string;
  showWordmark?: boolean;
  variant?: "default" | "light";
}) {
  const wordmarkColor = variant === "light" ? "#FFFFFF" : "var(--brand-navy)";
  const taglineColor = variant === "light" ? "rgba(255,255,255,0.6)" : "#64748B";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 select-none",
        className,
      )}
      aria-label="B-Attend"
    >
      <span
        className="inline-flex items-center justify-center rounded-lg"
        style={{
          background:
            "linear-gradient(135deg, var(--brand-navy) 0%, #11305A 60%, var(--brand-accent) 130%)",
          width: "1.75rem",
          height: "1.75rem",
          boxShadow: "0 1px 2px rgba(11,37,69,0.18)",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 5h6.2c2.3 0 3.9 1.2 3.9 3.2 0 1.4-.8 2.3-2 2.7v.1c1.6.3 2.6 1.4 2.6 3.1 0 2.3-1.9 3.7-4.5 3.7H6V5Zm3 5.1h2.7c1 0 1.6-.5 1.6-1.3 0-.8-.6-1.3-1.6-1.3H9v2.6Zm0 5.3h3c1.1 0 1.7-.5 1.7-1.4 0-.9-.6-1.4-1.7-1.4H9v2.8Z"
            fill="#FFFFFF"
          />
          <circle cx="18" cy="6" r="2" fill="var(--brand-accent)" />
        </svg>
      </span>
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className="text-base font-bold tracking-tight"
            style={{ color: wordmarkColor }}
          >
            B-Attend
          </span>
          <span
            className="text-[10px] font-medium tracking-wide"
            style={{ color: taglineColor }}
          >
            Be present. Be verified.
          </span>
        </span>
      )}
    </span>
  );
}
