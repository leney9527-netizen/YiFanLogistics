"use client";

export function HeroQuoteButton({ label }: { label: string }) {
  return (
    <a
      className="btn primary home-cta"
      href="#quote"
      onClick={(event) => {
        event.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById("quote")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        document.getElementById("origin-port")?.focus();
      }}
    >
      {label}
    </a>
  );
}
