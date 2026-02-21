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

    const marker = "Recent Articles";
    const start = html.indexOf(marker);
    if (start === -1) {
      return res.status(500).json({ error: "Markup changed: marker missing" });
    }

    const chunk = html.slice(start, start + 120000);

    // Find candidate article hrefs
    const hrefRe = /href="(\/college-football\/news\/[^"]+)"/g;
    const hrefs = [];
    let m;
    while ((m = hrefRe.exec(chunk)) !== null) {
      hrefs.push(m[1]);
      if (hrefs.length > 40) break;
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

    function stripTags(s) {
      return s
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function escReg(s) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    // Grab top 3 (title + link)
    const baseStories = [];
    for (const path of uniq) {
      const idx = chunk.indexOf(`href="${path}"`);
      if (idx === -1) continue;

      const windowHtml = chunk.slice(idx, idx + 2500);
      const aRe = new RegExp(`href="${escReg(path)}"[^>]*>([\\s\\S]*?)<\\/a>`, "i");
      const am = windowHtml.match(aRe);

      let title = "";
      if (am && am[1]) title = stripTags(am[1]);

      if (!title || title.length < 8) {
        title = stripTags(windowHtml).split(" ").slice(0, 20).join(" ");
      }

      baseStories.push({
        title,
        link: `https://www.cbssports.com${path.startsWith("/") ? "" : "/"}${path}`,
      });

      if (baseStories.length >= 3) break;
    }

    if (!baseStories.length) {
      return res.status(500).json({ error: "No stories found (markup mismatch)" });
    }

    // Enrich each story with og:image and published date
    async function enrich(story) {
      try {
        const sr = await fetch(story.link, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; BrandonMarcelloSite/1.0; +https://brandonmarcello.com)",
            Accept: "text/html",
          },
        });
        if (!sr.ok) return story;

        const sh = await sr.text();

        // og:image
        const ogImg =
          sh.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] ||
          sh.match(/content="([^"]+)"\s+property="og:image"/i)?.[1] ||
          null;

        // published time (varies; try a few common metas)
        const pub =
          sh.match(/property="article:published_time"\s+content="([^"]+)"/i)?.[1] ||
          sh.match(/name="pubdate"\s+content="([^"]+)"/i)?.[1] ||
          sh.match(/name="parsely-pub-date"\s+content="([^"]+)"/i)?.[1] ||
          null;

        return { ...story, image: ogImg, published: pub };
      } catch {
        return story;
      }
    }

    const stories = await Promise.all(baseStories.map(enrich));

    // Cache: 1 hour at edge; allow stale for 1 day
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ stories });
  } catch (e) {
    return res.status(500).json({ error: "Unexpected error", details: String(e) });
  }
}
