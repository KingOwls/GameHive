export interface ManualGameInput {
  title: string;
  synopsis: string;
  platforms: string[];
  genres: string[];
  releasedAt: string | null;
  sourceUrl: string;
  sourceLabel: string;
  reason: string;
}
export function validateManualGame(value: unknown): ManualGameInput {
  const fail = () => {
    throw new Error(
      "Revisa los campos: texto plano, fuente HTTPS pública y motivo obligatorios.",
    );
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail();
  }
  const v = value as Record<string, unknown>;
  const text = (key: string, min: number, max: number) => {
    const x = v[key];
    if (
      typeof x !== "string" || x.trim().length < min || x.length > max ||
      /[<>\x00-\x08\x0b-\x1f\x7f]/.test(x)
    ) return fail();
    return x.trim();
  };
  const list = (key: string, max: number) => {
    const x = v[key];
    if (
      !Array.isArray(x) || x.length < 1 || x.length > max ||
      x.some((y) =>
        typeof y !== "string" || !y.trim() || y.length > 40 ||
        /[<>\x00-\x1f\x7f]/.test(y)
      )
    ) return fail();
    return [...new Set((x as string[]).map((y) => y.trim()))];
  };
  const source = text("sourceUrl", 1, 2048);
  if (!/^https:\/\/[^/]+/i.test(source) || /[\s\\]/.test(source)) return fail();
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return fail();
  }
  if (
    url.protocol !== "https:" || url.username || url.password ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(url.hostname) ||
    /(?:^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)
  ) return fail();
  url.hash = "";
  if (url.href.length > 2048) return fail();
  const platforms = list("platforms", 4);
  if (
    platforms.some((p) =>
      !["PC", "PlayStation", "Xbox", "Nintendo"].includes(p)
    )
  ) return fail();
  const releasedAt = v.releasedAt === null || v.releasedAt === ""
    ? null
    : text("releasedAt", 10, 10);
  if (
    releasedAt &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(releasedAt) ||
      Number.isNaN(Date.parse(releasedAt)) ||
      new Date(releasedAt).toISOString().slice(0, 10) !== releasedAt ||
      releasedAt < "1900-01-01" || releasedAt > "2099-12-31")
  ) return fail();
  return {
    title: text("title", 1, 160),
    synopsis: text("synopsis", 20, 4000),
    sourceLabel: text("sourceLabel", 1, 100),
    reason: text("reason", 10, 500),
    sourceUrl: url.href,
    releasedAt,
    platforms,
    genres: list("genres", 8),
  };
}
