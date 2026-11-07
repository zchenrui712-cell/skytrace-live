import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkyTrace Live — Visual Aircraft Identification",
  description:
    "Identify visible aircraft by cross-checking a phone camera observation, device location and live ADS-B data.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
