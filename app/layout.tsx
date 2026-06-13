import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TalentNest Workforce",
    template: "%s | TalentNest Workforce",
  },
  description: "TalentNest Workforce application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
