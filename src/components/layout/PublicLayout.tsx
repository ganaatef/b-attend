/**
 * Public layout wrapper — sticky footer pattern (min-h-screen flex flex-col).
 * Used by all marketing pages.
 */
import { PublicNav } from "./PublicNav";
import { PublicFooter } from "./PublicFooter";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
