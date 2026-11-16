import type { Metadata } from "next";
import Link from "next/link";
import "./global.css";
import ThemeToggle from "./components/ThemeToggle";
import ChatWidget from "./components/ChatWidget";
import NavLinks from "./components/NavLinks";

export const metadata: Metadata = {
  title: "ATLAS | Smart Campus Navigation",
  description: "Find your way around CvSU Imus, indoors and outdoors.",
};

const themeScript = `try{var t=localStorage.getItem("atlas-theme");if(t)document.documentElement.dataset.theme=t;else if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <header className="header">
          <div className="headerInner">
            <Link href="/" className="logo">
              ATLAS
            </Link>
            <NavLinks />
            <ThemeToggle />
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
