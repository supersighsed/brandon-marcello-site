export default async function handler(req, res) {
  try {
    const url = "https://www.cbssports.com/writers/brandon-marcello/";
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BrandonMarcelloSite/1.0; +https://www.brandonmarcello.com)",
        Accept: "text/html",
      },
    });

    if (!r.ok) {
      return res.status(502).json({ error: `Upstream fetch failed (${r.status})` });
    }

    const html = await r.text();
    const items = [];

    // Heuristic A: JSON-LD ItemList (if present)
    const ldMatch = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i
    );

    if (ldMatch) {
      try {
        const json = JSON.parse(ldMatch[1].trim());

        // ItemList may be directly on the object or inside @graph
        let list = json?.itemListElement;
        if (!list && Array.isArray(json?.["@graph"])) {
          const nodeWithList = json["@graph"].find((n) => Array.isArray(n?.itemListElement));
          list = nodeWithList?.itemListElement;
        }

        if (Array.isArray(list)) {
          for (const el of list) {
            const u = el?.url || el?.item?.url;
            const name = el?.name || el?.item?.name;
            if (u && name) {
              items.push({
                url: u.startsWith("http") ? u : `https://www.cbssports.com${u}`,
                title: String(name).trim(),
              });
            }
          }
        }
      } catch (_) {
        // ignore JSON-LD parse issues
      }
    }

    // Heuristic B: fallback HTML anchor scan
    if (items.length < 3) {
      const re = /href="(\/college-football\/news\/[^"]+)"/gi;
      const seen = new Set(items.map((i) => i.url));
      let m;

      while ((m = re.exec(html)) && items.length < 10) {
        const path = m[1];
        const full = `https://www.cbssports.com${path}`;
        if (seen.has(full)) continue;

        // look near the href for a title
        const chunk = html.slice(Math.max(0, m.index - 600), Math.min(html.length, m.index + 1400));
        const t =
          chunk.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i) ||
          chunk.match(/title="([^"]+)"/i);

        let title = t ? (t[1] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
        if (!title || title.length < 8) continue;

        items.push({ url: full, title });
        seen.add(full);
      }
    }

    if (!items.length) {
      return res.status(500).json({ error: "No stories found (markup mismatch)" });
    }

    // Enrich top 3 with og:image + published date
    const top = items.slice(0, 3);

    const enriched = await Promise.all(
      top.map(async (it) => {
        try {
          const pr = await fetch(it.url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; BrandonMarcelloSite/1.0; +https://www.brandonmarcello.com)",
              Accept: "text/html",
            },
          });
          if (!pr.ok) return it;

          const phtml = await pr.text();

          const og =
            phtml.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ||
            phtml.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);

          const dt =
            phtml.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i) ||
            phtml.match(/<time[^>]+datetime="([^"]+)"/i);

          let date = "";
          if (dt && dt[1]) {
            const d = new Date(dt[1]);
            if (!Number.isNaN(d.getTime())) {
              date = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
            }
          }

          return { ...it, image: og ? og[1] : "", date };
        } catch {
          return it;
        }
      })
    );

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    return res.status(200).json({ items: enriched });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
