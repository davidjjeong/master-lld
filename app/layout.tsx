import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Master LLD", description: "Practice low-level design, one thoughtful step at a time." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
