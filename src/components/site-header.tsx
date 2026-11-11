import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSelect } from "@/components/language-select";
import { MainNav } from "@/components/main-nav";
import { MobileBar } from "@/components/mobile-bar";
import { getActor } from "@/lib/server/session";
import { isStaffRole } from "@/lib/authz";

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="1" y="1" width="26" height="26" rx="8" fill="#0b3a5b" />
      <path d="M7 18c3-6 5-6 7-2s4 6 7 0" fill="none" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}

async function AccountLinks() {
  const t = await getTranslations("nav");
  const actor = await getActor();
  const staff = actor ? isStaffRole(actor.role) : false;
  return (
    <>
      <MainNav />
      <div className="header-tools">
        <div className="desktop-only"><LanguageSelect /></div>
        <span className="tool-rule desktop-only" aria-hidden="true" />
        <Link className="text-link login-link desktop-only" href={actor ? "/account" : "/login"}>{actor ? t("account") : t("login")}</Link>
        {staff ? <Link className="text-link desktop-only" href="/admin">{t("admin")}</Link> : null}
        <MobileBar signedIn={Boolean(actor)} staff={staff} />
      </div>
    </>
  );
}

export function SiteHeader({ name }: { name: string }) {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href="/" className="brand"><Mark /><span>{name}</span></Link>
        <Suspense fallback={<div className="skeleton" style={{ width: 180 }} />}>
          <AccountLinks />
        </Suspense>
      </div>
    </header>
  );
}
