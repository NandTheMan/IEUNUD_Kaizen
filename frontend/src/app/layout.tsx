import { SessionProvider } from "@/components/session-provider";
import { SocketProvider } from "@/components/socket-provider";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Summary from "@/components/summary";

const spaceGroteskHeading = Space_Grotesk({subsets:['latin'],variable:'--font-heading'});

const jetbrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IEU Kaizen",
  description: "Sistem TPS Digital Teknik Industri UNUD",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-mono", jetbrainsMono.variable, "font-heading", spaceGroteskHeading.variable)}
    >
      <body className="h-screen flex flex-col bg-muted/50">
        <SocketProvider>
          <SessionProvider>
            <Summary />
            {children}
          </SessionProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
