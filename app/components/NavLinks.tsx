"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "./Icon";

const links: { href: string; label: string; short: string; icon: IconName }[] = [
  { href: "/", label: "Home", short: "Home", icon: "home" },
  { href: "/navigation", label: "Campus Map", short: "Map", icon: "map" },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={pathname === l.href ? "page" : undefined}
        >
          <Icon name={l.icon} size={17} />
          <span className="navLabelLong">{l.label}</span>
          <span className="navLabelShort">{l.short}</span>
        </Link>
      ))}
    </nav>
  );
}
