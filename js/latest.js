(function () {
  const mount = document.getElementById("latest-stories");
  if (!mount) return;

  function card(item) {
    const a = document.createElement("a");
    a.className = "latest-card";
    a.href = item.url || "#";
    a.target = "_blank";
    a.rel = "noreferrer";

    const thumb = document.createElement("div");
    thumb.className = "latest-thumb";

    if (item.image) {
      const img = document.createElement("img");
      img.src = item.image;
      img.alt = "";
      thumb.appendChild(img);
    } else {
      thumb.classList.add("latest-thumb--empty");
    }

    const body = document.createElement("div");
    body.className = "latest-body";

    const title = document.createElement("div");
    title.className = "latest-title";
    title.textContent = item.title || "";

    const meta = document.createElement("div");
    meta.className = "latest-meta";
    meta.textContent = item.date ? `CBS Sports • ${item.date}` : "CBS Sports";

    body.appendChild(title);
    body.appendChild(meta);

    a.appendChild(thumb);
    a.appendChild(body);

    return a;
  }

  async function run() {
    try {
      const res = await fetch("/api/latest", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");

      const items = (data.items || []).slice(0, 3);
      mount.innerHTML = "";

      if (!items.length) {
        mount.textContent = "No stories found.";
        return;
      }

      items.forEach((it) => mount.appendChild(card(it)));
    } catch (e) {
      mount.textContent = `Latest stories unavailable. (${e && e.message ? e.message : "error"})`;
    }
  }

  run();
})();
