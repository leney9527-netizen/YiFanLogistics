import { redirect } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listQuotes } from "@/lib/server/freight";
import { getActor } from "@/lib/server/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/types";
import { AccountForms } from "@/components/account-forms";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const actor = await getActor();
  if (!actor) {
    redirect({ href: `/login?next=/${locale}/account`, locale });
    return null;
  }
  const t = await getTranslations();
  const lang = locale as Locale;
  const quotes = await listQuotes(actor);
  const admin = createAdminClient();
  const inquiries = admin
    ? (await admin.from("inquiries").select("id, inquiry_number, status, created_at").eq("user_id", actor.id).order("created_at", { ascending: false })).data ?? []
    : [];
  return (
    <section className="section">
      <div className="wrap stack">
        <h1 className="page-title" style={{ fontSize: 48 }}>{t("meta.account")}</h1>
        <div>
          <h2>{t("account.quotes")}</h2>
          {quotes.length === 0 ? <p>{t("account.noQuotes")}</p> : (
            <div className="stack">
              {quotes.map((quote) => (
                <a key={quote.id} href={`/${locale}/account/quotes/${quote.id}`}>{quote.quote_number} · {formatDate(quote.created_at, lang)}</a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2>{t("account.inquiries")}</h2>
          {inquiries.length === 0 ? <p>{t("account.noInquiries")}</p> : inquiries.map((item) => (
            <p key={item.id}>{item.inquiry_number} · {t(`status.${item.status}`)}</p>
          ))}
        </div>
        <AccountForms actor={actor} />
      </div>
    </section>
  );
}
