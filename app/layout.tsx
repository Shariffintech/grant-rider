import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Granted",
  description: "A friendly grant finder and draft helper for Abena DMS."
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
