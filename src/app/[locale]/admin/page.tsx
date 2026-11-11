import { redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getActor } from "@/lib/server/session";
import { isStaffRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Link } from "@/i18n/navigation";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

const LINKS = ["ports", "carriers", "routes", "containers", "rates", "import", "charges", "fx", "inquiries", "quotes", "customers", "staff", "content", "settings", "audit"] as const;

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await getActor();
  if (!actor) {
    redirect({ href: `/login?next=/${locale}/admin`, locale });
    return null;
  }
  if (!isStaffRole(actor.role)) {
    redirect({ href: "/", locale });
    return null;
  }
  const t = await getTranslations("admin");
  const admin = createAdminClient();
  const [inquiries, drafts, expiring] = admin ? await Promise.all([
    admin.from("inquiries").select("id", { count: "exact", head: true }).in("status", ["new", "contacted"]),
    admin.from("freight_rate_versions").select("id", { count: "exact", head: true }).eq("status", "draft"),
    admin.from("freight_rate_versions").select("id", { count: "exact", head: true }).eq("status", "published").lte("valid_to", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)),
  ]) : [null, null, null];
  return (
    <section className="section">
      <div className="wrap admin-shell">
        <nav className="admin-nav">
          {LINKS.map((item) => <Link key={item} href={`/admin/${item}`}>{t(item)}</Link>)}
        </nav>
        <div className="stack">
          <h1 className="page-title" style={{ fontSize: 44 }}>{t("title")}</h1>
          <p className="lede">{t("lede")}</p>
          <p>{t("openInquiries")}: {inquiries?.count ?? 0}</p>
          <p>{t("drafts")}: {drafts?.count ?? 0}</p>
          <p>{t("expiring")}: {expiring?.count ?? 0}</p>
        </div>
      </div>
    </section>
  );
}
