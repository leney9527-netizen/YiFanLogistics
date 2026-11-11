"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const ITEMS = [
  { href: "/#quote", id: "quote" },
  { href: "/services", id: "services" },
  { href: "/faq", id: "faq" },
  { href: "/contact", id: "contact" },
] as const;

export function navCurrent(pathname: string, id: (typeof ITEMS)[number]["id"]) {
  if (id === "quote") return pathname === "/";
  return pathname === `/${id}` || pathname.startsWith(`/${id}/`);
}

export function MainNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav className="nav-links desktop-nav" aria-label={t("primary")}>
      {ITEMS.map((item) => (
        <Link key={item.id} href={item.href} aria-current={navCurrent(pathname, item.id) ? "page" : undefined}>
          {t(item.id)}
        </Link>
      ))}
    </nav>
  );
}
