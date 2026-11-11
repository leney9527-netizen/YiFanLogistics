"use client";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LOCALES = [
  { id: "zh", short: "中文", label: "中文" },
  { id: "en", short: "EN", label: "English" },
  { id: "fr", short: "FR", label: "Français" },
] as const;

export function MobileBar({ signedIn, staff }: { signedIn: boolean; staff: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const root = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<"lang" | "menu" | null>(null);
  const short = LOCALES.find((item) => item.id === locale)?.short ?? "EN";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPanel(null);
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setPanel(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  function toggle(next: "lang" | "menu") {
    setPanel((current) => (current === next ? null : next));
  }

  function go(href: "/services" | "/faq" | "/contact" | "/login" | "/account" | "/admin" | "/#quote") {
    setPanel(null);
    router.push(href);
  }

  function switchLocale(next: string) {
    setPanel(null);
    const query = search.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { locale: next });
    if (document.cookie.includes("sb-")) {
      void fetch("/api/account/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
    }
  }

  return (
    <div className="mobile-bar" ref={root}>
      <button
        className="icon-btn lang-chip"
        type="button"
        aria-label={t("language")}
        aria-expanded={panel === "lang"}
        onClick={() => toggle("lang")}
      >
        <GlobeIcon />
        <span>{short}</span>
      </button>
      <Link className="icon-btn account-icon" href={signedIn ? "/account" : "/login"} aria-label={signedIn ? t("account") : t("login")}>
        <UserIcon />
      </Link>
      <button
        className="icon-btn menu-toggle"
        type="button"
        aria-label={panel === "menu" ? t("close") : t("menu")}
        aria-expanded={panel === "menu"}
        onClick={() => toggle("menu")}
      >
        {panel === "menu" ? <CloseIcon /> : <MenuIcon />}
      </button>
      {panel === "lang" ? (
        <div className="mobile-pop" role="listbox" aria-label={t("language")}>
          {LOCALES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === locale}
              onClick={() => switchLocale(item.id)}
            >
              <span>{item.label}</span>
              {item.id === locale ? <span className="meta">{t("current")}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {panel === "menu" ? (
        <div className="mobile-pop">
          <Link className="menu-account" href={signedIn ? "/account" : "/login"} onClick={(event) => { event.preventDefault(); go(signedIn ? "/account" : "/login"); }}>{signedIn ? t("account") : t("login")}</Link>
          <Link href="/#quote" aria-current={pathname === "/" ? "page" : undefined} onClick={(event) => { event.preventDefault(); go("/#quote"); }}>{t("quote")}</Link>
          <Link href="/services" aria-current={pathname === "/services" ? "page" : undefined} onClick={(event) => { event.preventDefault(); go("/services"); }}>{t("services")}</Link>
          <Link href="/faq" aria-current={pathname === "/faq" ? "page" : undefined} onClick={(event) => { event.preventDefault(); go("/faq"); }}>{t("faq")}</Link>
          <Link href="/contact" aria-current={pathname === "/contact" ? "page" : undefined} onClick={(event) => { event.preventDefault(); go("/contact"); }}>{t("contact")}</Link>
          {staff ? <Link href="/admin" onClick={(event) => { event.preventDefault(); go("/admin"); }}>{t("admin")}</Link> : null}
        </div>
      ) : null}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M12 3c2.5 2.8 2.5 15.2 0 18M12 3c-2.5 2.8-2.5 15.2 0 18" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 19.2c1.4-3 3.8-4.4 7-4.4s5.6 1.4 7 4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
