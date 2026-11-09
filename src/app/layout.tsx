import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Masuk ke SehatiKan",
  description: "Teman kesehatan ikan dan pengelolaan bak Anda.",
};

export const viewport: Viewport = {
  themeColor: "#f5fbfc",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
