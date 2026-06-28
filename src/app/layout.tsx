import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";
import "../styles/sprites.css";

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

const fredoka = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HouseholdIQ — Coverage Quest",
  description:
    "Insurance lead qualification for SF homeowners — discover underinsured households on a game-style coverage board.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const app = <ConvexClientProvider>{children}</ConvexClientProvider>;

  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-body)] antialiased">
        {clerkEnabled ? <ClerkProvider>{app}</ClerkProvider> : app}
      </body>
    </html>
  );
}