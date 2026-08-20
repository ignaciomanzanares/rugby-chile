import type { Metadata } from "next";
export const metadata: Metadata = { title: "Tabla" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
