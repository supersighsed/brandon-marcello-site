export default async function handler(req, res) {
  try {
    const url = 'https://www.cbssports.com/writers/brandon-marcello/';
    const r = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; BrandonMarcelloSite/1.0; +https://www.brandonmarcello.com)'
      }
    });

    if (!r.ok) {
      return res.status(502).json({ error: `Upstream fetch failed (${r.status})` });
    }

    const html = await r.text();

    // Strategy A: pull article cards with href + title + time if present
    // CBS markup changes; we keep two heuristics.

    const items = [];

    // Heuristic 1: JSON-LD (often present on writer pages)
    const ldMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (ldMatch) {
      try {
        const json = JSON.parse(ldMatch[1].trim());
        // Writer pages may have ItemList
        const list = json?.itemListElement || json?.['@graph']?.find?.(n => n?.itemListElement)?.itemListElement;
        if (Array.isArray(list)) {
          for (const el of list) {
            const u = el?.url || el?.item?.url;
            const name = el?.name || el?.item?.name;
            if (u && name) items.push({ url: u, title: name });
          }
        }
      } catch (_) {}
    }

    // Heuristic 2: HTML anchors within writer feed
    if (items.length < 3) {
      const re = /<a[^>]+href="(\/college-football\/news\/[^"]+)"[^>]*>(?:[\s\S]*?)<\/a>/gi;
      const seen = new Set(items.map(i => i.url));
      let m;
      while ((m = re.exec(html)) && items.length < 10) {
        const path = m[1];
        const full = `https://www.cbssports.com${path}`;
        if (seen.has(full)) continue;
        // Try to grab a title nearby
        const chunk = html.slice(Math.max(0, m.index - 400), Math.min(html.length, m.index + 900));
        const t = chunk.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i) || chunk.match(/title="([^"]+)"/i);
        let title = t ? (t[1] || '').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim() : '';
        if (!title) continue;
        items.push({ url: full, title });
        seen.add(full);
      }
    }

    if (!items.length) {
      return res.status(500).json({ error: 'No stories found (regex/markup mismatch)' });
    }

    // Enrich first 3 with OG image + date by fetching each story page (lightweight)
    const top = items.slice(0, 3);
    const enriched = await Promise.all(top.map(async (it) => {
      try {
        const pr = await fetch(it.url, {
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; BrandonMarcelloSite/1.0; +https://www.brandonmarcello.com)' }
        });
        if (!pr.ok) return it;
        const phtml = await pr.text();
        const og = phtml.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
        const dt = phtml.match(/<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i)
               || phtml.match(/<time[^>]+datetime="([^"]+)"/i);
        const date = dt ? dt[1] : '';
        return {
          ...it,
          image: og ? og[1] : undefined,
          date: date ? new Date(date).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : ''
        };
      } catch { return it; }
    }));

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    return res.status(200).json({ items: enriched });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}
