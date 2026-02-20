async function loadLatestStories() {
  const container = document.getElementById("latest-stories");

  try {
    const response = await fetch(
      "https://api.rss2json.com/v1/api.json?rss_url=https://www.cbssports.com/rss/headlines/college-football/"
    );

    const data = await response.json();

    // Filter only Brandon Marcello stories
    const marcelloStories = data.items.filter(item =>
      item.link.includes("/writers/brandon-marcello/") ||
      item.author === "Brandon Marcello"
    );

    // Take latest 3
    const latest = marcelloStories.slice(0, 3);

    container.innerHTML = latest.map(story => `
      <div class="item">
        <div>
          <a href="${story.link}" target="_blank">${story.title}</a>
          <div class="meta">CBS Sports • ${new Date(story.pubDate).toLocaleDateString()}</div>
        </div>
        <span class="tag">Latest</span>
      </div>
    `).join("");

  } catch (error) {
    container.innerHTML = `
      <div class="item">
        <a href="https://www.cbssports.com/writers/brandon-marcello/" target="_blank">
          View latest stories at CBS Sports →
        </a>
      </div>
    `;
  }
}

loadLatestStories();
