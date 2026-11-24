import type { Metadata } from "next";
import Link from "next/link";
import "./global.css";
import ChatWidget from "./components/ChatWidget";
import NavLinks from "./components/NavLinks";

export const metadata: Metadata = {
  title: "ATLAS | Smart Campus Navigation",
  description: "Find your way around CvSU Imus, indoors and outdoors.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="headerInner">
            <Link href="/" className="logo">
              ATLAS
            </Link>
            <NavLinks />
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer">
          <span>ATLAS · CvSU Imus Smart Campus Navigation</span>
          <Link href="/teacher">Teacher Portal</Link>
        </footer>
        <ChatWidget />
      </body>
    </html>
  );
}
