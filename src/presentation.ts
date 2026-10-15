const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];
const relative = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "narrow",
});

/** Render App timestamps using Bonsai's existing relative-time presentation. */
export function relativeTime(at: number, now = Date.now()): string {
  const delta = at - now;
  for (const [unit, size] of units)
    if (Math.abs(delta) >= size)
      return relative.format(Math.round(delta / size), unit);
  return "just now";
}
