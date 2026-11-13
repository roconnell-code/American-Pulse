export const CATEGORIES = [
  ["all", "All"],
  ["politics", "Politics"],
  ["elections", "Elections"],
  ["economy", "Economy"],
  ["crime", "Public safety"],
  ["education", "Education"],
  ["immigration", "Immigration"],
  ["environment", "Environment"],
  ["technology", "Technology"],
  ["culture", "Culture"],
];

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

export function formatDay(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function formatFull(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function ago(iso) {
  const delta = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(delta)) return "";
  const hour = 3_600_000;
  if (delta < hour) return `${Math.max(1, Math.round(delta / 60_000))}m ago`;
  if (delta < hour * 24) return `${Math.round(delta / hour)}h ago`;
  return `${Math.round(delta / (hour * 24))}d ago`;
}

export function inRange(iso, range) {
  const delta = Date.now() - new Date(iso).getTime();
  if (range === "24") return delta <= 86_400_000;
  if (range === "72") return delta <= 86_400_000 * 3;
  return delta <= 86_400_000 * 7 + 3_600_000;
}

export function latest(articles) {
  return articles.reduce((best, article) => (
    !best || article.publishedAt > best ? article.publishedAt : best
  ), "");
}

export function countLine(count, depth) {
  if (depth === "full") {
    return count ? `${count} ${count === 1 ? "story" : "stories"} in 7 days` : "No stories in 7 days";
  }
  if (depth === "wire" && count > 0) return `${count} on the national wires`;
  return "Local index in progress";
}
