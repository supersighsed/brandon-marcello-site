async function loadLatestStories() {
  const el = document.getElementById("latest-stories");
  if (!el) return;

  try {
    const r = await fetch("/api/latest", { cache: "no-store" });
    const data = await r.json();

    if (!data.stories || !data.stories.length) throw new Error("No stories returned");

    el.innerHTML = data.stories
      .slice(0, 3)
      .map(
        (s) => `
        <div class="item">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <a href="${s.link}" target="_blank" rel="noreferrer">${s.title}</a>
            <div class="meta">CBS Sports • Latest</div>
          </div>
          <span class="tag">Latest</span>
        </div>
      `
      )
      .join("");
  } catch (err) {
    el.innerHTML = `
      <div class="item">
        <a href="https://www.cbssports.com/writers/brandon-marcello/" target="_blank" rel="noreferrer">
          View latest stories at CBS Sports →
        </a>
        <span class="tag">Fallback</span>
      </div>
    `;
  }
}

loadLatestStories();
