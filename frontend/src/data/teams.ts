/** Franchise styling. Colours are only used for the fallback badges and small accents. */
export interface TeamStyle { name: string; display: string; short: string; bg: string; fg: string; ring: string; years?: string }

export const TEAM_STYLES: TeamStyle[] = [
  { name: "Chennai Super Kings", display: "Chennai Super Kings", short: "CSK", bg: "#F5C400", fg: "#14213D", ring: "#0B5FA5" },
  { name: "Mumbai Indians", display: "Mumbai Indians", short: "MI", bg: "#0B5FA5", fg: "#FFFFFF", ring: "#D1A54A" },
  { name: "Royal Challengers Bengaluru", display: "Royal Challengers Bengaluru", short: "RCB", bg: "#B71C1C", fg: "#FFFFFF", ring: "#D4AF37" },
  { name: "Kolkata Knight Riders", display: "Kolkata Knight Riders", short: "KKR", bg: "#3B2A6B", fg: "#F2C75C", ring: "#F2C75C" },
  { name: "Rajasthan Royals", display: "Rajasthan Royals", short: "RR", bg: "#D81B7A", fg: "#FFFFFF", ring: "#1D3F8F" },
  { name: "Sunrisers Hyderabad", display: "Sunrisers Hyderabad", short: "SRH", bg: "#E8751A", fg: "#FFFFFF", ring: "#111111" },
  { name: "Delhi Capitals", display: "Delhi Capitals", short: "DC", bg: "#1B4F9C", fg: "#FFFFFF", ring: "#D32F2F" },
  { name: "Punjab Kings", display: "Punjab Kings", short: "PBKS", bg: "#C62828", fg: "#FFFFFF", ring: "#C9B27C" },
  { name: "Gujarat Titans", display: "Gujarat Titans", short: "GT", bg: "#1C2B4B", fg: "#C8A55B", ring: "#C8A55B" },
  { name: "Lucknow Super Giants", display: "Lucknow Super Giants", short: "LSG", bg: "#0E6BA8", fg: "#FFFFFF", ring: "#E8A33D" },
  { name: "Deccan Chargers", display: "Deccan Chargers", short: "DCH", bg: "#5B6C8F", fg: "#FFFFFF", ring: "#C9A227", years: "defunct" },
  { name: "Kochi Tuskers Kerala", display: "Kochi Tuskers Kerala", short: "KTK", bg: "#6B3FA0", fg: "#FFFFFF", ring: "#F2A900", years: "defunct" },
  { name: "Pune Warriors", display: "Pune Warriors India", short: "PWI", bg: "#1E88B5", fg: "#FFFFFF", ring: "#F28C28", years: "defunct" },
  { name: "Rising Pune Supergiant", display: "Rising Pune Supergiant", short: "RPS", bg: "#7A2E8E", fg: "#FFFFFF", ring: "#F26B3A", years: "defunct" },
  { name: "Gujarat Lions", display: "Gujarat Lions", short: "GL", bg: "#E4572E", fg: "#FFFFFF", ring: "#1B2A41", years: "defunct" },
];

const ALIASES: Record<string, string> = {
  "delhi daredevils": "Delhi Capitals",
  "kings xi punjab": "Punjab Kings",
  "royal challengers bangalore": "Royal Challengers Bengaluru",
  "pune warriors india": "Pune Warriors",
  "rising pune supergiants": "Rising Pune Supergiant",
};

const BY_NAME = new Map(TEAM_STYLES.map((t) => [t.name.toLowerCase(), t]));
TEAM_STYLES.forEach((t) => BY_NAME.set(t.display.toLowerCase(), t));

export function canonicalTeam(name: string): string {
  const k = name.trim().toLowerCase();
  return BY_NAME.get(k)?.name ?? ALIASES[k] ?? name;
}

export function teamStyle(name: string): TeamStyle {
  const k = canonicalTeam(name).toLowerCase();
  const found = BY_NAME.get(k);
  if (found) return found;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "?";
  return { name, display: name, short: initials, bg: "#64748B", fg: "#FFFFFF", ring: "#CBD5E1" };
}

export const displayName = (name: string) => teamStyle(name).display;

/** Distinguishable series colours for charts (brand colours collide: MI/DC/LSG are all blue). */
export const CHART_COLORS = ["#0F2A4A", "#12908E", "#D69E2E", "#B63D32", "#6B5BA6", "#2F7D4F", "#3B82C4", "#8A6D3B"];
export const chartColor = (i: number) => CHART_COLORS[i % CHART_COLORS.length];
