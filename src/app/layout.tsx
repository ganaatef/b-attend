import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "B-Attend — Smart attendance & shift control",
    template: "%s · B-Attend",
  },
  description:
    "B-Attend is a smart attendance, shift control, approvals, reporting, and payroll-ready workforce platform for operational teams in Egypt & MENA.",
  keywords: [
    "B-Attend",
    "attendance",
    "shift control",
    "workforce",
    "Egypt",
    "MENA",
    "restaurants",
    "cafes",
    "retail",
    "gyms",
    "clinics",
    "warehouses",
    "security companies",
    "cleaning companies",
  ],
  authors: [{ name: "B-Attend" }],
  openGraph: {
    title: "B-Attend — Smart attendance & shift control",
    description: "Attendance, shifts, approvals, and payroll-ready reports for operational teams.",
    siteName: "B-Attend",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "B-Attend",
    description: "Smart attendance & shift control for operational teams.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
