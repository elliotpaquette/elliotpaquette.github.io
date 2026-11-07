export const zone = "America/Toronto";
export function dayLabel(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, weekday: "long", month: "long", day: "numeric"
  }).format(new Date(iso));
}
export function timeLabel(iso) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true
  }).format(new Date(iso));
}
export function rangeLabel(slot) {
  return `${timeLabel(slot.starts_at)} – ${timeLabel(slot.ends_at)}`;
}
export function sameTime(a, b) { return Boolean(a && b) && Date.parse(a) === Date.parse(b); }
export function calendarFile(slot) {
  const stamp = iso => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MATH 598 784//Final Exam//EN",
    "BEGIN:VEVENT", `UID:hdp-final-${stamp(slot.starts_at)}@elliotpaquette.github.io`,
    `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(slot.starts_at)}`, `DTEND:${stamp(slot.ends_at)}`,
    "SUMMARY:High-Dimensional Probability final exam", "LOCATION:Burnside Hall 925",
    "DESCRIPTION:Arrive at the start. 20-minute exam within a 30-minute appointment.",
    "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
}
