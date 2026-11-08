/* Quran Flow - one script for every page.
   Data loads only when needed: data/index.json once (home, search), and the verse text of a surah in the
   chosen languages only when a flow in it is opened (data/text/<lang>/<surah>.json, cached for the visit). */
(() => {
  'use strict';
  const BASE = (window.QF && window.QF.base) || '/';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const rng = (s, a, b) => a === b ? `${s}:${a}` : `${s}:${a}–${b}`;

  /* ---------- data ---------- */
  let indexP = null;
  const index = () => indexP || (indexP = fetch(BASE + 'data/index.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  const textCache = new Map();
  const text = (lang, s) => {
    const k = lang + s;
    if (!textCache.has(k)) textCache.set(k, fetch(`${BASE}data/text/${lang}/${s}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
    return textCache.get(k);
  };

  /* ---------- theme ---------- */
  const themeBtn = $('[data-theme-toggle]');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('qf-theme', next); } catch (e) { /* ignore */ }
    if (window.__qfBubbles) window.__qfBubbles();
  });

  /* ---------- analytics, only after consent ---------- */
  const loadGA = () => {
    if (window.__qfGA || !window.QF.ga) return;
    window.__qfGA = true;
    const s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + window.QF.ga;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', window.QF.ga, { anonymize_ip: true });
  };
  const track = (name, params) => { if (window.gtag) window.gtag('event', name, params || {}); };
  let consent = null; try { consent = localStorage.getItem('cookieConsent'); } catch (e) { /* ignore */ }
  const banner = $('#consent');
  if (consent === 'accepted') loadGA(); else if (!consent && banner) banner.hidden = false;
  $$('[data-consent]').forEach(b => b.addEventListener('click', () => {
    try { localStorage.setItem('cookieConsent', b.dataset.consent); } catch (e) { /* ignore */ }
    banner.hidden = true;
    if (b.dataset.consent === 'accepted') loadGA();
  }));
  $$('[data-consent-reset]').forEach(b => b.addEventListener('click', () => {
    try { localStorage.removeItem('cookieConsent'); } catch (e) { /* ignore */ }
    banner.hidden = false;
  }));

  /* ---------- display languages ---------- */
  let langs = store.get('qf-langs', { ar: true, en: true, ta: false });
  const syncLangBoxes = () => $$('[data-lang]').forEach(cb => { cb.checked = !!langs[cb.dataset.lang]; });
  syncLangBoxes();
  $$('[data-lang]').forEach(cb => cb.addEventListener('change', () => {
    langs = { ...langs, [cb.dataset.lang]: cb.checked };
    if (!langs.ar && !langs.en && !langs.ta) { langs.en = true; }
    store.set('qf-langs', langs); syncLangBoxes();
    $$('.fl.open').forEach(li => renderVerses(li));
  }));

  /* ---------- opening a flow ---------- */
  async function renderVerses(li) {
    const box = $('.fl-verses', li);
    const s = +li.dataset.s, a = +li.dataset.a, b = +li.dataset.b;
    const want = ['ar', 'en', 'ta'].filter(l => langs[l]);
    box.innerHTML = '<p class="v-err">Loading verses…</p>';
    try {
      const got = await Promise.all(want.map(l => text(l, s)));
      const t = Object.fromEntries(want.map((l, i) => [l, got[i]]));
      let html = '';
      for (let v = a; v <= b; v++) {
        html += '<div class="v">';
        if (t.ar) html += `<div class="v-ar" lang="ar">${esc(t.ar[v - 1])}<span class="v-mark" aria-label="verse ${v}">${AR(v)}</span></div>`;
        if (t.en) html += `<div class="v-en"><sup>${s}:${v}</sup>${esc(t.en[v - 1])}</div>`;
        if (t.ta) html += `<div class="v-ta" lang="ta"><sup>${s}:${v}</sup>${esc(t.ta[v - 1])}</div>`;
        html += '</div>';
      }
      const q = `https://quran.com/${s}/${a}` + (b !== a ? `-${b}` : '');
      const nm = $('.fl-open', li).textContent; html += `<div class="v-links"><a href="${q}" rel="noopener">Listen and read on quran.com</a><a href="${BASE}surah/${s}/#f-${s}-${a}">Link to this flow</a>${li.dataset.slug ? `<a href="${BASE}topic/${li.dataset.slug}/">Every flow named ${esc(nm)}</a>` : ''}</div>`;
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = `<p class="v-err">The verses could not be loaded (${esc(e.message)}). Check your connection and open the flow again.</p>`;
    }
  }
  function toggle(li, open) {
    const btn = $('.fl-open', li), box = $('.fl-verses', li);
    const willOpen = open !== undefined ? open : box.hidden;
    box.hidden = !willOpen; li.classList.toggle('open', willOpen); btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) { renderVerses(li); track('open_flow', { surah: li.dataset.s, start: li.dataset.a }); }
  }
  document.addEventListener('click', e => {
    // The whole row opens its verses, as on the old site; links, the open verses and text selection are left alone.
    const li = e.target.closest('.fl');
    if (!li || e.target.closest('a, .fl-verses, input, select, label')) return;
    if (!e.target.closest('.fl-open') && String(window.getSelection && window.getSelection()).length) return;
    toggle(li);
  });
  const tbl = $('[data-table]');
  $$('[data-desc]').forEach(cb => { cb.checked = store.get('qf-desc-p', true); if (tbl) tbl.classList.toggle('hide-desc', !cb.checked); cb.addEventListener('change', () => { store.set('qf-desc-p', cb.checked); tbl.classList.toggle('hide-desc', !cb.checked); }); });
  $$('[data-count]').forEach(cb => { cb.checked = store.get('qf-count', true); if (tbl) tbl.classList.toggle('hide-count', !cb.checked); cb.addEventListener('change', () => { store.set('qf-count', cb.checked); tbl.classList.toggle('hide-count', !cb.checked); }); });
  $$('[data-expand-all]').forEach(b => b.addEventListener('click', () => {
    const all = $$('.timeline .fl');
    const anyClosed = all.some(li => !li.classList.contains('open'));
    all.forEach(li => toggle(li, anyClosed));
    b.textContent = anyClosed ? 'Close all' : 'Open all';
  }));
  const hashFlow = () => {
    const m = location.hash.match(/^#f-(\d+)-(\d+)$/);
    if (!m) return;
    const li = document.getElementById(location.hash.slice(1));
    if (li) { toggle(li, true); li.scrollIntoView({ block: 'start' }); }
  };
  if (document.body.dataset.kind !== 'home') { hashFlow(); window.addEventListener('hashchange', hashFlow); }

  /* ---------- search ---------- */
  const dlg = $('#search'), q = $('#q'), results = $('#results');
  let sel = -1, items = [];
  const openSearch = () => { dlg.hidden = false; q.value = ''; results.innerHTML = ''; q.focus(); index().catch(() => {}); };
  const closeSearch = () => { dlg.hidden = true; };
  $$('[data-open-search]').forEach(b => b.addEventListener('click', openSearch));
  $$('[data-close-search]').forEach(b => b.addEventListener('click', closeSearch));
  dlg.addEventListener('click', e => { if (e.target === dlg) closeSearch(); });
  const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim();
  async function runSearch() {
    const raw = q.value.trim();
    if (!raw) { results.innerHTML = ''; items = []; return; }
    let data;
    try { data = await index(); } catch (e) { results.innerHTML = '<li><a href="#">Search is unavailable offline.</a></li>'; return; }
    const out = [];
    const ref = raw.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
    if (ref) {
      const s = +ref[1], v = +ref[2], su = data.surahs[s - 1];
      if (su && v >= 1 && v <= su[4]) {
        const f = data.flows.find(f => f[1] === s && f[2] <= v && f[3] >= v);
        out.push(f ? { href: `${BASE}surah/${s}/#f-${s}-${f[2]}`, title: f[4], meta: rng(s, f[2], f[3]), sub: `Verse ${s}:${v} is in this flow of ${su[1]}` }
                   : { href: `https://quran.com/${s}/${v}`, title: `${su[1]} ${s}:${v}`, meta: 'not grouped yet', sub: 'Read this verse on quran.com' });
      }
    }
    const n = norm(raw);
    if (n) {
      const words = n.split(' ');
      const hit = str => { const h = norm(str); return words.every(w => h.includes(w)); };
      data.surahs.forEach(s => { if (hit(`${s[0]} ${s[1]} ${s[2]}`) || s[3].includes(raw)) out.push({ href: `${BASE}surah/${s[0]}/`, title: `${s[0]}. ${s[1]}`, meta: `${s[4]} verses`, sub: s[2] }); });
      const topics = new Map();
      data.flows.forEach(f => { if (hit(f[4])) { const t = topics.get(f[5]) || { name: f[4], n: 0, v: 0 }; t.n++; t.v += f[3] - f[2] + 1; topics.set(f[5], t); } });
      [...topics.entries()].sort((a, b) => b[1].v - a[1].v).forEach(([slug, t]) => out.push({ href: `${BASE}topic/${slug}/`, title: t.name, meta: `topic · ${t.v} verses`, sub: `${t.n} flow${t.n > 1 ? 's' : ''}` }));
      data.flows.filter(f => !hit(f[4]) && f[6] && hit(f[6])).slice(0, 30).forEach(f => out.push({ href: `${BASE}surah/${f[1]}/#f-${f[1]}-${f[2]}`, title: f[4], meta: rng(f[1], f[2], f[3]), sub: f[6] }));
    }
    items = out.slice(0, 40); sel = items.length ? 0 : -1;
    results.innerHTML = items.length ? items.map((it, i) => `<li><a href="${esc(it.href)}" aria-selected="${i === sel}"><b>${esc(it.title)}</b><em>${esc(it.meta)}</em>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</a></li>`).join('')
      : '<li><a href="#" aria-disabled="true"><b>No match</b><small>Try a topic like Patience or Moses, a surah name, or a verse like 2:255.</small></a></li>';
  }
  let tmr; q.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(runSearch, 120); });
  q.addEventListener('keydown', e => {
    const links = $$('a', results);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!links.length) return;
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((a, i) => a.setAttribute('aria-selected', String(i === sel))); links[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && links[sel] && items.length) { e.preventDefault(); track('search', { term: q.value }); location.href = links[sel].href; closeSearch(); }
  });

  /* ---------- global keys ---------- */
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing && dlg.hidden) { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape' && !dlg.hidden) { closeSearch(); }
  });

  /* ---------- home ---------- */
  if (document.body.dataset.kind === 'home') home();

  function home() {
    const tabs = $$('.tabs [data-view]');
    const show = view => {
      if (!['flows', 'topics', 'surahs'].includes(view)) view = 'flows';
      tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === view)));
      ['flows', 'topics', 'surahs'].forEach(v => { $('#' + v).hidden = v !== view; });
      if (view === 'topics') drawTopics();
    };
    tabs.forEach(t => t.addEventListener('click', () => { history.replaceState(null, '', '#' + t.dataset.view); show(t.dataset.view); }));
    window.addEventListener('hashchange', () => show(location.hash.slice(1)));

    const list = $('#all-flows'), table = $('#flow-table'), fq = $('#f-q'), fs = $('#f-surah'), ft = $('#f-topic'), fd = $('#f-desc'), fc = $('#f-count'), total = $('#f-total');
    fd.checked = store.get('qf-desc', false); fc.checked = store.get('qf-count', true);
    const applyView = () => { table.classList.toggle('hide-desc', !fd.checked); table.classList.toggle('hide-count', !fc.checked); };
    applyView();
    let meta = null, all = null, rows = [], shown = 0, kb = -1, gen = 0, sort = { key: 'no', dir: 1 };
    const chunks = new Map();
    const chunk = k => { if (!chunks.has(k)) chunks.set(k, fetch(`${BASE}data/flows/c${k}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })); return chunks.get(k); };
    const metaP = fetch(BASE + 'data/flows/meta.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const loadAll = async () => { if (!all) all = (await Promise.all(Array.from({ length: meta.chunks }, (_, k) => chunk(k)))).flat(); return all; };
    const surahName = s => meta.surahs[s - 1][1];
    const PAGE = 30;

    function rowHTML(f) {
      return `<li class="fl" id="f-${f[1]}-${f[2]}" data-s="${f[1]}" data-a="${f[2]}" data-b="${f[3]}" data-slug="${f[5]}"><span class="c-no">${f[0]}</span>` +
        `<div class="fl-main"><button class="fl-open" type="button" aria-expanded="false">${esc(f[4])}</button>${f[6] ? `<p class="fl-desc">${esc(f[6])}</p>` : ''}</div>` +
        `<span class="c-rg">${rng(f[1], f[2], f[3])}</span><a class="c-surah" href="${BASE}surah/${f[1]}/">${esc(surahName(f[1]))}</a><span class="c-n">${f[3] - f[2] + 1}</span><div class="fl-verses" hidden></div></li>`;
    }

    /* Rows arrive in two ways. The everyday path (no search, no topic, reading order) pulls one 40-flow
       chunk at a time as the reader nears the end of the list. Anything that needs the whole list
       (search, topic filter, another sort) loads every chunk once and then works in memory. */
    let source = null; // { next: async () => array|null }
    function streamSource(fromIdx, toIdx) {
      let i = fromIdx;
      return { async next() {
        if (i > toIdx) return null;
        const k = Math.floor(i / meta.chunk), part = await chunk(k);
        const start = i - k * meta.chunk, end = Math.min(part.length - 1, toIdx - k * meta.chunk);
        const out = part.slice(start, end + 1); i = (k + 1) * meta.chunk; return out;
      } };
    }
    function arraySource(arr) { let i = 0; return { async next() { if (i >= arr.length) return null; const out = arr.slice(i, i + PAGE); i += PAGE; return out; } }; }

    let io = null, busy = false;
    async function more(my) {
      if (busy || !source) return; busy = true;
      try {
        const got = await source.next();
        if (my !== gen) return;
        $('.sentinel', list)?.remove();
        if (got && got.length) { list.insertAdjacentHTML('beforeend', got.map(rowHTML).join('')); shown += got.length; list.insertAdjacentHTML('beforeend', '<li class="sentinel" aria-hidden="true"></li>'); watch(my); }
        else if (!shown) list.innerHTML = '<li class="empty">No flows match. Clear the search or filters, or press Esc.</li>';
      } catch (e) { if (my === gen) list.insertAdjacentHTML('beforeend', `<li class="empty">Could not load more flows (${esc(e.message)}). Scroll again to retry.</li>`); }
      finally { busy = false; }
    }
    function watch(my) {
      if (io) io.disconnect();
      const s = $('.sentinel', list); if (!s) return;
      io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) more(my); }, { rootMargin: '300px' });
      io.observe(s);
    }

    const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim();
    async function apply() {
      const my = ++gen;
      const q = fq.value.trim(), s = +fs.value || 0, t = ft.value;
      store.set('qf-filter', { s: fs.value, t });
      list.innerHTML = '<li class="loading">Loading flows…</li>'; shown = 0; kb = -1;
      const ref = q.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
      if (!q && !t && sort.key === 'no' && sort.dir === 1) {
        const sp = s ? meta.span[String(s)] : [0, meta.flows - 1];
        source = sp ? streamSource(sp[0], sp[1]) : arraySource([]);
        const n = s ? (sp ? sp[1] - sp[0] + 1 : 0) : meta.flows;
        total.textContent = s ? `${n} flow${n === 1 ? '' : 's'} in ${surahName(s)}` : `${meta.flows.toLocaleString()} flows · ${meta.verses.toLocaleString()} verses`;
      } else {
        const data = await loadAll(); if (my !== gen) return;
        let r = data.filter(f => (!s || f[1] === s) && (!t || f[5] === t));
        if (ref) { const S = +ref[1], V = +ref[2]; r = r.filter(f => f[1] === S && f[2] <= V && f[3] >= V); }
        else if (q) { const w = norm(q).split(' '); r = r.filter(f => { const h = norm(`${f[4]} ${f[6]} ${surahName(f[1])}`); return w.every(x => h.includes(x)); }); }
        const key = { no: f => f[0], name: f => f[4].toLowerCase(), count: f => f[3] - f[2] + 1, surah: f => f[1] * 10000 + f[2] }[sort.key];
        r = r.slice().sort((x, y) => { const a = key(x), b = key(y); return (a < b ? -1 : a > b ? 1 : x[0] - y[0]) * sort.dir; });
        source = arraySource(r);
        const v = r.reduce((n, f) => n + f[3] - f[2] + 1, 0);
        total.textContent = `${r.length} flow${r.length === 1 ? '' : 's'} · ${v} verses`;
      }
      list.innerHTML = ''; await more(my);
    }

    metaP.then(m => {
      meta = m;
      fs.innerHTML = '<option value="">All surahs</option>' + m.surahs.map(s => {
        const sp = m.span[String(s[0])], n = sp ? sp[1] - sp[0] + 1 : 0;
        return `<option value="${s[0]}"${n ? '' : ' disabled'}>${s[0]}. ${esc(s[1])} (${n})</option>`;
      }).join('');
      ft.innerHTML = '<option value="">All topics</option>' + m.topics.map(t => `<option value="${t[0]}">${esc(t[1])} (${t[2]}) (${t[3]} verses)</option>`).join('');
      const st = store.get('qf-filter', {});
      if (st.s && fs.querySelector(`option[value="${st.s}"]:not([disabled])`)) fs.value = st.s;
      if (st.t && ft.querySelector(`option[value="${st.t}"]`)) ft.value = st.t;
      show(location.hash.slice(1));
      apply();
    }).catch(e => { list.innerHTML = `<li class="empty">The flows could not be loaded (${esc(e.message)}). Reload the page to try again.</li>`; });

    let qt; fq.addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(apply, 220); });
    fs.addEventListener('change', apply); ft.addEventListener('change', apply);
    fd.addEventListener('change', () => { store.set('qf-desc', fd.checked); applyView(); });
    fc.addEventListener('change', () => { store.set('qf-count', fc.checked); applyView(); });
    $$('[data-sort]', table).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.sort;
      sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: 1 };
      $$('[data-sort]', table).forEach(x => x.setAttribute('aria-sort', x.dataset.sort === sort.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'));
      apply();
    }));

    document.addEventListener('keydown', e => {
      if ($('#flows').hidden || !dlg.hidden) return;
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (e.key === 'Escape') { fq.value = ''; fs.value = ''; ft.value = ''; sort = { key: 'no', dir: 1 }; $$('[data-sort]', table).forEach(x => x.setAttribute('aria-sort', x.dataset.sort === 'no' ? 'ascending' : 'none')); if (typing) document.activeElement.blur(); apply(); return; }
      if (typing) return;
      const lis = $$('.fl', list);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); if (!lis.length) return;
        kb = Math.max(0, Math.min(lis.length - 1, kb + (e.key === 'ArrowDown' ? 1 : -1)));
        lis.forEach((li, i) => li.classList.toggle('kb', i === kb));
        lis[kb].scrollIntoView({ block: 'nearest' });
      } else if ((e.key === ' ' || e.key === 'Enter') && kb >= 0 && !e.target.closest('button,a')) {
        e.preventDefault(); toggle(lis[kb]);
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && meta) {
        const opts = $$('option:not([disabled])', fs).map(o => o.value);
        const i = opts.indexOf(fs.value), j = Math.max(0, Math.min(opts.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        if (j !== i) { fs.value = opts[j]; apply(); }
      }
    });

    let drawn = false;
    function drawTopics() {
      if (!meta) { metaP.then(drawTopics); return; }
      const topics = meta.topics.map(t => ({ slug: t[0], name: t[1], n: t[2], v: t[3] })).sort((a, b) => b.v - a.v);
      if (!drawn) { $('#topic-list').innerHTML = topics.map(t => `<li><a href="${BASE}topic/${t.slug}/">${esc(t.name)}</a><span>${t.v}</span></li>`).join(''); drawn = true; }
      const box = $('#bubbles');
      /* Apple Watch style field: one packed layout (biggest topics in the middle, sized by verse count),
         dragged, swiped or scrolled around. Bubbles shrink and bunch up toward the edge (a tanh lens), so the
         topics around the one in the centre stay in view. A tap without dragging opens the topic. */
      const draw = () => {
        if (!window.d3) { box.innerHTML = ''; return; }
        const cs = getComputedStyle(document.documentElement), c = k => cs.getPropertyValue(k).trim();
        const W = 1500, root = window.d3.hierarchy({ children: topics }).sum(d => d.v);
        window.d3.pack().size([W, W]).padding(5)(root);
        const leaves = root.leaves(), max = Math.max(...leaves.map(l => l.r));
        leaves.forEach(l => { l.wx = l.x - W / 2; l.wy = l.y - W / 2; });
        const ns = 'http://www.w3.org/2000/svg';
        box.innerHTML = `<p class="bub-hint" aria-hidden="true">Drag, swipe or scroll to explore · tap a topic to open it</p>`;
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${topics.length} topics sized by verse count; the list below has them all`);
        box.appendChild(svg);
        const nodes = leaves.map(l => {
          const big = l.r > max * 0.55, fs = Math.max(11, Math.min(26, l.r / 3.6)), lim = Math.floor((l.r * 1.7) / (fs * 0.56));
          const name = l.data.name.length > lim ? l.data.name.slice(0, Math.max(3, lim - 1)) + '…' : l.data.name;
          const g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'bub'); g.dataset.slug = l.data.slug;
          g.innerHTML = `<title>${esc(l.data.name)}: ${l.data.v} verses in ${l.data.n} flows</title>` +
            `<circle r="${l.r.toFixed(1)}" fill="${big ? c('--accent') : c('--soft')}" stroke="${c('--gold')}" stroke-width="${big ? 0 : 1.2}"></circle>` +
            `<text class="bn" text-anchor="middle" dy="${l.r > 30 ? '-.15em' : '.35em'}" font-size="${fs.toFixed(1)}" fill="${big ? c('--accent-ink') : c('--fg')}">${esc(name)}</text>` +
            (l.r > 30 ? `<text class="bc" text-anchor="middle" dy="${(fs * 0.055 + 1.05).toFixed(2)}em" font-size="${(fs * 0.62).toFixed(1)}" fill="${big ? c('--accent-ink') : c('--muted')}">${l.data.v} verses</text>` : '');
          svg.appendChild(g);
          return { l, g };
        });
        let px = 0, py = 0, vx = 0, vy = 0, zoom = 1, raf = 0;
        const lim = Math.max(...leaves.map(l => Math.hypot(l.wx, l.wy))) * 0.62; // keep the view's centre inside the cluster
        const clamp = () => { const d = Math.hypot(px, py); if (d > lim) { px *= lim / d; py *= lim / d; vx *= 0.5; vy *= 0.5; } };
        let base = 1;
        const render = () => {
          const w = box.clientWidth, h = box.clientHeight, cx = w / 2, cy = h / 2, R = Math.max(w, h) * 0.5;
          base = Math.min(w, h) / 820;
          svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
          for (const { l, g } of nodes) {
            const x = (l.wx + px) * zoom * base, y = (l.wy + py) * zoom * base, d = Math.hypot(x, y) || 1e-6;
            const t = Math.tanh(d / R), k = (R * t) / d, sc = zoom * base * Math.max(0, 1 - 0.8 * Math.pow(t, 3));
            const onScreen = sc * l.r > 2.5;
            g.style.display = onScreen ? '' : 'none';
            if (!onScreen) continue;
            g.setAttribute('transform', `translate(${(cx + x * k).toFixed(1)} ${(cy + y * k).toFixed(1)}) scale(${sc.toFixed(3)})`);
            g.classList.toggle('nolabel', l.r * sc < 14);
            g.classList.toggle('nocount', l.r * sc < 28);
          }
        };
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const glide = () => {
          cancelAnimationFrame(raf);
          if (reduce) return;
          const step = () => {
            vx *= 0.93; vy *= 0.93; px += vx; py += vy; clamp(); render();
            if (Math.abs(vx) + Math.abs(vy) > 0.05) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
        };
        let down = null, moved = 0, last = null;
        box.addEventListener('pointerdown', e => { if (e.button !== 0) return; cancelAnimationFrame(raf); down = { x: e.clientX, y: e.clientY }; last = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; box.setPointerCapture(e.pointerId); box.classList.add('dragging'); });
        box.addEventListener('pointermove', e => {
          if (!down) return;
          const dx = e.clientX - last.x, dy = e.clientY - last.y, now = performance.now(), dt = Math.max(1, now - last.t);
          moved += Math.abs(dx) + Math.abs(dy);
          px += dx / (zoom * base); py += dy / (zoom * base); clamp();
          vx = (dx / (zoom * base)) * (16 / dt); vy = (dy / (zoom * base)) * (16 / dt);
          last = { x: e.clientX, y: e.clientY, t: now }; render();
        });
        const end = e => {
          if (!down) return;
          box.classList.remove('dragging');
          if (moved < 6) {
            const hit = document.elementsFromPoint(e.clientX, e.clientY).map(el => el.closest && el.closest('.bub')).find(Boolean);
            if (hit) { location.href = `${BASE}topic/${hit.dataset.slug}/`; return; }
          } else if (performance.now() - last.t < 80) glide();
          down = null;
        };
        box.addEventListener('pointerup', end); box.addEventListener('pointercancel', () => { down = null; box.classList.remove('dragging'); });
        box.addEventListener('wheel', e => {
          e.preventDefault(); cancelAnimationFrame(raf);
          if (e.ctrlKey) { zoom = Math.max(0.6, Math.min(2.2, zoom * Math.exp(-e.deltaY / 300))); }
          else { px -= e.deltaX / (zoom * base); py -= e.deltaY / (zoom * base); clamp(); }
          render();
        }, { passive: false });
        box.tabIndex = 0;
        box.addEventListener('keydown', e => {
          const m = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
          if (m) { e.preventDefault(); px += m[0]; py += m[1]; clamp(); render(); }
          else if (e.key === '+' || e.key === '=') { zoom = Math.min(2.2, zoom * 1.15); render(); }
          else if (e.key === '-') { zoom = Math.max(0.6, zoom / 1.15); render(); }
          else if (e.key === 'Enter') {
            const w = box.clientWidth, h = box.clientHeight;
            const hit = document.elementsFromPoint(box.getBoundingClientRect().left + w / 2, box.getBoundingClientRect().top + h / 2).map(el => el.closest && el.closest('.bub')).find(Boolean);
            if (hit) location.href = `${BASE}topic/${hit.dataset.slug}/`;
          }
        });
        if (window.ResizeObserver) new ResizeObserver(render).observe(box);
        render();
      };
      window.__qfBubbles = draw;
      if (window.d3) draw(); else window.addEventListener('load', draw, { once: true });
    }
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => window.__qfBubbles && window.__qfBubbles());
  }
})();
