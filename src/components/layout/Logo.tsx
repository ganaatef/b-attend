/**
 * B-Attend logo — pure SVG, no external assets.
 * Deep navy rounded square with a "presence dot" + checkmark accent.
 */
import type { SVGProps } from "react";

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect width="32" height="32" rx="8" fill="#0B2545" />
      <circle cx="11" cy="16" r="3.5" fill="#1E88E5" />
      <path
        d="M14.5 19.5L17 22L22 16.5"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
