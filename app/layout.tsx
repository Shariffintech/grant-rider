import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grant Rider Command Deck",
  description: "Founder-controlled grant application dashboard for Abena DMS."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
