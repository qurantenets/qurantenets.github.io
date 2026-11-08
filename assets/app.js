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
    const b = document.getElementById('bubbles');
    if (window.__qfBubbles && b && b.offsetParent) window.__qfBubbles(); // hidden: the Topics tab redraws when opened
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

    const list = $('#all-flows'), table = $('#flow-table'), fq = $('#f-q'), fs = $('#f-surah'), fchips = $('#f-chips'), fac = $('#f-ac'), fd = $('#f-desc'), fc = $('#f-count'), total = $('#f-total');
    fd.checked = store.get('qf-desc', false); fc.checked = store.get('qf-count', true);
    const applyView = () => { table.classList.toggle('hide-desc', !fd.checked); table.classList.toggle('hide-count', !fc.checked); };
    applyView();
    let meta = null, all = null, rows = [], shown = 0, kb = -1, gen = 0, sort = { key: 'no', dir: 1 };
    const chunks = new Map();
    const chunk = k => { if (!chunks.has(k)) chunks.set(k, fetch(`${BASE}data/flows/c${k}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })); return chunks.get(k); };
    const metaP = fetch(BASE + 'data/flows/meta.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    // Search, topic filters and sorting read the one compact index (one request, cached), never every list chunk.
    const loadAll = async () => { if (!all) all = (await index()).flows; return all; };
    const surahName = s => meta.surahs[s - 1][1];
    const PAGE = 30, DWELL_MS = 2000, AHEAD_PX = 300;
    const moreEl = $('#flows-more');

    function rowHTML(f) {
      return `<li class="fl" id="f-${f[1]}-${f[2]}" data-s="${f[1]}" data-a="${f[2]}" data-b="${f[3]}" data-slug="${f[5]}"><span class="c-no">${f[0]}</span>` +
        `<div class="fl-main"><button class="fl-open" type="button" aria-expanded="false">${esc(f[4])}</button>${f[6] ? `<p class="fl-desc">${esc(f[6])}</p>` : ''}</div>` +
        `<span class="c-rg">${rng(f[1], f[2], f[3])}</span><a class="c-surah" href="${BASE}surah/${f[1]}/">${esc(surahName(f[1]))}</a><span class="c-n">${f[3] - f[2] + 1}</span><div class="fl-verses" hidden></div></li>`;
    }

    /* Rows arrive in two ways. The everyday path (no search, no topic, reading order) pulls one 40-flow
       chunk at a time as the reader stays at the end of the list. Anything that needs the whole list
       (search, topic chips, another sort) reads the one search index, fetched once, and works in memory. */
    let source = null; // { next: async () => array|null }
    function streamSource(fromIdx, toIdx) {
      let i = fromIdx;
      return { left: () => i <= toIdx, async next() {
        if (i > toIdx) return null;
        const k = Math.floor(i / meta.chunk), part = await chunk(k);
        const start = i - k * meta.chunk, end = Math.min(part.length - 1, toIdx - k * meta.chunk);
        const out = part.slice(start, end + 1); i = (k + 1) * meta.chunk; return out;
      } };
    }
    function arraySource(arr) { let i = 0; return { left: () => i < arr.length, async next() { if (i >= arr.length) return null; const out = arr.slice(i, i + PAGE); i += PAGE; return out; } }; }

    /* Loading more, as on manapparai.tech: when the end of the list comes within AHEAD_PX of the screen the
       loader shows and we wait DWELL_MS; only if the end is still there do we fetch the next batch. Scrolling
       away cancels the wait, so flicking past the end loads nothing. */
    let busy = false, dwell = 0;
    const isNear = () => { const r = moreEl.getBoundingClientRect(); return r.top < window.innerHeight + AHEAD_PX && r.bottom > 0; };
    function nearEnd() {
      if (moreEl.hidden || busy || dwell || !isNear() || $('#flows').hidden) return;
      moreEl.dataset.loading = '';
      const my = gen;
      dwell = window.setTimeout(() => { dwell = 0; if (my === gen && !moreEl.hidden && isNear()) more(my); else if (!busy) delete moreEl.dataset.loading; }, DWELL_MS);
    }
    function awayFromEnd() { window.clearTimeout(dwell); dwell = 0; if (!busy) delete moreEl.dataset.loading; }
    new IntersectionObserver(es => { if (es[es.length - 1].isIntersecting) nearEnd(); else awayFromEnd(); }, { rootMargin: `0px 0px ${AHEAD_PX}px 0px` }).observe(moreEl);
    const dropSkeleton = () => { for (const x of $$('.sk', list)) x.parentNode.removeChild(x); };
    async function more(my) {
      if (busy || !source) return; busy = true; moreEl.dataset.loading = '';
      try {
        const got = await source.next();
        if (my !== gen) return;
        dropSkeleton();
        if (got && got.length) { list.insertAdjacentHTML('beforeend', got.map(rowHTML).join('')); shown += got.length; }
        else if (!shown) list.innerHTML = '<li class="empty">No flows match. Clear the search or filters, or press Esc.</li>';
        moreEl.hidden = !source.left();
      } catch (e) { if (my === gen) { dropSkeleton(); list.insertAdjacentHTML('beforeend', `<li class="empty">Could not load more flows (${esc(e.message)}). Scroll again to retry.</li>`); } }
      finally { busy = false; if (my === gen) { delete moreEl.dataset.loading; nearEnd(); } }
    }
    const skeleton = n => Array.from({ length: n }, () => '<li class="sk" aria-hidden="true"><span class="skel w6"></span><span class="skel w40"></span><span class="skel w14"></span><span class="skel w20"></span><span class="skel w6"></span></li>').join('');

    const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim();
    async function apply() {
      const my = ++gen;
      const q = fq.value.trim(), s = +fs.value || 0, t = [...sel];
      store.set('qf-filter', { s: fs.value }); store.set('qf-topics', t);
      awayFromEnd(); moreEl.hidden = true;
      list.innerHTML = skeleton(8); shown = 0; kb = -1;
      const ref = q.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
      if (!q && !t.length && sort.key === 'no' && sort.dir === 1) {
        const sp = s ? meta.span[String(s)] : [0, meta.flows - 1];
        source = sp ? streamSource(sp[0], sp[1]) : arraySource([]);
        const n = s ? (sp ? sp[1] - sp[0] + 1 : 0) : meta.flows;
        total.textContent = s ? `${n} flow${n === 1 ? '' : 's'} in ${surahName(s)}` : `${meta.flows.toLocaleString()} flows · ${meta.verses.toLocaleString()} verses`;
      } else {
        const data = await loadAll(); if (my !== gen) return;
        let r = data.filter(f => (!s || f[1] === s) && (!t.length || sel.has(f[5])));
        if (ref) { const S = +ref[1], V = +ref[2]; r = r.filter(f => f[1] === S && f[2] <= V && f[3] >= V); }
        else if (q) { const w = norm(q).split(' '); r = r.filter(f => { const h = norm(`${f[4]} ${f[6]} ${surahName(f[1])}`); return w.every(x => h.includes(x)); }); }
        const key = { no: f => f[0], name: f => f[4].toLowerCase(), count: f => f[3] - f[2] + 1, surah: f => f[1] * 10000 + f[2] }[sort.key];
        r = r.slice().sort((x, y) => { const a = key(x), b = key(y); return (a < b ? -1 : a > b ? 1 : x[0] - y[0]) * sort.dir; });
        source = arraySource(r);
        const v = r.reduce((n, f) => n + f[3] - f[2] + 1, 0);
        total.textContent = `${r.length} flow${r.length === 1 ? '' : 's'} · ${v} verses`;
      }
      await more(my);
    }

    metaP.then(m => {
      meta = m;
      fs.innerHTML = '<option value="">All surahs</option>' + m.surahs.map(s => {
        const sp = m.span[String(s[0])], n = sp ? sp[1] - sp[0] + 1 : 0;
        return `<option value="${s[0]}"${n ? '' : ' disabled'}>${s[0]}. ${esc(s[1])} (${n})</option>`;
      }).join('');
      const st = store.get('qf-filter', {});
      if (st.s && fs.querySelector(`option[value="${st.s}"]:not([disabled])`)) fs.value = st.s;
      m.topics.forEach(t => topicBy.set(t[0], t));
      store.get('qf-topics', []).forEach(x => { if (topicBy.has(x)) sel.add(x); }); if (st.t && topicBy.has(st.t)) sel.add(st.t);
      drawChips();
      show(location.hash.slice(1));
      apply();
    }).catch(e => { list.innerHTML = `<li class="empty">The flows could not be loaded (${esc(e.message)}). Reload the page to try again.</li>`; });

    /* Topic chips: pick several topics; the list shows flows under any of them. Typed text that is not
       picked stays a text search (names, descriptions, surah names) or a verse reference like 2:255. */
    const sel = new Set(), topicBy = new Map();
    let acSel = -1, acOpts = [];
    function drawChips() {
      fchips.innerHTML = [...sel].map(slug => { const t = topicBy.get(slug); return t ? `<span class="f-chip">${esc(t[1])}<small>${t[3]}</small><button type="button" data-unchip="${slug}" aria-label="Remove ${esc(t[1])}">×</button></span>` : ''; }).join('');
    }
    function drawAc() {
      const q = norm(fq.value);
      acOpts = !meta || !q ? [] : meta.topics.filter(t => !sel.has(t[0]) && norm(t[1]).includes(q)).sort((a, b) => b[3] - a[3]).slice(0, 12);
      fac.innerHTML = acOpts.map((t, i) => `<li role="option" data-i="${i}" aria-selected="${i === acSel}">${esc(t[1])}<small>${t[2]} flows · ${t[3]} verses</small></li>`).join('');
      fac.hidden = !acOpts.length;
    }
    function pick(t) { sel.add(t[0]); fq.value = ''; acSel = -1; fac.hidden = true; drawChips(); apply(); fq.focus(); }
    fchips.addEventListener('click', e => { const b = e.target.closest('[data-unchip]'); if (b) { sel.delete(b.dataset.unchip); drawChips(); apply(); } });
    fac.addEventListener('mousedown', e => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); pick(acOpts[+li.dataset.i]); } });
    fq.addEventListener('blur', () => setTimeout(() => { fac.hidden = true; }, 150));
    fq.addEventListener('focus', drawAc);
    fq.addEventListener('keydown', e => {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && acOpts.length) { e.preventDefault(); acSel = Math.max(0, Math.min(acOpts.length - 1, acSel + (e.key === 'ArrowDown' ? 1 : -1))); drawAc(); }
      else if (e.key === 'Enter' && !fac.hidden && acOpts.length) { e.preventDefault(); pick(acOpts[acSel >= 0 ? acSel : 0]); }
      else if (e.key === 'Backspace' && !fq.value && sel.size) { sel.delete([...sel].pop()); drawChips(); apply(); }
    });
    $('#f-tags').addEventListener('click', e => { if (e.target.id === 'f-tags' || e.target.id === 'f-chips') fq.focus(); });

    let qt; fq.addEventListener('input', () => { acSel = -1; drawAc(); clearTimeout(qt); qt = setTimeout(apply, 220); });
    fs.addEventListener('change', apply);
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
      if (e.key === 'Escape') { if (!fac.hidden) { fac.hidden = true; return; } fq.value = ''; fs.value = ''; sel.clear(); drawChips(); sort = { key: 'no', dir: 1 }; $$('[data-sort]', table).forEach(x => x.setAttribute('aria-sort', x.dataset.sort === 'no' ? 'ascending' : 'none')); if (typing) document.activeElement.blur(); apply(); return; }
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
         topics around the one in the centre stay in view. Tapping a topic that is small or far out glides it to
         the centre and zooms in; tapping a topic you can read opens it. */
      const draw = () => {
        if (!window.d3) { box.innerHTML = ''; return; }
        if (box._qf) box._qf.abort(); // a redraw (theme change) replaces the old listeners, never adds to them
        const ac = box._qf = new AbortController(), on = (t, f, o) => box.addEventListener(t, f, { ...o, signal: ac.signal });
        const cs = getComputedStyle(document.documentElement), c = k => cs.getPropertyValue(k).trim();
        const W = 1500, root = window.d3.hierarchy({ children: topics }).sum(d => Math.max(d.v, 8)); // a floor keeps 1-7 verse topics tappable; the label shows the real count
        window.d3.pack().size([W, W]).padding(5)(root);
        const leaves = root.leaves(), max = Math.max(...leaves.map(l => l.r));
        leaves.forEach(l => { l.wx = l.x - W / 2; l.wy = l.y - W / 2; });

        /* The whole name always sits inside its circle, never cut short. Every way of breaking it into lines is
           measured in the real font, and the break that allows the biggest type wins (fewer lines on a near tie).
           Each line's full height in the font (ascent to descent) and its width must clear the circle's edge, both
           with the verse count under it and re-centred when the count is too small to show. Small circles get
           small type that becomes readable as you zoom in. */
        // Measured with an SVG text styled exactly like the labels (optical sizing off, so width scales with size).
        const ns = 'http://www.w3.org/2000/svg';
        box.innerHTML = '<p class="bub-hint" aria-hidden="true">Drag to explore · pinch, Ctrl+scroll or + − to zoom · tap a small topic to bring it close, tap again to open</p>' +
          '<div class="bub-zoom"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button></div>';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${topics.length} topics sized by verse count; the list below has them all`);
        box.appendChild(svg);
        const meas = document.createElementNS(ns, 'text'); meas.setAttribute('font-size', '100'); meas.setAttribute('visibility', 'hidden'); svg.appendChild(meas);
        const em = t => { meas.textContent = t; return meas.getComputedTextLength() / 100; };
        meas.textContent = 'Hg'; const mb = meas.getBBox();
        const ASC = -mb.y / 100 || 0.92, DSC = (mb.height + mb.y) / 100 || 0.26; // the font's ascent and descent, in ems
        const LH = 1.16, CS = 0.62, CG = 0.08; // line step, count size and the gap above the count, in ems of the name
        const layout = (name, count, r) => {
          const words = name.split(/\s+/).filter(Boolean), n = words.length, R = r * 0.9, cands = [];
          const reach = (w, y0, y1) => R / Math.hypot(w / 2, Math.max(Math.abs(y0), Math.abs(y1))); // largest type that keeps this box inside
          for (let mask = 0; mask < 1 << (n - 1); mask++) {
            const lines = [words[0]];
            for (let i = 1; i < n; i++) { if (mask & (1 << (i - 1))) lines.push(words[i]); else lines[lines.length - 1] += ' ' + words[i]; }
            const body = ASC + (lines.length - 1) * LH + DSC, H = body + CG + CS * (ASC + DSC);
            const top = -H / 2, sh = (H - body) / 2; // sh: how far the name moves down when the count is hidden
            let f = reach(em(count) * CS, top + body + CG, H / 2);
            lines.forEach((t, i) => {
              const b = top + ASC + i * LH, w = em(t);
              f = Math.min(f, reach(w, b - ASC, b + DSC), reach(w, b - ASC + sh, b + DSC + sh));
            });
            cands.push({ f, lines, top, sh, body });
          }
          const best = Math.max(...cands.map(x => x.f));
          const pick = cands.filter(x => x.f >= best * 0.96).sort((x, y) => x.lines.length - y.lines.length || y.f - x.f)[0];
          return { ...pick, fs: Math.min(pick.f, r / 2.6, 30) };
        };

        const nodes = leaves.map(l => {
          const big = l.r > max * 0.55, count = `${l.data.v} verse${l.data.v === 1 ? '' : 's'}`;
          const { fs, lines, top, sh, body } = layout(l.data.name, count, l.r), y = e => (e * fs).toFixed(2);
          const g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'bub'); g.dataset.slug = l.data.slug;
          g.style.setProperty('--sh', `${y(sh)}px`); // re-centres the name when the count is hidden
          g.innerHTML = `<title>${esc(l.data.name)}: ${l.data.v} verses in ${l.data.n} flows</title>` +
            `<circle r="${l.r.toFixed(1)}" fill="${big ? c('--accent') : c('--soft')}" stroke="${c('--gold')}" stroke-width="${big ? 0 : 1.2}"></circle>` +
            `<text class="bn" text-anchor="middle" font-size="${fs.toFixed(2)}" fill="${big ? c('--accent-ink') : c('--fg')}">` +
            lines.map((t, i) => `<tspan x="0" y="${y(top + ASC + i * LH)}">${esc(t)}</tspan>`).join('') + '</text>' +
            `<text class="bc" text-anchor="middle" x="0" y="${y(top + body + CG + CS * ASC)}" font-size="${(fs * CS).toFixed(2)}" fill="${big ? c('--accent-ink') : c('--muted')}">${count}</text>`;
          svg.appendChild(g);
          return { l, g, fs, sc: 0 };
        });
        meas.remove();
        const bySlug = new Map(nodes.map(n => [n.l.data.slug, n]));
        const fsMin = Math.min(...nodes.map(n => n.fs));

        let px = 0, py = 0, vx = 0, vy = 0, zoom = 1, raf = 0, anim = 0, base = 1;
        const lim = Math.max(...leaves.map(l => Math.hypot(l.wx, l.wy) + l.r)); // every bubble, the outermost too, can be brought to the centre
        const clamp = () => { const d = Math.hypot(px, py); if (d > lim) { px *= lim / d; py *= lim / d; vx *= 0.5; vy *= 0.5; } };
        const Z_MIN = 0.6, zMax = () => Math.max(2.6, 18 / (fsMin * base)); // deep enough that the smallest topic's name reads at about 18px
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const render = () => {
          const w = box.clientWidth, h = box.clientHeight, cx = w / 2, cy = h / 2, R = Math.max(w, h) * 0.5;
          base = Math.min(w, h) / 820;
          svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
          for (const nd of nodes) {
            const { l, g } = nd;
            const x = (l.wx + px) * zoom * base, y = (l.wy + py) * zoom * base, d = Math.hypot(x, y) || 1e-6;
            // Shrink each bubble by exactly as much as the lens squeezes the space around it (d/dd of R·tanh(d/R)
            // is 1 − t²), so bubbles near the edge get smaller instead of piling on top of each other.
            const t = Math.tanh(d / R), k = (R * t) / d, sc = zoom * base * (1 - t * t);
            nd.sc = sc;
            const onScreen = sc * l.r > 2.5;
            g.style.display = onScreen ? '' : 'none';
            if (!onScreen) continue;
            g.setAttribute('transform', `translate(${(cx + x * k).toFixed(1)} ${(cy + y * k).toFixed(1)}) scale(${sc.toFixed(4)})`);
            g.classList.toggle('nolabel', nd.fs * sc < 6.5); // too small to read yet: zoom in, or tap it
            g.classList.toggle('nocount', nd.fs * CS * sc < 7);
          }
        };
        /* Zoom about a point on screen (ox, oy from the centre): undo the lens there, find the spot in the field
           under it, and move the field so that spot stays put. */
        const zoomAt = (z, ox = 0, oy = 0) => {
          z = Math.max(Z_MIN, Math.min(zMax(), z));
          const R = Math.max(box.clientWidth, box.clientHeight) * 0.5, ds = Math.hypot(ox, oy);
          const f = ds > 1e-6 ? (R * Math.atanh(Math.min(ds / R, 0.995))) / ds : 1, qx = ox * f, qy = oy * f;
          const wx = qx / (zoom * base) - px, wy = qy / (zoom * base) - py;
          zoom = z; px = qx / (zoom * base) - wx; py = qy / (zoom * base) - wy; clamp();
        };
        const stop = () => { cancelAnimationFrame(raf); cancelAnimationFrame(anim); };
        const animateTo = (tx, ty, tz) => {
          stop(); tz = Math.max(Z_MIN, Math.min(zMax(), tz));
          if (reduce) { px = tx; py = ty; zoom = tz; clamp(); render(); return; }
          const fx = px, fy = py, fz = zoom, t0 = performance.now(), T = 420;
          const step = now => {
            const u = Math.min(1, (now - t0) / T), e = 1 - Math.pow(1 - u, 3);
            px = fx + (tx - fx) * e; py = fy + (ty - fy) * e; zoom = fz * Math.pow(tz / fz, e); clamp(); render();
            if (u < 1) anim = requestAnimationFrame(step);
          };
          anim = requestAnimationFrame(step);
        };
        const glide = () => {
          stop();
          if (reduce) return;
          const step = () => {
            vx *= 0.93; vy *= 0.93; px += vx; py += vy; clamp(); render();
            if (Math.abs(vx) + Math.abs(vy) > 0.05) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
        };
        // A topic you can read opens; one that is small or far out comes to the centre, large enough to read.
        const openOrBring = nd => {
          if (nd.fs * nd.sc >= 12) { location.href = `${BASE}topic/${nd.l.data.slug}/`; return; }
          const fit = (Math.min(box.clientWidth, box.clientHeight) * 0.42) / (nd.l.r * base); // no bigger than the view
          animateTo(-nd.l.wx, -nd.l.wy, Math.min(fit, Math.max(zoom, 18 / (nd.fs * base))));
        };
        const hitAt = (x, y) => { const el = document.elementsFromPoint(x, y).map(e => e.closest && e.closest('.bub')).find(Boolean); return el && bySlug.get(el.dataset.slug); };

        let down = null, moved = 0, last = null;
        const pts = new Map(); let pinch = null;
        on('pointerdown', e => {
          if (e.button !== 0 || e.target.closest('.bub-zoom')) return;
          stop(); try { box.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or lost pointer: dragging still works */ }
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pts.size === 2) { const [p1, p2] = [...pts.values()]; pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), z: zoom }; moved = 99; return; }
          down = { x: e.clientX, y: e.clientY }; last = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; box.classList.add('dragging');
        });
        on('pointermove', e => {
          if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinch && pts.size === 2) {
            const [p1, p2] = [...pts.values()], rc = box.getBoundingClientRect();
            zoomAt(pinch.z * Math.hypot(p1.x - p2.x, p1.y - p2.y) / pinch.d, (p1.x + p2.x) / 2 - rc.left - rc.width / 2, (p1.y + p2.y) / 2 - rc.top - rc.height / 2);
            render(); return;
          }
          if (!down) return;
          const dx = e.clientX - last.x, dy = e.clientY - last.y, now = performance.now(), dt = Math.max(1, now - last.t);
          moved += Math.abs(dx) + Math.abs(dy);
          px += dx / (zoom * base); py += dy / (zoom * base); clamp();
          vx = (dx / (zoom * base)) * (16 / dt); vy = (dy / (zoom * base)) * (16 / dt);
          last = { x: e.clientX, y: e.clientY, t: now }; render();
        });
        const end = e => {
          pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
          if (!down) return;
          box.classList.remove('dragging');
          if (moved < 6) { const nd = hitAt(e.clientX, e.clientY); if (nd) openOrBring(nd); }
          else if (performance.now() - last.t < 80) glide();
          down = null;
        };
        on('pointerup', end); on('pointercancel', e => { pts.delete(e.pointerId); pinch = null; down = null; box.classList.remove('dragging'); });
        on('click', e => { const b = e.target.closest('.bub-zoom button'); if (b) animateTo(px, py, zoom * (b.dataset.z === 'in' ? 1.6 : 1 / 1.6)); });
        on('wheel', e => {
          e.preventDefault(); stop();
          if (e.ctrlKey) { const rc = box.getBoundingClientRect(); zoomAt(zoom * Math.exp(-e.deltaY / 300), e.clientX - rc.left - rc.width / 2, e.clientY - rc.top - rc.height / 2); }
          else { px -= e.deltaX / (zoom * base); py -= e.deltaY / (zoom * base); clamp(); }
          render();
        }, { passive: false });
        box.tabIndex = 0;
        on('keydown', e => {
          const m = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
          if (m) { e.preventDefault(); stop(); px += m[0] / zoom; py += m[1] / zoom; clamp(); render(); }
          else if (e.key === '+' || e.key === '=') animateTo(px, py, zoom * 1.4);
          else if (e.key === '-') animateTo(px, py, zoom / 1.4);
          else if (e.key === 'Enter' && !e.target.closest('.bub-zoom')) {
            const rc = box.getBoundingClientRect(), nd = hitAt(rc.left + rc.width / 2, rc.top + rc.height / 2);
            if (nd) openOrBring(nd);
          }
        });
        if (box._ro) box._ro.disconnect();
        if (window.ResizeObserver) { box._ro = new ResizeObserver(render); box._ro.observe(box); }
        render();
      };
      window.__qfBubbles = draw;
      // Measure names in the real font, so wait for it (it is already loading for the page).
      const go = () => (document.fonts && document.fonts.load ? document.fonts.load('400 16px Literata').then(draw, draw) : draw());
      if (window.d3) go(); else window.addEventListener('load', go, { once: true });
    }
    // Redraw for the new colours only while the field is on screen (labels are measured, which needs it shown);
    // opening the Topics tab always draws afresh anyway.
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { const b = $('#bubbles'); if (window.__qfBubbles && b && b.offsetParent) window.__qfBubbles(); });
  }
})();
