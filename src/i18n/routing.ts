import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh", "fr"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
});
