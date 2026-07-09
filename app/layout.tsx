import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dennis Liu · Vancouver Sales Consultant",
  description:
    "Dennis Liu at Cam Clark Ford Richmond helps Vancouver and Richmond drivers find new and used Ford vehicles.",
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
      <body>{children}</body>
    </html>
  );
}
