export default async function handler(req, res) {
  try {
    const url = "https://www.cbssports.com/writers/brandon-marcello/";
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BrandonMarcelloSite/1.0; +https://brandonmarcello.com)",
        Accept: "text/html",
      },
    });

    if (!r.ok) {
      return res.status(500).json({ error: "CBS fetch failed", status: r.status });
    }

    const html = await r.text();

    // Anchor on the "Recent Articles" area to avoid grabbing random site links
    const marker = "Recent Articles";
    const start = html.indexOf(marker);
    if (start === -1) {
      return res.status(500).json({ error: "Markup changed: marker missing" });
    }

    // Grab a chunk after the marker; this section contains the list
    const chunk = html.slice(start, start + 120000);

    // 1) Find candidate article hrefs (no assumptions about trailing slash)
    const hrefRe = /href="(\/college-football\/news\/[^"]+)"/g;
    const hrefs = [];
    let m;
    while ((m = hrefRe.exec(chunk)) !== null) {
      hrefs.push(m[1]);
      if (hrefs.length > 30) break; // safety
    }

    // Deduplicate while preserving order
    const seen = new Set();
    const uniq = [];
    for (const h of hrefs) {
      const clean = h.split("#")[0];
      if (!seen.has(clean)) {
        seen.add(clean);
        uniq.push(clean);
      }
      if (uniq.length >= 10) break;
    }

    // 2) For each href, try to extract the link text near it
    function stripTags(s) {
      return s
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    const stories = [];
    for (const path of uniq) {
      // Find a small window around the href occurrence and strip tags to get the title
      const idx = chunk.indexOf(`href="${path}"`);
      if (idx === -1) continue;

      const windowHtml = chunk.slice(idx, idx + 2000);

      // Try to capture text inside the <a>...</a> even if nested spans exist
      const aRe = new RegExp(
        `href="${path.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"[^>]*>([\\s\\S]*?)<\\/a>`,
        "i"
      );
      const am = windowHtml.match(aRe);

      let title = "";
      if (am && am[1]) {
        title = stripTags(am[1]);
      }

      // Fallback: sometimes text isn’t within the first window match
      if (!title || title.length < 8) {
        title = stripTags(windowHtml).split(" ").slice(0, 20).join(" ");
      }

      // Final cleanup
      title = title.replace(/^(\d+[DHW]|\d+\/\d+\/\d+)\s+/i, "").trim();

      stories.push({
        title,
        link: `https://www.cbssports.com${path.startsWith("/") ? "" : "/"}${path}`,
      });

      if (stories.length >= 3) break;
    }

    if (!stories.length) {
      return res.status(500).json({
        error: "No stories found (still mismatch)",
        hint: "CBS markup likely changed; adjust href/title extraction.",
      });
    }

    // Cache at the edge for 1 hour; stale OK for a day
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ stories });
  } catch (e) {
    return res.status(500).json({ error: "Unexpected error", details: String(e) });
  }
}
