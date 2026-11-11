import { Link } from "@/i18n/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

export const instant = false;

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("servicesPage");
  const home = await getTranslations("home");
  return (
    <>
      <section className="service-hero">
        <div className="wrap service-hero-grid">
          <div>
            <p className="kicker">{t("kicker")}</p>
            <h1>{t("title")}</h1>
            <p>{t("lede")}</p>
          </div>
          <img src="/images/port-hero.webp" width={1600} height={1060} alt={home("photoAlt")} />
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <h2>{t("offerTitle")}</h2>
          <div className="service-grid">
            <article>
              <IconBox />
              <h3>{t("quoteTitle")}</h3>
              <p>{t("quoteBody")}</p>
            </article>
            <article>
              <IconShip />
              <h3>{t("compareTitle")}</h3>
              <p>{t("compareBody")}</p>
            </article>
            <article>
              <IconHead />
              <h3>{t("manualTitle")}</h3>
              <p>{t("manualBody")}</p>
            </article>
          </div>
        </div>
      </section>
      <section className="section flow-band">
        <div className="wrap">
          <h2>{t("flowTitle")}</h2>
          <ol className="flow-steps">
            <li><span>1</span><div><h3>{t("step1")}</h3><p>{t("step1Body")}</p></div></li>
            <li className="flow-arrow" aria-hidden="true">→</li>
            <li><span>2</span><div><h3>{t("step2")}</h3><p>{t("step2Body")}</p></div></li>
            <li className="flow-arrow" aria-hidden="true">→</li>
            <li><span>3</span><div><h3>{t("step3")}</h3><p>{t("step3Body")}</p></div></li>
          </ol>
        </div>
      </section>
      <section className="section">
        <div className="wrap service-cta">
          <h2>{t("cta")}</h2>
          <Link className="btn primary" href="/#quote">{t("ctaButton")}</Link>
        </div>
      </section>
    </>
  );
}

function IconBox() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 12.2 20 8.5M12 12.2V20M12 12.2 4 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconShip() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 15.5 6 9h12l2 6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 18c1.4 1.2 2.8 1.2 4.2 0s2.8-1.2 4.2 0 2.8 1.2 4.2 0 2.8-1.2 4.2 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 9V6h4v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconHead() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 18.5c1.1-2.4 3-3.6 5.5-3.6s4.4 1.2 5.5 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 8.5a5.5 5.5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
