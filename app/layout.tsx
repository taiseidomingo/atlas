import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./global.css";
import ChatWidget from "./components/ChatWidget";
import NavLinks from "./components/NavLinks";

export const metadata: Metadata = {
  title: "ATLAS | Smart Campus Navigation",
  description: "Find your way around CvSU Imus, indoors and outdoors.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2433c4",
};

const platformScript = `(function(){var d=document.documentElement;function f(){var C=window.Capacitor;var n=!!(C&&C.isNativePlatform&&C.isNativePlatform());var t=window.matchMedia&&matchMedia("(pointer: coarse)").matches;var s=Math.min(innerWidth,innerHeight)<=820;d.dataset.ui=(n||(t&&s))?"mobile":"web";if(n)d.dataset.app="native";}f();addEventListener("resize",f);})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: platformScript }} />
      </head>
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
