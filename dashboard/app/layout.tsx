import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Civic Pulse",
  description:
    "GenAI-enriched civic complaint triage — BigQuery + Gemini + Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:px-10 lg:py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
