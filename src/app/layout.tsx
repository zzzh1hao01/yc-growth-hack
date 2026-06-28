import {ClerkProvider} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Nunito, Rye } from "next/font/google";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";
import "../styles/sprites.css";

const rye = Rye({
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
    "Insurance lead qualification for SF homeowners — discover underinsured households on a wild-west coverage map.",
};

const clerkAppearance = {
  variables: {
    colorPrimary: "#c2410c",
    colorBackground: "#f5e6c8",
    colorText: "#451a03",
    colorInputBackground: "#faf3e6",
    colorInputText: "#451a03",
    borderRadius: "2px",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${rye.variable} ${nunito.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-body)] antialiased">
        <ClerkProvider appearance={clerkAppearance}>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
