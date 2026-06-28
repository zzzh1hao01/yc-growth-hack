import type { Metadata } from "next";
import { VT323, Nunito } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";
import "../styles/sprites.css";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

const vt323 = VT323({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HouseholdIQ — Coverage Board",
  description:
    "Insurance lead qualification for SF homeowners on a western pixel coverage map.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = <ConvexClientProvider>{children}</ConvexClientProvider>;

  return (
    <html lang="en" className={`${vt323.variable} ${nunito.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-body)] antialiased">
        {clerkEnabled ? <ClerkProvider>{app}</ClerkProvider> : app}
      </body>
    </html>
  );
}