import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "binnie | Less to remember. More room to think.",
  description: "Binnie is a calm AI-powered work companion for everything you need to remember and manage.",
  applicationName: "Binnie",
  icons: {
    icon: "/binnie-brandmark.svg",
    shortcut: "/binnie-brandmark.svg",
    apple: "/binnie-brandmark.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
