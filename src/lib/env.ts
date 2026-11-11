import "server-only";

export type ServerEnv = {
  url: string;
  anon: string;
  service: string;
  pepper: string;
  showDemo: boolean;
  siteUrl: string;
  cronSecret: string;
};

export function getServerEnv(): ServerEnv | null {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pepper = process.env.CAPTCHA_PEPPER;
  if (!url || !anon || !service || !pepper) return null;
  return {
    url,
    anon,
    service,
    pepper,
    showDemo: process.env.SHOW_DEMO_RATES === "true",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000",
    cronSecret: process.env.CRON_SECRET ?? "",
  };
}
