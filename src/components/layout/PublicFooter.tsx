/**
 * Public site footer — sticky at bottom via parent flex layout.
 */
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="text-base font-semibold text-foreground">B-Attend</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Smart attendance and shift control for operational teams everywhere.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Be present. Be verified.</p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/features" className="text-foreground/80 hover:text-foreground">Features</Link></li>
            <li><Link href="/pricing" className="text-foreground/80 hover:text-foreground">Pricing</Link></li>
            <li><Link href="/request-demo" className="text-foreground/80 hover:text-foreground">Request Demo</Link></li>
            <li><Link href="/signup" className="text-foreground/80 hover:text-foreground">Get Started</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/contact" className="text-foreground/80 hover:text-foreground">Contact</Link></li>
            <li><Link href="/login" className="text-foreground/80 hover:text-foreground">Login</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/legal/privacy" className="text-foreground/80 hover:text-foreground">Privacy Policy</Link></li>
            <li><Link href="/legal/terms" className="text-foreground/80 hover:text-foreground">Terms of Service</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
           © {year} B-Attend. Built for operational teams everywhere.
        </div>
      </div>
    </footer>
  );
}
