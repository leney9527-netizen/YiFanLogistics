import { redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getActor } from "@/lib/server/session";
import { isStaffRole } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminEditor } from "@/components/admin-editor";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminSection({ params }: { params: Promise<{ locale: string; section: string }> }) {
  const { locale, section } = await params;
  setRequestLocale(locale);
  const actor = await getActor();
  if (!actor) {
    redirect({ href: `/login?next=/${locale}/admin/${section}`, locale });
    return null;
  }
  if (!isStaffRole(actor.role)) {
    redirect({ href: "/", locale });
    return null;
  }
  const t = await getTranslations("admin");
  const admin = createAdminClient();
  const rows = await loadSection(section, admin);
  const titleKey = ["ports", "carriers", "routes", "containers", "rates", "import", "charges", "fx", "inquiries", "quotes", "customers", "staff", "content", "settings", "audit"].includes(section)
    ? section as "ports"
    : "dashboard";
  return (
    <section className="section">
      <div className="wrap stack">
        <h1 className="page-title" style={{ fontSize: 40 }}>{titleKey === "dashboard" ? t("title") : t(titleKey)}</h1>
        {rows.length === 0 ? <p>{t("empty")}</p> : (
          <div className="table-wrap">
            <table>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}><td>{row.label}</td><td className="meta">{row.detail}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <AdminEditor section={section} role={actor.role} />
      </div>
    </section>
  );
}

async function loadSection(section: string, admin: ReturnType<typeof createAdminClient>) {
  if (!admin) return [];
  if (section === "ports") {
    const { data } = await admin.from("ports").select("id, code, name_zh, name_en, name_fr").order("sort_order");
    return (data ?? []).map((row) => ({ id: row.id, label: row.code, detail: `${row.name_zh} / ${row.name_en} / ${row.name_fr}` }));
  }
  if (section === "carriers") {
    const { data } = await admin.from("carriers").select("id, code, name, visibility");
    return (data ?? []).map((row) => ({ id: row.id, label: row.code, detail: `${row.name} · ${row.visibility}` }));
  }
  if (section === "rates") {
    const { data } = await admin.from("freight_rate_versions").select("id, status, currency, valid_from, valid_to, visibility").order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((row) => ({ id: row.id, label: row.status, detail: `${row.currency} ${row.valid_from} → ${row.valid_to} · ${row.visibility}` }));
  }
  if (section === "inquiries") {
    const { data } = await admin.from("inquiries").select("id, inquiry_number, status, contact_name").order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((row) => ({ id: row.id, label: row.inquiry_number, detail: `${row.status} · ${row.contact_name}` }));
  }
  if (section === "quotes") {
    const { data } = await admin.from("quotes").select("id, quote_number, created_at").order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((row) => ({ id: row.id, label: row.quote_number, detail: row.created_at }));
  }
  if (section === "customers" || section === "staff") {
    const { data } = await admin.from("profiles").select("id, email, role, display_name").order("created_at", { ascending: false }).limit(100);
    const filtered = (data ?? []).filter((row) => section === "staff" ? row.role !== "customer" : row.role === "customer");
    return filtered.map((row) => ({ id: row.id, label: row.email, detail: `${row.role} · ${row.display_name ?? ""}` }));
  }
  if (section === "fx") {
    const { data } = await admin.from("exchange_rates").select("id, base_currency, quote_currency, rate, source, effective_at").order("effective_at", { ascending: false }).limit(20);
    return (data ?? []).map((row) => ({ id: row.id, label: `${row.base_currency}/${row.quote_currency}`, detail: `${row.rate} · ${row.source}` }));
  }
  if (section === "charges") {
    const { data } = await admin.from("charge_rules").select("id, status, pricing_mode, amount, currency, billing_unit").order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((row) => ({ id: row.id, label: row.status, detail: `${row.pricing_mode} ${row.amount ?? "—"} ${row.currency ?? ""} / ${row.billing_unit}` }));
  }
  if (section === "audit") {
    const { data } = await admin.from("audit_logs").select("id, action, summary, created_at").order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((row) => ({ id: row.id, label: row.action, detail: `${row.created_at} · ${row.summary ?? ""}` }));
  }
  if (section === "settings") {
    const { data } = await admin.from("site_settings").select("id, company_name_zh, email, phone, require_login_for_prices").eq("id", 1).maybeSingle();
    return data ? [{ id: "settings", label: data.company_name_zh, detail: `${data.email} · ${data.phone}` }] : [];
  }
  return [];
}
