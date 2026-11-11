import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { defaultCompany } from "@/content/defaults";
import type { Locale } from "@/lib/types";
import { getServerEnv } from "@/lib/env";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const env = getServerEnv();
  const site = env?.siteUrl ?? "http://localhost:3000";
  return {
    title: { default: t("title"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    alternates: {
      canonical: `${site}/${locale}`,
      languages: {
        en: `${site}/en`,
        zh: `${site}/zh`,
        fr: `${site}/fr`,
        "x-default": `${site}/en`,
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const footer = await getTranslations("footer");
  const name = defaultCompany.name[locale as Locale];
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <a className="skip" href="#content">{t("skip")}</a>
          <SiteHeader name={name} />
          <main id="content">{children}</main>
          <footer className="site-footer">
            <div className="wrap footer-row">
              <div>
                <div>{name}</div>
                <p>{footer("note")}</p>
                <p>{footer("photos")}</p>
              </div>
              <Link href="/terms">{footer("terms")}</Link>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
