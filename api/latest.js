export default async function handler(req, res) {
  try {
    const url = "https://www.cbssports.com/writers/brandon-marcello/";
    const r = await fetch(url, {
      headers: {
        // Helps avoid bot blocks / different markup variants
        "User-Agent":
          "Mozilla/5.0 (compatible; BrandonMarcelloSite/1.0; +https://brandonmarcello.com)",
        "Accept": "text/html",
      },
    });

    if (!r.ok) {
      return res.status(500).json({ error: "CBS fetch failed", status: r.status });
    }

    const html = await r.text();

    // The author page has "Recent Articles" list with links.
    // We'll grab the first 3 article links after the "Recent Articles" section.
    const marker = "Recent Articles";
    const idx = html.indexOf(marker);
    if (idx === -1) return res.status(500).json({ error: "Markup changed: marker missing" });

    const slice = html.slice(idx, idx + 20000); // enough to include several items

    // Capture article links and titles: <a href="...">TITLE</a>
    const re = /<a href="(\/college-football\/news\/[^"]+\/)">([^<]+)<\/a>/g;

    const results = [];
    let m;
    while ((m = re.exec(slice)) !== null && results.length < 3) {
      const link = "https://www.cbssports.com" + m[1];
      const title = m[2].replace(/\s+/g, " ").trim();
      results.push({ title, link });
    }

    if (results.length === 0) {
      return res.status(500).json({ error: "No stories found (regex/markup mismatch)" });
    }

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ stories: results });
  } catch (e) {
    return res.status(500).json({ error: "Unexpected error", details: String(e) });
  }
}
