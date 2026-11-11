import { AuthForm } from "@/components/auth-form";
import { setRequestLocale } from "next-intl/server";
import { safeNextPath } from "@/lib/validation";
import type { Locale } from "@/lib/types";

export const instant = false;
export const metadata = { robots: { index: false, follow: false } };

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  return (
    <section className="section">
      <div className="wrap">
        <AuthForm mode="login" nextPath={safeNextPath(query.next, locale as Locale)} />
      </div>
    </section>
  );
}
