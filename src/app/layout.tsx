import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const jet = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jet", display: "swap" });

export const metadata: Metadata = {
  title: "NEXUS · AI Agent",
  description: "面向开发者的 AI Agent 智能助手 · ReAct · Plan-and-Execute · Multi-Agent",
  applicationName: "NEXUS",
  keywords: ["AI Agent", "ReAct", "Multi-Agent", "Prompt Engineering", "RAG"],
};

export const viewport: Viewport = {
  themeColor: "#0A0B14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body
        className={cn(
          inter.variable,
          space.variable,
          jet.variable,
          "scanlines min-h-screen font-sans text-cyber-text antialiased",
        )}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
