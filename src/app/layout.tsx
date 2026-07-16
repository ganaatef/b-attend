import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import { type Locale, defaultLocale, locales } from "@/i18n/config";

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
    "B-Attend is a smart attendance, shift control, approvals, reporting, and payroll-ready workforce platform for operational teams everywhere.",
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

async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }
  return defaultLocale;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
