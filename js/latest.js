function formatDate(iso) {
  if (!iso) return "Latest";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Latest";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function loadLatestStories() {
  const el = document.getElementById("latest-stories");
  if (!el) return;

  try {
    const r = await fetch("/api/latest", { cache: "no-store" });
    const data = await r.json();
    const stories = (data.stories || []).slice(0, 3);
    if (!stories.length) throw new Error("No stories returned");

    el.innerHTML = stories
      .map((s) => {
        const img = s.image
          ? `<div class="latest-thumb"><img src="${s.image}" alt=""></div>`
          : `<div class="latest-thumb latest-thumb--empty"></div>`;

        return `
          <a class="latest-card" href="${s.link}" target="_blank" rel="noreferrer">
            ${img}
            <div class="latest-body">
              <div class="latest-title">${s.title}</div>
              <div class="latest-meta">CBS Sports • ${formatDate(s.published)}</div>
            </div>
          </a>
        `;
      })
      .join("");
  } catch (err) {
    el.innerHTML = `
      <a class="latest-card" href="https://www.cbssports.com/writers/brandon-marcello/" target="_blank" rel="noreferrer">
        <div class="latest-thumb latest-thumb--empty"></div>
        <div class="latest-body">
          <div class="latest-title">View latest stories at CBS Sports →</div>
          <div class="latest-meta">Fallback</div>
        </div>
      </a>
    `;
  }
}

loadLatestStories();
