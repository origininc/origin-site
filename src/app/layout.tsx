import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Origin Studios",
  description: "Bespoke intelligence systems for music organizations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
