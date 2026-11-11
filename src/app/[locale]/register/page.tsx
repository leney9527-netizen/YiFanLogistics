import { AuthForm } from "@/components/auth-form";
import { setRequestLocale } from "next-intl/server";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <section className="section">
      <div className="wrap">
        <AuthForm mode="register" nextPath={`/${locale}/account`} />
      </div>
    </section>
  );
}
