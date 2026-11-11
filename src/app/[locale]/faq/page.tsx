import { FaqBrowser } from "@/components/faq-browser";
import { defaultFaqs } from "@/content/defaults";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/types";

export const instant = false;

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = locale as Locale;
  return (
    <FaqBrowser
      items={defaultFaqs.map((item) => ({
        category: item.category,
        question: item.question[lang],
        body: item.body[lang],
      }))}
    />
  );
}
