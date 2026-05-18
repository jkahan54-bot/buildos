import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildOS — Construction Management",
  description: "AI-powered construction project management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
