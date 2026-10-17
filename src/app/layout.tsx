import type { Metadata } from "next";
import AppSidebar from "@/components/AppSidebar";
import Toaster from "@/components/Toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel Admin",
  description: "Template de painel administrativo modular para micro-SaaS (demonstração com dados fictícios).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body>
        <AppSidebar>{children}</AppSidebar>
        <Toaster />
      </body>
    </html>
  );
}
