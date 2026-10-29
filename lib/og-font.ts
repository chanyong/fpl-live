/**
 * Korean glyphs for share images. The default OG font has no Hangul, so a Noto Sans KR subset
 * holding just the characters on the card is fetched from Google Fonts (TrueType, which Satori
 * can read). Returns null on any failure so the card still renders, Latin-only.
 */
const fontCache = new Map<string, ArrayBuffer>();

export async function loadKoreanFont(text: string, weight = 800): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text)].sort().join("");
  const key = `${weight}:${chars}`;
  const cached = fontCache.get(key);
  if (cached) {
    return cached;
  }
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@${weight}&text=${encodeURIComponent(chars)}`;
    const css = await (await fetch(cssUrl, { signal: AbortSignal.timeout(4000) })).text();
    const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!match) {
      return null;
    }
    const response = await fetch(match[1], { signal: AbortSignal.timeout(4000) });
    if (!response.ok) {
      return null;
    }
    const data = await response.arrayBuffer();
    if (fontCache.size > 200) {
      fontCache.clear();
    }
    fontCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}
