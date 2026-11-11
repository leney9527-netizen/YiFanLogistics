import { InquiryForm } from "@/components/inquiry-form";
import { loadSearchOptions } from "@/lib/server/freight";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/types";

export const instant = false;

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  const t = await getTranslations("contactPage");
  const contact = await getTranslations("contact");
  const lang = locale as Locale;
  const options = await loadSearchOptions();
  const settings = options?.settings;
  const ports = (options?.ports ?? []).map((port) => ({ code: port.code, name: port.name[lang], kind: port.kind }));
  const containers = (options?.containers ?? []).map((item) => ({ code: item.code, name: item.name[lang] }));
  const details = [
    settings?.email ? [contact("email"), settings.email] : null,
    settings?.phone ? [contact("phone"), settings.phone] : null,
    settings?.whatsapp ? [contact("whatsapp"), settings.whatsapp] : null,
    settings?.[`address_${lang}`] ? [contact("address"), settings[`address_${lang}`]] : null,
    settings?.[`hours_${lang}`] ? [contact("hours"), settings[`hours_${lang}`]] : null,
  ].filter((item): item is [string, string] => Boolean(item?.[1]));

  return (
    <>
      <section className="page-banner">
        <div className="wrap">
          <h1>{t("title")}</h1>
          <p>{t("lede")}</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap contact-layout">
          <aside className="contact-side">
            <h2>{t("sideTitle")}</h2>
            <p>{t("sideBody")}</p>
            <h3>{t("prep")}</h3>
            <ul>
              <li>{t("prepPorts")}</li>
              <li>{t("prepCargo")}</li>
              <li>{t("prepDate")}</li>
            </ul>
            {details.length > 0 ? (
              <dl>
                {details.map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            ) : null}
          </aside>
          <div className="contact-card">
            <h2>{t("formTitle")}</h2>
            <InquiryForm
              variant="contact"
              ports={ports}
              containers={containers}
              defaults={{
                origin: one("origin"),
                destination: one("destination"),
                container: one("container") || "40HQ",
                quantity: one("quantity") || "1",
                date: one("date"),
              }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
