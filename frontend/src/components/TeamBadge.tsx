import { teamStyle } from "../data/teams";

// Any image dropped in src/assets/logos/<short-code>.(svg|png|webp|jpg) is picked up automatically.
const logoModules = import.meta.glob("../assets/logos/*.{svg,png,webp,jpg,jpeg}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const LOGOS: Record<string, string> = {};
for (const [path, url] of Object.entries(logoModules)) {
  const file = path.split("/").pop() ?? "";
  LOGOS[file.replace(/\.[^.]+$/, "").toLowerCase()] = url;
}

const SIZES = { xs: 20, sm: 28, md: 40, lg: 64, xl: 88 } as const;
export type BadgeSize = keyof typeof SIZES;

export function TeamBadge({ name, size = "sm", className = "" }: { name: string; size?: BadgeSize; className?: string }) {
  const s = teamStyle(name);
  const px = SIZES[size];
  const logo = LOGOS[s.short.toLowerCase()];
  if (logo) {
    return <img src={logo} alt={`${s.display} logo`} width={px} height={px} className={`shrink-0 object-contain ${className}`} style={{ width: px, height: px }} />;
  }
  const font = Math.max(8, Math.round(px * (s.short.length > 3 ? 0.3 : 0.36)));
  return (
    <span
      role="img"
      aria-label={`${s.display} badge`}
      title={s.display}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-display font-bold leading-none ${className}`}
      style={{ width: px, height: px, background: s.bg, color: s.fg, boxShadow: `inset 0 0 0 ${px > 30 ? 2 : 1.5}px ${s.ring}`, fontSize: font, letterSpacing: "0.02em" }}
    >
      {s.short}
    </span>
  );
}

export function TeamLabel({ name, size = "sm", bold = false }: { name: string; size?: BadgeSize; bold?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <TeamBadge name={name} size={size} />
      <span className={`truncate ${bold ? "font-semibold" : ""}`}>{teamStyle(name).display}</span>
    </span>
  );
}
