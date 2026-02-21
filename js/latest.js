(async function(){
  const mount = document.getElementById('latest-stories');
  if(!mount) return;

  const render = (items)=>{
    if(!items || !items.length){
      mount.innerHTML = '<div class="card pad"><div class="card-meta">No stories found.</div></div>';
      return;
    }
    mount.innerHTML = items.map((s)=>{
      const safeTitle = (s.title||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const safeDate = (s.date||'').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const safeHref = (s.url||'#');
      const img = s.image ? `<div class="latest-thumb"><img loading="lazy" alt="" src="${s.image}"></div>` : `<div class="latest-thumb"></div>`;
      return `
        <a class="latest-card" href="${safeHref}" target="_blank" rel="noopener">
          ${img}
          <div>
            <div class="latest-title">${safeTitle}</div>
            <div class="latest-meta">${safeDate ? safeDate : 'CBS Sports'}</div>
          </div>
        </a>`;
    }).join('');
  };

  try{
    const res = await fetch('/api/latest', { cache: 'no-store' });
    const data = await res.json();
    if(!res.ok) throw new Error(data?.error || 'Request failed');
    render(data.items?.slice(0,3));
  }catch(e){
    mount.innerHTML = `<div class="card pad"><div class="card-meta">Latest stories unavailable. (${(e && e.message) ? e.message : 'error'})</div></div>`;
  }
})();
