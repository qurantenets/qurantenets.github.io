/* Quran Flow - one script for every page.
   Only what the reader looks at is loaded, each file once per visit: a flow's own verses when it is opened
   (data/v), a topic's flows when it is tapped (data/topic), a small map of all flows for verse lookups and
   favourites (data/map.json), a whole surah only when reading it through (data/text), and the full flow index
   (data/index.json) only for searching flow descriptions and the Flows page filters. */
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
    // A saved value of the wrong shape (edited by hand, or left by an older version) counts as nothing saved.
    arr(k) { const v = store.get(k, []); return Array.isArray(v) ? v : []; },
    obj(k) { const v = store.get(k, {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; },
  };
  const rng = (s, a, b) => a === b ? `${s}:${a}` : `${s}:${a}–${b}`;
  const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`; // "1 verse", "2 verses"
  const LOADING = msg => `<p class="v-load" role="status"><span class="qf-loader" aria-hidden="true"></span>${esc(msg)}</p>`;

  /* ---------- data ---------- */
  const files = new Map();
  const getJSON = path => { // each file once per visit; a failed one is forgotten so the next try fetches it again
    if (!files.has(path)) {
      const p = fetch(BASE + path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      files.set(path, p); p.catch(() => files.delete(path));
    }
    return files.get(path);
  };
  const index = () => getJSON('data/index.json');
  const qmap = () => getJSON('data/map.json');
  // Tamil: the Tanzil text stores most vowel signs in two parts (e.g. ொ as ெ + ா); search compares both sides in
  // one form (NFC) so what people type matches. The text itself is shown exactly as published.
  const NFC = s => String(s).normalize('NFC');
  const isTa = s => /[\u0B80-\u0BFF]/.test(s);
  // A topic's search helpers (data/synonyms.json, "|"-joined): the first one the typed words fit, or ''.
  const relatedWord = (syn, raw, words) => {
    if (!syn || (!isTa(raw) && raw.trim().length < 3)) return '';
    const q = NFC(raw.trim());
    return syn.split('|').find(w => (isTa(raw) ? NFC(w).includes(q) || q.includes(NFC(w)) : words.length && words.every(x => normWord(w).includes(x)))) || '';
  };
  const normWord = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const text = (lang, s) => getJSON(`data/text/${lang}/${s}.json`); // a whole surah
  // One flow's verses (first..last), taken from the whole surah instead when that is loaded already.
  const flowText = (lang, s, a, b) => (files.has(`data/text/${lang}/${s}.json`) ? text(lang, s).then(t => t.slice(a - 1, b)) : getJSON(`data/v/${lang}/${s}/${a}.json`));
  // The flow a verse is in, from the map: { s, a, b, no, slug, name } or null when it is not grouped.
  async function flowOf(s, v) {
    const m = await qmap(), f = m.f[s - 1];
    if (!f) return null;
    if (!m.no) { let n = 0; m.no = m.f.map(x => { const k = n; n += x.length / 3; return k; }); } // flows before each surah
    for (let i = 0; i < f.length; i += 3) {
      if (f[i] <= v && v <= f[i + 1]) { const t = m.t[f[i + 2]]; return { s, a: f[i], b: f[i + 1], no: m.no[s - 1] + i / 3 + 1, slug: t[0], name: t[1] }; }
    }
    return null;
  }
  async function verseText(lang, s, v) {
    const f = await flowOf(s, v);
    if (!f) return (await text(lang, s))[v - 1]; // not in a flow: the surah has it
    return (await flowText(lang, s, f.a, f.b))[v - f.a];
  }

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
    banner.hidden = true; syncBars();
    if (b.dataset.consent === 'accepted') loadGA();
  }));
  $$('[data-consent-reset]').forEach(b => b.addEventListener('click', () => {
    try { localStorage.removeItem('cookieConsent'); } catch (e) { /* ignore */ }
    setTimeout(syncBars); // once the notice is back on screen the bars move above it
    banner.hidden = false;
  }));

  /* ---------- display languages ---------- */
  let langs = (st => { const l = { ar: false, en: true, ta: true }; for (const k of Object.keys(l)) if (typeof st[k] === 'boolean') l[k] = st[k]; return l.ar || l.en || l.ta ? l : { ar: false, en: true, ta: true }; })(store.obj('qf-langs')); // English and Tamil unless the reader chose otherwise
  const syncLangBoxes = () => $$('[data-lang]').forEach(cb => { cb.checked = !!langs[cb.dataset.lang]; });
  syncLangBoxes();
  $$('[data-lang]').forEach(cb => cb.addEventListener('change', () => {
    langs = { ...langs, [cb.dataset.lang]: cb.checked };
    if (!langs.ar && !langs.en && !langs.ta) { langs.en = true; }
    store.set('qf-langs', langs); syncLangBoxes();
    $$('.fl.open').forEach(li => renderVerses(li));
    document.dispatchEvent(new Event('qf-langs')); // other verse views redraw themselves
  }));

  /* ---------- reading aloud ----------
     The browser's own voices (speechSynthesis): nothing to download or host. Only the English and Tamil
     translations are read; a synthetic voice mispronounces the Quran's Arabic, and the flow's quran.com link
     gives a real recitation. While a line is read it is marked, and the word being read is highlighted when the
     voice reports word positions (most built-in voices do; some online voices report none, and then the line
     alone is marked). Long verses are read in pieces split at punctuation, because some browsers stop a single
     long utterance after about 15 seconds. */
  const ICON_SPEAK = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_STOP = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>';
  const speakBtn = (ref, lang) => ('speechSynthesis' in window ? `<button type="button" class="v-speak" data-speak-one aria-label="Read ${ref} aloud in ${lang}" title="Read aloud">${ICON_SPEAK}</button>` : '');
  const LANG_TAG = { en: 'en', ta: 'ta' };
  const speech = {
    el: null, queue: [], gen: 0,
    voice(lang) {
      /* Never a novelty or robotic voice (macOS ships "Albert", "Bubbles", "Zarvox"... and the robotic Eloquence
         set). Then: the voice the reader chose for their own system, a built-in voice (these report word
         positions, which the highlight needs), and a known natural voice. */
      const vs = window.speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(LANG_TAG[lang]));
      const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Kathy|Ralph|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/i;
      const fine = vs.filter(v => !NOVELTY.test(v.name)), pool = fine.length ? fine : vs;
      const score = v => (v.default ? 8 : 0) + (v.localService ? 4 : 0) + (/Samantha|Daniel|Karen|Moira|Tessa|Rishi|Alex|Ava|Allison|Serena|Vani|Aria|Jenny|Guy|Zira|David|Google/i.test(v.name) ? 2 : 0) + (/natural|neural|enhanced|premium/i.test(v.name) ? 1 : 0);
      return pool.slice().sort((a, b) => score(b) - score(a))[0] || null;
    },
    pieces(text) { // [start, end) ranges of at most ~180 characters, cut after punctuation where possible
      const out = []; let i = 0;
      while (i < text.length) {
        let j = Math.min(text.length, i + 180);
        if (j < text.length) { const cut = Math.max(text.lastIndexOf('. ', j), text.lastIndexOf('; ', j), text.lastIndexOf(', ', j)); if (cut > i + 40) j = cut + 1; else { const sp = text.lastIndexOf(' ', j); if (sp > i) j = sp; } }
        out.push([i, j]); i = j; while (text[i] === ' ') i++;
      }
      return out;
    },
    mark(el) { // wrap each word in a span that knows where it starts in the verse text
      const vt = $('.vt', el), text = vt.textContent;
      let pos = 0;
      vt.innerHTML = text.split(/(\s+)/).map(part => { const st = pos; pos += part.length; return /\S/.test(part) ? `<span class="w" data-i="${st}">${esc(part)}</span>` : part; }).join('');
      return text;
    },
    unmark(el) { const vt = $('.vt', el); if (vt) { vt.textContent = vt.textContent; delete vt.dataset.gl; } el.classList.remove('speaking'); markHard(el.parentNode); const b = $('.v-speak', el); if (b) { b.innerHTML = ICON_SPEAK; b.setAttribute('aria-pressed', 'false'); } },
    stop() {
      speech.gen++; speech.queue = []; speech.paused = null;
      try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
      if (speech.el) speech.unmark(speech.el);
      speech.el = null;
      $$('[data-read-label][aria-pressed="true"]').forEach(b => { b.setAttribute('aria-pressed', 'false'); b.innerHTML = `${ICON_SPEAK} ${b.dataset.readLabel}`; });
      speech.bar();
    },
    /* Pause keeps the rest of the reading and resumes from the verse it was on (browsers pause unreliably, some
       not at all on phones, so pausing stops and remembers instead). The bar at the bottom shows it all. */
    paused: null, btn: null, strikes: {},
    // A line that has left the page, or sits in a part that is hidden now, is not read: nobody could see what is read.
    live: el => el.isConnected && el.getClientRects().length > 0,
    drop(root) { // whatever is being read, or waiting its turn, inside root ends here
      if (!root) return;
      if (speech.el && root.contains(speech.el)) { speech.stop(); return; }
      speech.queue = speech.queue.filter(el => !root.contains(el));
      const p = speech.paused; if (!p) return;
      if (!p.rest.length || root.contains(p.rest[0])) { speech.paused = null; speech.bar(); } else p.rest = p.rest.filter(el => !root.contains(el));
    },
    ref: el => ((el && $('sup', el)) || {}).textContent || '',
    pause() {
      if (!speech.el) return;
      const rest = [speech.el, ...speech.queue], btn = speech.btn, ref = speech.ref(speech.el);
      speech.stop(); speech.paused = { rest, btn, ref }; speech.bar();
    },
    resume() {
      const p = speech.paused; if (!p) return;
      const rest = p.rest.filter(el => speech.live(el));
      if (!rest.length) { speech.paused = null; speech.bar(); return; }
      speech.say(rest, p.btn && document.contains(p.btn) ? p.btn : null);
    },
    bar() {
      const b = document.getElementById('sp-bar'); if (!b) return;
      b.hidden = !speech.el && !speech.paused; syncBars(); if (b.hidden) return;
      $('#sp-now').textContent = speech.paused ? `Paused at ${speech.paused.ref}` : `Reading ${speech.ref(speech.el)}`;
      $('#sp-pause').textContent = speech.paused ? 'Resume' : 'Pause';
    },
    say(lines, allBtn) { // read lines (verse elements) one after another
      speech.stop();
      const my = speech.gen;
      speech.btn = allBtn || null;
      speech.queue = lines.slice();
      if (allBtn) { allBtn.setAttribute('aria-pressed', 'true'); allBtn.innerHTML = `${ICON_STOP} Stop reading`; }
      const next = () => {
        if (my !== speech.gen) return;
        if (speech.el) speech.unmark(speech.el);
        let el = speech.queue.shift(); while (el && !speech.live(el)) el = speech.queue.shift();
        if (!el) { speech.el = null; speech.bar(); if (allBtn) { allBtn.setAttribute('aria-pressed', 'false'); allBtn.innerHTML = `${ICON_SPEAK} ${allBtn.dataset.readLabel}`; } return; }
        const lang = el.dataset.speak, voice = speech.voice(lang);
        if (!voice) { speech.notice(el, lang, 'none'); next(); return; }
        if (speech.silent.has(lang)) { speech.notice(el, lang, 'silent'); next(); return; }
        speech.el = el; el.classList.add('speaking'); speech.bar();
        const b = $('.v-speak', el); if (b) { b.innerHTML = ICON_STOP; b.setAttribute('aria-pressed', 'true'); }
        const text = speech.mark(el), words = $$('.w', el);
        el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        const parts = speech.pieces(text);
        const sayPart = k => {
          if (my !== speech.gen) return;
          if (k >= parts.length) { next(); return; }
          const [st, en] = parts[k], u = new SpeechSynthesisUtterance(text.slice(st, en));
          u.voice = voice; u.lang = voice.lang; u.rate = 0.95;
          u.onboundary = e => {
            if (my !== speech.gen || (e.name && e.name !== 'word')) return;
            const at = st + e.charIndex; let hit = null;
            for (const w of words) { if (+w.dataset.i <= at) hit = w; else break; }
            words.forEach(w => w.classList.toggle('w-now', w === hit));
          };
          /* A voice can be listed and still make no sound: Chrome on macOS lists the Tamil voice "Vani" but races
             through the words in silence, or never starts. Real speech needs well over 12 ms per character
             (measured: about 60), so a piece that ends faster, or ends without starting, was not heard. */
          let t0 = 0;
          u.onstart = () => { t0 = performance.now(); };
          u.onend = () => {
            if (my !== speech.gen) return;
            // One quick piece can be a hiccup (phones drop one now and then): try it again, and only call the voice
            // silent when it happens twice running.
            if (!t0 || (en - st > 40 && performance.now() - t0 < (en - st) * 12)) {
              speech.strikes[lang] = (speech.strikes[lang] || 0) + 1;
              if (speech.strikes[lang] < 2) { sayPart(k); return; }
              speech.silent.add(lang); speech.notice(el, lang, 'silent'); next(); return;
            }
            speech.strikes[lang] = 0;
            sayPart(k + 1);
          };
          u.onerror = ev => {
            if (my !== speech.gen || ev.error === 'interrupted' || ev.error === 'canceled') return;
            speech.notice(el, lang, ev.error === 'not-allowed' ? 'blocked' : 'error', ev.error);
            if (ev.error === 'not-allowed') speech.stop(); else next();
          };
          window.speechSynthesis.speak(u);
        };
        sayPart(0);
      };
      next();
    },
    silent: new Set(), // languages whose voice was found to make no sound in this browser, for this visit
    notice(el, lang, why, detail) { // once per open flow and language, under the first line that could not be read
      const box = el.closest('.fl-verses') || el, name = lang === 'ta' ? 'Tamil' : 'English';
      if ($(`.v-nospeak[data-lang="${lang}"]`, box)) return;
      const msg = {
        none: `This browser has no ${name} voice to read this aloud. Voices can be added in your device's language or speech settings.`,
        silent: `This browser's ${name} voice made no sound, so ${name} cannot be read aloud here. Another browser may read it.`,
        blocked: 'The browser did not allow reading aloud just now. Press the speaker again.',
        error: `Reading aloud stopped: the browser reported "${esc(detail || 'an error')}".`,
      }[why];
      el.insertAdjacentHTML('beforeend', `<p class="v-nospeak" data-lang="${lang}" data-why="${why}">${msg}</p>`);
    },
  };
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices(); // voices load in the background in some browsers
    window.addEventListener('pagehide', () => speech.stop());
    document.addEventListener('click', e => {
      const one = e.target.closest('[data-speak-one]'), all = e.target.closest('[data-read-all]');
      if (one) { const el = one.closest('[data-speak]'); if (speech.el === el) speech.stop(); else speech.say([el]); }
      else if (all) { if (all.getAttribute('aria-pressed') === 'true') speech.stop(); else speech.say($$('[data-speak]', all.closest('[data-read-scope], .fl-verses')), all); }
    });
  }

  /* ---------- picking verses to copy or share, and favourites (kept in this browser only) ---------- */
  const favs = new Set(store.arr('qf-favs').filter(r => typeof r === 'string' && /^\d+:\d+$/.test(r))), picked = new Set();
  const pickedIn = new Map(); // verse -> the popup it was picked in (null: on the page itself)
  const MAIL = 'qurantenets@gmail.com';
  function verseTools(s, v) { // opens a verse block: its reference, a box to pick it, and a star to keep it
    const r = `${s}:${v}`, f = favs.has(r);
    return `<div class="v" data-ref="${r}"><div class="v-tools"><label class="v-pick"><input type="checkbox" data-pick${picked.has(r) ? ' checked' : ''}> Select ${r}</label>` +
      `<button type="button" class="v-fav" data-fav aria-pressed="${f}" aria-label="${f ? 'Remove' : 'Save'} ${r} ${f ? 'from' : 'to'} favourites" title="Favourite">${f ? '★' : '☆'}</button></div>`;
  }
  // One verse in the chosen languages: t holds an array per language, i is this verse's place in those arrays.
  function verseHTML(s, v, t, i, tail = '') {
    let html = verseTools(s, v);
    if (t.ar) html += `<div class="v-ar" lang="ar">${esc(t.ar[i])}<span class="v-mark" aria-label="verse ${v}">${AR(v)}</span></div>`;
    if (t.en) html += `<div class="v-en" data-speak="en"><sup>${s}:${v}</sup><span class="vt">${esc(t.en[i])}</span>${speakBtn(`${s}:${v}`, 'English')}</div>`;
    if (t.ta) html += `<div class="v-ta" lang="ta" data-speak="ta"><sup>${s}:${v}</sup><span class="vt">${esc(t.ta[i])}</span>${speakBtn(`${s}:${v}`, 'Tamil')}</div>`;
    return html + tail + '</div>';
  }
  function correctionLink(s, a, b, nm) { // an email already holding the flow, its link and the questions to answer
    const r = rng(s, a, b);
    const body = `Flow: ${nm} (${r})\nPage: ${location.origin}${BASE}surah/${s}/#f-${s}-${a}\n\nWhat should change (name, description, or where it starts or ends):\n\nWhy (a tafsir or other source helps):\n`;
    return `<a href="mailto:${MAIL}?subject=${encodeURIComponent(`Correction: ${r} ${nm}`)}&body=${encodeURIComponent(body)}">Suggest a correction</a>`;
  }
  const refKey = r => { const [s, v] = r.split(':').map(Number); return s * 1000 + v; };
  const favCount = () => { const n = document.getElementById('fav-n'); if (n) n.textContent = favs.size ? ` ${favs.size}` : '';
    const fp = document.getElementById('fav-pop'), pm = document.getElementById('fav-meta'); // the open list's own count follows
    if (fp && fp.open && pm) pm.textContent = favs.size ? `${favs.size} verse${favs.size === 1 ? '' : 's'}` : '';
  };
  favCount();
  // The message, then each picked verse in the languages chosen, then links to the surahs. Built from the text files,
  // not the screen, so a verse whose flow has since been closed is still sent. Picking a verse loads its
  // surah's text (see primeText), so this finishes straight away and the browser still counts it as the tap.
  const wantLangs = () => ['ar', 'en', 'ta'].filter(l => langs[l]);
  const primeText = r => { const [s, v] = r.split(':').map(Number); wantLangs().forEach(l => verseText(l, s, v).catch(() => {})); };
  async function shareText() {
    const out = [], surahs = new Set();
    for (const r of [...picked].sort((x, y) => refKey(x) - refKey(y))) {
      const [s, v] = r.split(':').map(Number), got = await Promise.all(wantLangs().map(l => verseText(l, s, v)));
      surahs.add(s);
      out.push(`Quran ${r}`, ...got.map(t => String(t || '').trim()).filter(Boolean), '');
    }
    return `${$('#sb-msg').value.trim()}\n\n${out.join('\n')}${[...surahs].map(s => `${location.origin}${BASE}surah/${s}/`).join('\n')}`;
  }
  // The bars sit at the bottom; while a popup is open they move into it, or the popup would cover them.
  function syncBars() {
    const host = document.querySelector('dialog[open]') || document.body, sb = document.getElementById('share-bar'), sp = document.getElementById('sp-bar');
    for (const b of [sb, sp]) if (b && b.parentNode !== host) host.appendChild(b);
    if (sp && sb) { sp.classList.toggle('lift', !sb.hidden); if (!sb.hidden) sp.style.setProperty('--sb-h', sb.offsetHeight + 'px'); }
    // On the page the bars float over its end, so the page keeps that much room under itself (--bars-h) and nothing
    // is left beneath them; the cookie notice, while it is up, lifts them above itself (--bar-lift). In a popup they
    // are part of its layout and need neither.
    const root = document.documentElement, onPage = host === document.body, note = document.getElementById('consent');
    root.style.setProperty('--bar-lift', onPage && note && !note.hidden ? `${note.offsetHeight + 8}px` : '0px');
    const tops = onPage ? [sb, sp].filter(b => b && !b.hidden).map(b => b.getBoundingClientRect().top) : [];
    root.style.setProperty('--bars-h', tops.length ? `${Math.max(0, Math.round(innerHeight - Math.min(...tops) + 8))}px` : '0px');
  }
  addEventListener('resize', syncBars);
  function drawShareBar() {
    const bar = document.getElementById('share-bar'); if (!bar) return;
    bar.hidden = !picked.size;
    $('#sb-n').textContent = `${picked.size} verse${picked.size === 1 ? '' : 's'} selected`;
    $('#sb-share').hidden = !navigator.share;
    syncBars();
  }
  function toast(msg, ms = 2200) {
    let t = document.getElementById('qf-toast');
    if (!t) { t = document.createElement('div'); t.id = 'qf-toast'; t.className = 'qf-toast'; t.setAttribute('role', 'status'); }
    (document.querySelector('dialog[open]') || document.body).appendChild(t);
    t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, ms);
  }
  document.addEventListener('change', e => {
    const cb = e.target.closest('[data-pick]'); if (!cb) return;
    const r = cb.closest('.v').dataset.ref;
    if (cb.checked) { picked.add(r); pickedIn.set(r, cb.closest('dialog')); primeText(r); } else { picked.delete(r); pickedIn.delete(r); }
    $$(`.v[data-ref="${r}"] [data-pick]`).forEach(x => { x.checked = cb.checked; });
    drawShareBar();
  });
  document.addEventListener('click', async e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      const r = fav.closest('[data-ref]').dataset.ref;
      if (favs.has(r)) favs.delete(r); else favs.add(r);
      store.set('qf-favs', [...favs]);
      const on = favs.has(r);
      $$(`[data-ref="${r}"] [data-fav]`).forEach(b => { b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', `${on ? 'Remove' : 'Save'} ${r} ${on ? 'from' : 'to'} favourites`); });
      favCount(); toast(on ? `${r} saved to favourites` : `${r} removed from favourites`); return;
    }
    if (e.target.closest('#sb-copy')) { try { await navigator.clipboard.writeText(await shareText()); toast(`Copied ${picked.size} verse${picked.size === 1 ? '' : 's'}`); } catch (err) { toast('Copying did not work in this browser'); } return; }
    if (e.target.closest('#sb-share')) { try { await navigator.share({ text: await shareText() }); } catch (err) { /* closed without sharing */ } return; }
    if (e.target.closest('#sb-clear')) { picked.clear(); pickedIn.clear(); $$('[data-pick]').forEach(x => { x.checked = false; }); drawShareBar(); return; }
    if (e.target.closest('#sp-pause')) { if (speech.paused) speech.resume(); else speech.pause(); return; }
    if (e.target.closest('#sp-stop')) { speech.stop(); return; }
    const gone = e.target.closest('[data-fav-drop]'); // a saved verse that does not exist
    if (gone) { favs.delete(gone.dataset.favDrop); store.set('qf-favs', [...favs]); favCount(); openFavs(); return; }
    if (e.target.closest('[data-reload]')) { location.reload(); return; }
    if (e.target.closest('[data-open-favs]')) { openFavs(); return; }
    if (e.target.closest('[data-close-favs]')) { document.getElementById('fav-pop').close(); }
  });
  // A selection made inside a popup ends with the popup: nothing picked there is left waiting, unseen, on the page
  // behind it (where it could ride along in a later Copy). Verses picked on the page itself stay picked.
  $$('dialog').forEach(d => d.addEventListener('close', () => {
    speech.drop(d);
    let n = 0;
    for (const [r, host] of [...pickedIn]) {
      if (host !== d) continue;
      picked.delete(r); pickedIn.delete(r); n++;
      $$(`.v[data-ref="${r}"] [data-pick]`).forEach(x => { x.checked = false; });
    }
    if (n) drawShareBar();
    const sd = document.getElementById('search'); // the page scrolls again once nothing is open over it
    if (!document.querySelector('dialog[open]') && (!sd || sd.hidden)) document.documentElement.classList.remove('modal-open');
    setTimeout(syncBars);
  }));
  // A click on the dimmed area around a popup closes it; a click on a gap inside the popup does not.
  const outside = (d, e) => { if (e.target !== d) return false; const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
  { const fp = document.getElementById('fav-pop'); if (fp) fp.addEventListener('click', e => { if (outside(fp, e)) fp.close(); }); }
  let favGen = 0;
  // A saved verse that cannot be shown gets a line of its own, so it never hides the others.
  const favBad = (r, why) => `<p class="v-err fav-bad">${why === 'none'
    ? `${esc(r)}: there is no such verse. <button type="button" class="ghost" data-fav-drop="${esc(r)}">Remove</button>`
    : `${esc(r)} could not be loaded. Check your connection, then open Favourites again.`}</p>`;
  async function openFavs() { // favourite verses, in the languages chosen, loading only their surahs' text
    const dlg = document.getElementById('fav-pop'), body = $('#fav-body'); if (!dlg) return;
    const refs = [...favs].sort((x, y) => refKey(x) - refKey(y));
    $('#fav-meta').textContent = refs.length ? `${refs.length} verse${refs.length === 1 ? '' : 's'}` : '';
    body.innerHTML = refs.length ? LOADING('Loading your verses…') : '<p class="v-err">No favourites yet. Tap ☆ beside any verse to keep it here.</p>';
    if (!dlg.open) { dlg.showModal(); document.documentElement.classList.add('modal-open'); }
    syncBars();
    if (!refs.length) return;
    const want = ['ar', 'en', 'ta'].filter(l => langs[l]);
    try {
      // Each verse comes from its own flow's small file (the map says which), all at once.
      const my = ++favGen, m = await qmap();
      const rows = await Promise.all(refs.map(async r => {
        const [s, v] = r.split(':').map(Number), su = m.su[s - 1];
        if (!su || !(v >= 1 && v <= su[3])) return { r, bad: 'none' };
        let f, got;
        try { [f, ...got] = await Promise.all([flowOf(s, v), ...want.map(l => verseText(l, s, v))]); } catch (e) { return { r, bad: 'load' }; }
        return { s, v, f, t: Object.fromEntries(want.map((l, i) => [l, [got[i]]])) };
      }));
      if (my !== favGen) return; // the list was asked for again meanwhile
      body.innerHTML = `<div class="fav-list">${rows.map(({ r, bad, s, v, f, t }) => bad ? favBad(r, bad) : verseHTML(s, v, t, 0,
        `<p class="v-links">${f ? `<a href="${BASE}surah/${s}/#f-${s}-${f.a}">${esc(f.name)} · ${rng(s, f.a, f.b)}</a>` : ''}<a href="${BASE}surah/${s}/">Open surah ${s}</a></p>`)).join('')}</div>`;
      markHard(body);
    } catch (e) { body.innerHTML = `<p class="v-err">The verses could not be loaded (${esc(e.message)}).</p>`; }
  }


  /* ---------- reading progress (this browser only) ----------
     A flow counts as read when its verses are opened, or when its last verse comes into view in Read through.
     Kept as { surah: [first verse of each flow read] }; the Quiz page shows it surah by surah. */
  const seen = store.obj('qf-seen');
  const MILESTONES = [5, 25, 100, 250, 500, 1000, 1658];
  function markSeen(s, a) {
    const k = String(s); if (!Array.isArray(seen[k])) seen[k] = [];
    const arr = seen[k];
    if (arr.includes(a)) return;
    arr.push(a); store.set('qf-seen', seen);
    const n = Object.values(seen).reduce((x, l) => x + (Array.isArray(l) ? l.length : 0), 0);
    if (MILESTONES.includes(n)) toast(`${n.toLocaleString()} flows read. Your progress is on the Quiz page (kept in this browser only).`, 5000);
  }

  /* ---------- meanings of hard English words ----------
     Words from data/glossary.json get a dotted underline in the English text; tapping one (or Enter on it)
     shows its plain meaning in a small bubble. The list (a few KB) is fetched once, with the first English
     verses shown. Readers can turn it off (and on again) from the bubble or the footer. */
  let glossOn = store.get('qf-gloss', true), glossP = null;
  const gloss = () => glossP || (glossP = getJSON('data/glossary.json').catch(() => { glossP = null; return null; }));
  const WORD = /[A-Za-z](?:[A-Za-z'’-]*[A-Za-z])?['’]?/g;
  async function markHard(root) {
    if (!glossOn || !root) return;
    if (!$$('.v-en .vt:not([data-gl])', root).length) return;
    const g = await gloss(); if (!g || !glossOn) return;
    for (const vt of $$('.v-en .vt:not([data-gl])', root)) {
      if (vt.closest('.speaking')) continue; // being read aloud: marked again when it ends
      const txt = vt.textContent; let html = '', last = 0;
      for (const m of txt.matchAll(WORD)) {
        const k = m[0].toLowerCase().replace(/['’]s?$/, ''), ix = g.f[k];
        if (ix === undefined) continue;
        html += esc(txt.slice(last, m.index)) + `<span class="gl" role="button" tabindex="0" data-g="${ix}">${esc(m[0])}</span>`;
        last = m.index + m[0].length;
      }
      vt.dataset.gl = '1';
      if (last) vt.innerHTML = html + esc(txt.slice(last));
    }
  }
  const tip = document.createElement('div');
  tip.className = 'gl-tip'; tip.id = 'gl-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  let tipFor = null;
  const hideTip = () => { if (tipFor) tipFor.removeAttribute('aria-describedby'); tip.hidden = true; tipFor = null; };
  async function showTip(el) {
    const g = await gloss(); if (!g) return;
    const [head, meaning, loan] = g.w[+el.dataset.g], said = el.textContent.replace(/['’]s?$/, '');
    tip.innerHTML = `<b>${esc(said)}</b>${head !== said.toLowerCase() ? ` <small>from “${esc(head)}”</small>` : ''}${loan ? ' <small>· an Arabic word</small>' : ''}<span>${esc(meaning)}</span><button type="button" class="gl-off" data-gloss-toggle>Turn word meanings off</button>`;
    (el.closest('dialog[open]') || document.body).appendChild(tip);
    tip.hidden = false; tipFor = el; el.setAttribute('aria-describedby', 'gl-tip');
    placeTip();
  }
  // Under the word (above it near the bottom of the screen); it follows the word while the page or a popup
  // scrolls, and closes once the word has scrolled out of sight.
  function placeTip() {
    if (tip.hidden || !tipFor) return;
    const r = tipFor.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !document.contains(tipFor)) { hideTip(); return; }
    const w = tip.offsetWidth, h = tip.offsetHeight, below = r.bottom + 8 + h < innerHeight;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    tip.style.top = `${below ? r.bottom + 8 : Math.max(8, r.top - h - 8)}px`;
  }
  const syncGlossBtns = () => $$('[data-gloss-toggle]').forEach(b => { if (!b.closest('#gl-tip')) b.textContent = glossOn ? 'Turn word meanings off' : 'Turn word meanings on'; });
  function setGloss(on) {
    glossOn = on; store.set('qf-gloss', on); hideTip(); syncGlossBtns();
    if (on) markHard(document);
    else $$('.v-en .vt[data-gl]').forEach(vt => { vt.textContent = vt.textContent; delete vt.dataset.gl; });
  }
  syncGlossBtns();
  document.addEventListener('click', e => {
    if (e.target.closest('[data-gloss-toggle]')) { setGloss(!glossOn); return; }
    const w = e.target.closest('.gl');
    if (w) { if (tipFor === w && !tip.hidden) hideTip(); else showTip(w); return; }
    if (!tip.hidden && !e.target.closest('#gl-tip')) hideTip();
  });
  document.addEventListener('keydown', e => { // first, so Esc closes the meaning only, not the popup or the filters
    const w = e.target.closest && e.target.closest('.gl');
    if (w && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showTip(w); }
    else if (e.key === 'Escape' && !tip.hidden) { e.preventDefault(); e.stopImmediatePropagation(); hideTip(); }
  }, true);
  window.addEventListener('scroll', placeTip, { passive: true, capture: true });
  window.addEventListener('resize', placeTip, { passive: true });

  /* ---------- opening a flow ---------- */
  async function renderVerses(li) {
    const box = $('.fl-verses', li);
    const s = +li.dataset.s, a = +li.dataset.a, b = +li.dataset.b;
    const want = ['ar', 'en', 'ta'].filter(l => langs[l]);
    speech.drop(box); box.innerHTML = LOADING('Loading verses…');
    try {
      const got = await Promise.all(want.map(l => flowText(l, s, a, b))); // this flow's verses only
      const t = Object.fromEntries(want.map((l, i) => [l, got[i]]));
      let html = '';
      for (let v = a; v <= b; v++) html += verseHTML(s, v, t, v - a);
      const q = `https://quran.com/${s}/${a}` + (b !== a ? `-${b}` : '');
      const nm = $('.fl-open', li).textContent;
      const readAll = (t.en || t.ta) && 'speechSynthesis' in window ? `<button type="button" class="v-readall" data-read-all data-read-label="Read this flow aloud">${ICON_SPEAK} Read this flow aloud</button>` : '';
      html += `<div class="v-links">${readAll}<a href="${q}" rel="noopener">Listen and read on quran.com</a><a href="${BASE}surah/${s}/#f-${s}-${a}">Link to this flow</a>${li.dataset.slug ? `<a href="${BASE}topic/${li.dataset.slug}/">Every flow named ${esc(nm)}</a>` : ''}${correctionLink(s, a, b, nm)}</div>`;
      speech.drop(box);
      box.innerHTML = html;
      markHard(box);
      markSeen(s, a);
    } catch (e) {
      box.innerHTML = `<p class="v-err">The verses could not be loaded (${esc(e.message)}). Check your connection and open the flow again.</p>`;
    }
  }
  function toggle(li, open) {
    const btn = $('.fl-open', li), box = $('.fl-verses', li);
    const willOpen = open !== undefined ? open : box.hidden;
    if (!willOpen) speech.drop(box); // closing a flow stops reading it
    box.hidden = !willOpen; li.classList.toggle('open', willOpen); btn.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) { const p = renderVerses(li); track('open_flow', { surah: li.dataset.s, start: li.dataset.a }); return p; }
    return Promise.resolve();
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
    // Every flow of one surah at once: one file per language for the whole surah beats one per flow.
    const su = $('[data-surah]');
    if (anyClosed && su && document.body.dataset.kind === 'surah') wantLangs().forEach(l => text(l, +su.dataset.surah).catch(() => {}));
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

  /* ---------- a surah: Flows or Read through, and Go to verse ----------
     Read through shows every verse in order, each flow's verses under its name; the name stays pinned at the
     top while its verses scroll by. It loads the whole surah once per language (that is what is being read). */
  const surahSec = document.body.dataset.kind === 'surah' && $('.surah[data-surah]');
  if (surahSec) {
    const S = +surahSec.dataset.surah, readBox = $('#read', surahSec), gotoBox = $('[data-goto]', surahSec);
    let mode = /^#f-/.test(location.hash) ? 'flows' : location.hash === '#read' ? 'read' : (store.get('qf-sview', 'flows') === 'read' ? 'read' : 'flows'), readP = null, readObs = null;
    const flowRows = () => $$('.timeline .fl', surahSec).map(li => ({ a: +li.dataset.a, b: +li.dataset.b, name: $('.fl-open', li).textContent, slug: li.dataset.slug }));
    async function drawRead() {
      const want = wantLangs(), keep = $$('.v', readBox).find(el => el.getBoundingClientRect().top >= 70); // stay on the same verse after a redraw
      if (!keep) readBox.innerHTML = LOADING('Loading the surah…');
      speech.drop(readBox);
      try {
        const got = await Promise.all(want.map(l => text(l, S))), t = Object.fromEntries(want.map((l, i) => [l, got[i]]));
        const n = got[0].length, parts = []; let v = 1;
        for (const f of flowRows()) { if (f.a > v) parts.push({ a: v, b: f.a - 1 }); parts.push(f); v = f.b + 1; }
        if (v <= n) parts.push({ a: v, b: n });
        const next = $('.pn a[rel="next"]', surahSec);
        const readAll = (t.en || t.ta) && 'speechSynthesis' in window ? `<div class="rd-acts"><button type="button" class="v-readall" data-read-all data-read-label="Read the surah aloud">${ICON_SPEAK} Read the surah aloud</button></div>` : '';
        readBox.innerHTML = readAll + parts.map(f => `<section class="rd-flow" data-a="${f.a}"${f.name ? ' data-flow' : ''}><h3 class="rd-name">${f.name ? `<a href="${BASE}topic/${f.slug}/">${esc(f.name)}</a>` : 'Not grouped yet'}<span>${rng(S, f.a, f.b)}</span></h3>` +
          Array.from({ length: f.b - f.a + 1 }, (_, i) => verseHTML(S, f.a + i, t, f.a + i - 1)).join('') + '</section>').join('') +
          (next ? `<p class="rd-next"><a href="${next.getAttribute('href')}#read">Continue reading: ${esc(next.textContent.replace(/\s*→\s*$/, ''))} →</a></p>` : '<p class="rd-next">The end of the Quran.</p>');
        if (keep) { const el = $(`.v[data-ref="${keep.dataset.ref}"]`, readBox); if (el) el.scrollIntoView({ block: 'start' }); }
        markHard(readBox);
        if (readObs) readObs.disconnect();
        readObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { markSeen(S, +e.target.closest('.rd-flow').dataset.a); readObs.unobserve(e.target); } }));
        $$('.rd-flow[data-flow] > .v:last-child', readBox).forEach(v => readObs.observe(v));
      } catch (e) { readBox.innerHTML = `<p class="v-err">The surah could not be loaded (${esc(e.message)}). Check your connection and try again.</p>`; readP = null; }
    }
    const setMode = (m, keep = true) => { // keep: remember it as the reader's own choice
      mode = m; if (keep) store.set('qf-sview', m);
      surahSec.classList.toggle('reading', m === 'read'); readBox.hidden = m !== 'read';
      $$('[data-sview]', surahSec).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sview === m)));
      if (m === 'read' && !readP) readP = drawRead();
      $$(m === 'read' ? '.flow-table' : '#read', surahSec).forEach(x => speech.drop(x)); // the view now hidden stops being read
      return m === 'read' ? readP : Promise.resolve();
    };
    $$('[data-sview]', surahSec).forEach(b => b.addEventListener('click', () => setMode(b.dataset.sview)));
    document.addEventListener('qf-langs', () => { if (readP) readP = drawRead(); });
    setMode(mode, false); // a view a link asked for (#read, or a flow) is shown, not remembered
    // Go to verse: in Flows the flow holding it opens; either way the verse comes into view and is marked.
    async function goTo(v) {
      if (!(Number.isInteger(v) && v >= 1 && v <= +gotoBox.max)) { if (gotoBox.value !== '') toast(`This surah has ${gotoBox.max} verses: choose 1 to ${gotoBox.max}.`); return; }
      if (mode === 'read') await readP;
      else { const li = $$('.timeline .fl', surahSec).find(x => +x.dataset.a <= v && v <= +x.dataset.b); if (!li) return; if (!li.classList.contains('open')) await toggle(li, true); }
      const el = $(`${mode === 'read' ? '#read' : '.timeline'} .v[data-ref="${S}:${v}"]`, surahSec); if (!el) return;
      const far = Math.abs(el.getBoundingClientRect().top) > innerHeight * 2; // a long jump goes straight there
      el.scrollIntoView({ block: 'center', behavior: far || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    }
    // Enter always goes; leaving the box goes only to a number not gone to yet (otherwise clicking elsewhere after
    // Enter would jump back to the verse in the middle of that click).
    let lastGo = 0;
    gotoBox.addEventListener('change', () => { const v = +gotoBox.value; if (v !== lastGo) { lastGo = v; goTo(v); } });
    gotoBox.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lastGo = +gotoBox.value; goTo(lastGo); } });
    // A link to one of this surah's flows, or to Read through, followed while the page is already open, is answered
    // in the view on screen: Read through goes to the flow's first verse instead of leaving for the list.
    window.addEventListener('hashchange', () => {
      const f = location.hash.match(/^#f-(\d+)-(\d+)$/);
      if (f && +f[1] === S && mode === 'read') goTo(+f[2]);
      else if (location.hash === '#read' && mode !== 'read') setMode('read', false);
    });
  }

  /* ---------- search ---------- */
  // Surah names typed in Arabic: marks and the lengthening stroke are dropped and the forms of a letter count as one,
  // so the name is found with or without hamza, with either final letter, and with "surah" in front of it.
  const hasAr = t => /[\u0600-\u06FF]/.test(t);
  const arNorm = t => t.normalize('NFC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627').replace(/\s+/g, ' ').trim()
    .replace(/^\u0633\u0648\u0631[\u0629\u0647] /, '').replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064A');
  const dlg = $('#search'), q = $('#q'), results = $('#results');
  let sel = -1, items = [];
  let searchFrom = null; // where the reader was, to go back there when the search closes
  const openSearch = () => {
    if (dlg.hidden) searchFrom = document.activeElement;
    dlg.hidden = false; document.documentElement.classList.add('modal-open'); // the page behind does not scroll
    q.value = ''; results.innerHTML = ''; items = []; sel = -1; q.focus(); qmap().catch(() => {});
  };
  const closeSearch = () => {
    if (dlg.hidden) return;
    dlg.hidden = true;
    if (!document.querySelector('dialog[open]')) document.documentElement.classList.remove('modal-open');
    if (searchFrom && document.contains(searchFrom)) searchFrom.focus({ preventScroll: true });
    searchFrom = null;
  };
  $$('[data-open-search]').forEach(b => b.addEventListener('click', openSearch));
  $$('[data-close-search]').forEach(b => b.addEventListener('click', closeSearch));
  dlg.addEventListener('click', e => { if (e.target === dlg) closeSearch(); });
  dlg.addEventListener('keydown', e => { // Tab stays inside the search while it is open
    if (e.key !== 'Tab') return;
    const f = $$('input, button, a[href]', dlg).filter(x => !x.disabled && x.getClientRects().length);
    if (!f.length) return;
    const at = document.activeElement, edge = e.shiftKey ? f[0] : f[f.length - 1];
    if (at === edge || !dlg.contains(at)) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
  });
  const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const VSIZE = { en: 'about 270 KB', ta: 'about 540 KB' };
  function drawResults(out, busy, offer, verseOffer) {
    items = out.slice(0, 80);
    if (offer) items.push({ href: '#', act: 'deep', title: 'Search the flow descriptions too', meta: '', sub: `Passages whose description mentions “${offer}”` });
    if (verseOffer) items.push({ href: '#', act: `verse-${verseOffer.lang}`, title: `Search the ${verseOffer.lang === 'ta' ? 'Tamil' : 'English'} text of every verse`, meta: '', sub: `Verses with “${verseOffer.q}” · loads ${VSIZE[verseOffer.lang]} once` });
    sel = items.length ? 0 : -1;
    results.innerHTML = (items.length ? items.map((it, i) => it.head ? `<li class="r-head" role="presentation">${esc(it.title)}</li>` : `<li${it.act ? ' class="r-more"' : ''}><a href="${esc(it.href)}"${it.act ? ` data-act="${it.act}"` : ''} aria-selected="${i === sel}"><b>${esc(it.title)}</b><em>${esc(it.meta)}</em>${it.html ? `<small>${it.html}</small>` : it.sub ? `<small>${esc(it.sub)}</small>` : ''}</a></li>`).join('')
      : busy ? '' : '<li class="r-none"><b>No match</b><small>Try a topic like Patience or Moses, a surah name, or a verse like 2:255.</small></li>') +
      (busy ? `<li class="r-load">${LOADING(busy === true ? 'Searching the flow descriptions…' : busy)}</li>` : '');
    items = items.filter(it => !it.head); // keyboard moves over links only
  }
  results.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    e.preventDefault();
    const act = a.dataset.act;
    if (act === 'deep') runSearch(true); else runSearch(false, act.slice(6));
  });
  /* Surahs, topics and verse references come from the small map. Flow descriptions are in the larger index,
     fetched only when nothing else matches, when the reader asks for them, or when it is loaded anyway. */
  let searchGen = 0;
  async function runSearch(deepAsked = false, verseLang = '') {
    const raw = q.value.trim(), my = ++searchGen;
    if (!raw) { results.innerHTML = ''; items = []; return; }
    let m;
    try { m = await qmap(); } catch (e) { results.innerHTML = '<li class="r-none"><b>Search could not load</b><small>Check your connection, then type again.</small></li>'; items = []; sel = -1; return; }
    if (my !== searchGen) return;
    const out = [];
    const ref = raw.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
    if (ref) {
      const s = +ref[1], v = +ref[2], su = m.su[s - 1];
      if (su && v >= 1 && v <= su[3]) {
        const f = await flowOf(s, v);
        out.push(f ? { href: `${BASE}surah/${s}/#f-${s}-${f.a}`, title: f.name, meta: rng(s, f.a, f.b), sub: `Verse ${s}:${v} is in this flow of ${su[0]}` }
                   : { href: `https://quran.com/${s}/${v}`, title: `${su[0]} ${s}:${v}`, meta: 'not grouped yet', sub: 'Read this verse on quran.com' });
      }
    }
    const ta = isTa(raw), n = ref ? '' : norm(raw), words = n ? n.split(' ') : [], ar = !ref && hasAr(raw) ? arNorm(raw) : '';
    const hit = str => { const h = norm(str); return words.length > 0 && words.every(w => h.includes(w)); };
    if (n || ta || ar) {
      if (n || ar) m.su.forEach((s, i) => { if ((n && hit(`${i + 1} ${s[0]} ${s[1]}`)) || (ar && arNorm(s[2]).includes(ar))) out.push({ href: `${BASE}surah/${i + 1}/`, title: `${i + 1}. ${s[0]}`, meta: `${s[3]} verses`, sub: s[1] }); });
      // Topics by name first, then by a related word: "wedding" finds Marriage, "riba" Interest, தொழுகை Prayer.
      const named = n ? m.t.filter(t => hit(t[1])) : [], rel = m.t.filter(t => !named.includes(t)).map(t => [t, relatedWord(t[4], raw, words)]).filter(x => x[1]);
      named.sort((a, b) => b[3] - a[3]).forEach(t => out.push({ href: `${BASE}topic/${t[0]}/`, title: t[1], meta: `topic · ${pl(t[3], 'verse')}`, sub: `${pl(t[2], 'flow')}` }));
      rel.sort((a, b) => b[0][3] - a[0][3]).forEach(([t, w]) => out.push({ href: `${BASE}topic/${t[0]}/`, title: t[1], meta: `topic · ${pl(t[3], 'verse')}`, sub: `${pl(t[2], 'flow')} · related to “${w}”` }));
    }
    const vOffer = !ref && (ta || n.length >= 3) && !verseLang ? { lang: ta ? 'ta' : 'en', q: raw } : null;
    if (verseLang) { await verseSearch(verseLang, raw, out, my); return; }
    const deep = !ta && n.length >= 3 && (deepAsked === true || !out.length || files.has('data/index.json'));
    drawResults(out, deep, !deep && n.length >= 3 ? raw : '', vOffer);
    if (!deep) return;
    let data; try { data = await index(); } catch (e) { if (my === searchGen) drawResults(out, false, '', vOffer); return; }
    if (my !== searchGen) return;
    data.flows.filter(f => !hit(f[4]) && f[6] && hit(f[6])).slice(0, 30).forEach(f => out.push({ href: `${BASE}surah/${f[1]}/#f-${f[1]}-${f[2]}`, title: f[4], meta: rng(f[1], f[2], f[3]), sub: f[6] }));
    drawResults(out, false, '', vOffer);
  }
  /* The words of the verses themselves, in English or Tamil: every verse in one file per language, fetched only
     when asked for. All the typed words must be in a verse; each result names its flow and shows the words marked. */
  async function verseSearch(lang, raw, out, my) {
    drawResults(out, `Loading the ${lang === 'ta' ? 'Tamil' : 'English'} verses (${VSIZE[lang]}, once)…`);
    let all, m;
    try { [all, m] = await Promise.all([getJSON(`data/search/${lang}.json`), qmap()]); } catch (e) { // say so, where the answer would have been: this is not "no verse has it"
      if (my === searchGen) {
        const row = '<li class="r-none"><b>The verse text could not be loaded</b><small>Check your connection, then try again.</small></li>';
        drawResults(out, false); if (out.length) results.insertAdjacentHTML('beforeend', row); else results.innerHTML = row;
      }
      return;
    }
    if (my !== searchGen) return;
    const prep = lang === 'ta' ? NFC : x => x.toLowerCase();
    const ws = prep(raw).split(/\s+/).filter(w => w.length > (lang === 'ta' ? 0 : 1));
    if (!ws.length) { drawResults(out, false); return; }
    const re = new RegExp(ws.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), lang === 'ta' ? 'g' : 'gi');
    const hits = []; let i = 0;
    m.su.forEach((su, si) => { for (let v = 1; v <= su[3]; v++, i++) { const h = prep(all[i]); if (ws.every(w => h.includes(w))) hits.push([si + 1, v, i]); } });
    const shown = hits.slice(0, 60), rows = [];
    for (const [s, v, k] of shown) {
      const f = await flowOf(s, v), txt = lang === 'ta' ? NFC(all[k]) : all[k];
      const first = txt.search(re), from = Math.max(0, first - 50), cut = txt.slice(from, from + 170);
      const html = (from ? '…' : '') + esc(cut).replace(new RegExp(re.source, re.flags), x => `<mark>${x}</mark>`) + (from + 170 < txt.length ? '…' : '');
      rows.push({ href: f ? `${BASE}surah/${s}/#f-${s}-${f.a}` : `${BASE}surah/${s}/`, title: `${s}:${v}${f ? ` · ${f.name}` : ''}`, meta: m.su[s - 1][0], html });
    }
    if (my !== searchGen) return;
    const head = { head: true, title: hits.length ? `${hits.length.toLocaleString()} verse${hits.length === 1 ? '' : 's'} with “${raw}” in ${lang === 'ta' ? 'Tamil' : 'English'}${hits.length > 60 ? ' · the first 60 (add a word to narrow)' : ''}` : `No verse has all of “${raw}” in ${lang === 'ta' ? 'Tamil' : 'English'}` };
    drawResults([...out, head, ...rows], false);
    track('search_verses', { lang, term: raw });
  }
  let tmr, stale = false; // stale: the list on screen does not answer what is in the box yet
  q.addEventListener('input', () => { stale = true; clearTimeout(tmr); tmr = setTimeout(() => { stale = false; runSearch(); }, 120); });
  q.addEventListener('keydown', async e => {
    const links = $$('a', results);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!links.length) return;
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((a, i) => a.setAttribute('aria-selected', String(i === sel))); links[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (stale) { clearTimeout(tmr); stale = false; await runSearch(); } // Enter pressed before the list caught up: search first
      const a = $$('a', results)[sel]; if (!a || !items.length) return;
      if (a.hasAttribute('data-act')) { a.click(); return; }
      track('search', { term: q.value }); location.href = a.href; closeSearch();
    }
  });

  /* ---------- global keys ---------- */
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing && dlg.hidden && !document.querySelector('dialog[open]')) { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape' && !dlg.hidden) { e.preventDefault(); closeSearch(); } // handled: Esc does nothing more on the page behind
  });

  /* ---------- visit count (footer) ----------
     Once a day this browser adds one to the total (counter/ in the repo: a number per day, nothing about the
     visitor); the total is remembered here, so other pages that day show it without asking again. */
  const visitsEl = document.getElementById('visits');
  // Only the published site counts (the counter refuses anything else), so local previews send nothing.
  const countHere = location.origin === 'https://qurantenets.github.io' || window.QF_COUNT_HERE === true; // the checks use a stand-in
  if (window.QF.counter && visitsEl && window.fetch && countHere) {
    const today = new Date().toISOString().slice(0, 10), counted = store.get('qf-counted', ''), known = store.get('qf-visits', null);
    const showVisits = d => {
      if (!d || !d.total) return;
      const since = d.since ? new Date(`${d.since}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
      visitsEl.textContent = `${Number(d.total).toLocaleString()} visit${d.total === 1 ? '' : 's'}${since ? ` since ${since}` : ''}`; visitsEl.hidden = false;
    };
    showVisits(known);
    if (counted !== today) {
      fetch(window.QF.counter + 'hit', { method: 'POST', mode: 'cors', credentials: 'omit' })
        .then(r => (r.ok ? r.json() : null)).then(d => { if (d) { store.set('qf-counted', today); store.set('qf-visits', d); showVisits(d); } }).catch(() => {});
    }
  }

  // What the Quiz page's own script (assets/quiz.js, loaded there only) uses from this one.
  window.QF.api = { getJSON, qmap, flowText, esc, store, rng, LOADING, markHard, wantLangs, toast, track, favs };

  /* ---------- home ---------- */
  if (document.body.dataset.kind === 'home') home();

  function home() {
    /* Topics is the home page (/); Flows (/flows/) and Surahs (/surahs/) are their own pages built from the same
       template, and the page says which view it is. Links from before the split (/#flows, /#surahs) move on. */
    const VIEWS = ['flows', 'topics', 'surahs'], VIEW = (($('.views') || {}).dataset || {}).view || 'topics';
    const old = location.hash.slice(1);
    if (VIEWS.includes(old) && old !== VIEW) { location.replace(BASE + (old === 'topics' ? '' : `${old}/`)); return; }
    const show = view => {
      VIEWS.forEach(v => { $('#' + v).hidden = v !== view; });
      if (view === 'topics') drawTopics();
    };

    /* Which flow is a verse in? Pick a surah, type a verse: the flow, its place and the verse itself, from the
       small map and that flow's own file. */
    const lk = $('#lookup');
    if (lk) {
      const ls = $('#lk-s'), lv = $('#lk-v'), lo = $('#lk-out');
      let lkT = 0, lkGen = 0;
      const setMax = () => { const n = +ls.selectedOptions[0].dataset.n; lv.max = n; lv.placeholder = `1–${n}`; };
      async function find() {
        const s = +ls.value, v = +lv.value, n = +lv.max, my = ++lkGen;
        if (!lv.value) { lo.innerHTML = ''; return; }
        if (!(Number.isInteger(v) && v >= 1 && v <= n)) { lo.innerHTML = `<p class="v-err">${esc(ls.selectedOptions[0].textContent)} has ${n} verses: choose 1 to ${n}.</p>`; return; }
        lo.innerHTML = LOADING('Finding the flow…');
        try {
          const want = wantLangs(), [f, ...got] = await Promise.all([flowOf(s, v), ...want.map(l => verseText(l, s, v))]);
          if (my !== lkGen) return;
          const t = Object.fromEntries(want.map((l, i) => [l, [got[i]]]));
          lo.innerHTML = (f ? `<p class="lk-res">Verse <b>${s}:${v}</b> is in the flow <a href="${BASE}topic/${f.slug}/">${esc(f.name)}</a> · ${rng(s, f.a, f.b)} · flow ${f.no} of the Quran</p>`
                            : `<p class="lk-res">Verse <b>${s}:${v}</b> is not in a flow yet.</p>`) +
            verseHTML(s, v, t, 0) +
            `<p class="v-links">${f ? `<a href="${BASE}surah/${s}/#f-${s}-${f.a}">Open this flow in its surah</a>` : ''}<a href="${BASE}surah/${s}/#read">Read the surah through</a></p>`;
          markHard(lo);
        } catch (e) { if (my === lkGen) lo.innerHTML = `<p class="v-err">That could not be looked up (${esc(e.message)}). Check your connection.</p>`; }
      }
      setMax();
      ls.addEventListener('change', () => { setMax(); if (lv.value) find(); });
      lv.addEventListener('input', () => { clearTimeout(lkT); lkT = setTimeout(find, 350); });
      lk.addEventListener('submit', e => { e.preventDefault(); clearTimeout(lkT); find(); });
    }

    const list = $('#all-flows'), table = $('#flow-table'), fq = $('#f-q'), fs = $('#f-surah'), fchips = $('#f-chips'), fac = $('#f-ac'), fd = $('#f-desc'), fc = $('#f-count'), fg = $('#f-group'), total = $('#f-total');
    fd.checked = store.get('qf-desc', false); fc.checked = store.get('qf-count', true);
    // Group by: none, topic or surah. An older "Group by topic" tick carries over as Topic.
    fg.value = store.get('qf-groupby', store.get('qf-group', false) === true ? 'topic' : '');
    if (!['', 'topic', 'surah', 'cat'].includes(fg.value)) fg.value = '';
    const fclear = $('#f-clear');
    const applyView = () => { table.classList.toggle('hide-desc', !fd.checked); table.classList.toggle('hide-count', !fc.checked); };
    applyView();
    let meta = null, all = null, rows = [], shown = 0, kb = -1, gen = 0, sort = { key: 'no', dir: 1 };
    const chunks = new Map();
    const chunk = k => { if (!chunks.has(k)) chunks.set(k, fetch(`${BASE}data/flows/c${k}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(e => { chunks.delete(k); throw e; })); return chunks.get(k); }; // a part that failed is asked for again
    const metaP = fetch(BASE + 'data/flows/meta.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    // Search, topic filters and sorting read the one compact index (one request, cached), never every list chunk.
    const loadAll = async () => { if (!all) all = (await index()).flows; return all; };
    const surahName = s => meta.surahs[s - 1][1];
    const PAGE = 30, DWELL_MS = 2000, AHEAD_PX = 300;
    const moreEl = $('#flows-more');

    // A topic heading, used when "Group by topic" is on: the topic's name (a link to its page) and its totals.
    const groupHTML = g => (g.surah
      ? `<li class="fl-group" data-surah="${g.surah}"><a href="${BASE}surah/${g.surah}/"><span class="fl-group-no">${g.surah}</span>${esc(g.name)}</a>`
      : g.cat !== undefined ? `<li class="fl-group" data-cat="${g.cat}"><span class="cat-name"><i class="cat-dot"></i>${esc(g.name)}</span>`
      : `<li class="fl-group" data-slug="${g.slug}"><a href="${BASE}topic/${g.slug}/"><i class="cat-dot" data-cat="${catOf(g.slug)}"></i>${esc(g.name)}</a>`) +
      `<span class="fl-group-n">${g.n} flow${g.n === 1 ? '' : 's'} · ${g.v} verse${g.v === 1 ? '' : 's'}</span></li>`;
    const itemHTML = x => (Array.isArray(x) ? rowHTML(x) : groupHTML(x));
    function rowHTML(f) {
      return `<li class="fl" id="f-${f[1]}-${f[2]}" data-s="${f[1]}" data-a="${f[2]}" data-b="${f[3]}" data-slug="${f[5]}" data-cat="${catOf(f[5])}"><span class="c-no">${f[0]}</span>` +
        `<div class="fl-main"><button class="fl-open" type="button" aria-expanded="false"><span class="fl-name">${esc(f[4])}</span></button>${f[6] ? `<p class="fl-desc">${esc(f[6])}</p>` : ''}</div>` +
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
    list.addEventListener('click', e => { // "Try again" on a list, or a next part, that did not arrive
      const b = e.target.closest('[data-retry-flows]'); if (!b) return;
      if (b.dataset.retryFlows === 'apply') apply(); else { b.closest('li').remove(); moreEl.hidden = false; more(gen); }
    });
    async function more(my) {
      if (busy || !source) return; busy = true; moreEl.dataset.loading = ''; let failed = false;
      try {
        const got = await source.next();
        if (my !== gen) return;
        dropSkeleton();
        if (got && got.length) { list.insertAdjacentHTML('beforeend', got.map(itemHTML).join('')); shown += got.length; }
        else if (!shown) list.innerHTML = '<li class="empty">No flows match. Clear the search or filters, or press Esc.</li>';
        moreEl.hidden = !source.left();
      } catch (e) { if (my === gen) { dropSkeleton(); failed = true; moreEl.hidden = true; $$('.load-err', list).forEach(x => x.remove()); // one message, and no trying again by itself
        list.insertAdjacentHTML('beforeend', `<li class="empty load-err">${shown ? 'The next flows' : 'The flows'} could not be loaded (${esc(e.message)}). <button type="button" class="ghost" data-retry-flows="more">Try again</button></li>`); } }
      finally { busy = false; if (my === gen) { delete moreEl.dataset.loading; if (!failed) nearEnd(); } }
    }
    const skeleton = n => Array.from({ length: n }, () => '<li class="sk" aria-hidden="true"><span class="skel w6"></span><span class="skel w40"></span><span class="skel w14"></span><span class="skel w20"></span><span class="skel w6"></span></li>').join('');

    const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim();
    async function apply() {
      const my = ++gen;
      const q = fq.value.trim(), s = +fs.value || 0, t = [...sel];
      store.set('qf-filter', { s: fs.value }); store.set('qf-topics', t);
      awayFromEnd(); moreEl.hidden = true;
      const gb = fg.value;
      table.classList.toggle('grouped', gb === 'topic'); // under a topic heading the rows don't repeat the topic's name
      table.classList.toggle('no-surah', gb === 'surah'); // nor the surah's under a surah heading
      fclear.hidden = !(q || s || t.length || cats.size || sort.key !== 'no' || sort.dir !== 1);
      speech.drop(list); list.innerHTML = skeleton(8); shown = 0; kb = -1;
      const ref = q.match(/^(\d{1,3})\s*[:.]\s*(\d{1,3})$/);
      if (!q && !t.length && !cats.size && sort.key === 'no' && sort.dir === 1 && !gb) {
        const sp = s ? meta.span[String(s)] : [0, meta.flows - 1];
        source = sp ? streamSource(sp[0], sp[1]) : arraySource([]);
        const n = s ? (sp ? sp[1] - sp[0] + 1 : 0) : meta.flows;
        total.textContent = s ? `${n} flow${n === 1 ? '' : 's'} in ${surahName(s)}` : `${meta.flows.toLocaleString()} flows · ${meta.verses.toLocaleString()} verses`;
      } else {
        let data;
        try { data = await loadAll(); } catch (e) { // the one file that search, filters and sorting read did not arrive
          if (my === gen) { source = null; list.innerHTML = `<li class="empty load-err">The flows could not be loaded (${esc(e.message)}). <button type="button" class="ghost" data-retry-flows="apply">Try again</button></li>`; }
          return;
        }
        if (my !== gen) return;
        let r = data.filter(f => (!s || f[1] === s) && (!t.length || sel.has(f[5])) && inCats(f[5]));
        if (ref) { const S = +ref[1], V = +ref[2]; r = r.filter(f => f[1] === S && f[2] <= V && f[3] >= V); }
        // A box holding nothing to compare (no letters or digits) matches nothing, instead of everything.
        else if (q) { const nq = norm(q), w = nq.split(' '); r = !nq ? [] : r.filter(f => { const h = norm(`${f[4]} ${f[6]} ${surahName(f[1])}`); return w.every(x => h.includes(x)); }); }
        const key = { no: f => f[0], name: f => f[4].toLowerCase(), count: f => f[3] - f[2] + 1, surah: f => f[1] * 10000 + f[2] }[sort.key];
        r = r.slice().sort((x, y) => { const a = key(x), b = key(y); return (a < b ? -1 : a > b ? 1 : x[0] - y[0]) * sort.dir; });
        const v = r.reduce((n, f) => n + f[3] - f[2] + 1, 0);
        if (gb) {
          /* Group by topic or by surah: every flow of a group together under one heading, groups in the order
             they first appear in the current list (reading order by default, A-Z when sorted by topic), flows
             inside a group keeping the current order. Only what the filters leave is grouped. */
          const groups = new Map(), byTopic = gb === 'topic', byCat = gb === 'cat';
          const catName = id => (meta.cats.find(c => c[0] === id) || [id, 'No category'])[1];
          for (const f of r) {
            const k = byTopic ? f[5] : byCat ? catOf(f[5]) : f[1];
            if (!groups.has(k)) groups.set(k, byTopic ? { slug: f[5], name: f[4], n: 0, v: 0, flows: [] } : byCat ? { cat: k, name: catName(k), n: 0, v: 0, flows: [] } : { surah: f[1], name: surahName(f[1]), n: 0, v: 0, flows: [] });
            const g = groups.get(k); g.n++; g.v += f[3] - f[2] + 1; g.flows.push(f);
          }
          source = arraySource([...groups.values()].flatMap(g => [g, ...g.flows]));
          const unit = byTopic ? ['topic', 'topics'] : byCat ? ['category', 'categories'] : ['surah', 'surahs'];
          total.textContent = `${groups.size} ${unit[groups.size === 1 ? 0 : 1]} · ${pl(r.length, 'flow')} · ${pl(v, 'verse')}`;
        } else {
          source = arraySource(r);
          total.textContent = `${pl(r.length, 'flow')} · ${pl(v, 'verse')}`;
        }
      }
      await more(my);
    }

    metaP.then(m => {
      meta = m;
      fs.innerHTML = '<option value="">All surahs</option>' + m.surahs.map(s => {
        // Distinct topics and flows, both named: a bare "(105)" read as topics when it counted flows.
        const sp = m.span[String(s[0])], n = sp ? sp[1] - sp[0] + 1 : 0, k = (m.stopics || {})[String(s[0])] || 0;
        return `<option value="${s[0]}"${n ? '' : ' disabled'}>${s[0]}. ${esc(s[1])} · ${k} topic${k === 1 ? '' : 's'} · ${n} flow${n === 1 ? '' : 's'}</option>`;
      }).join('');
      const st = store.obj('qf-filter');
      if (st.s && fs.querySelector(`option[value="${CSS.escape(String(st.s))}"]:not([disabled])`)) fs.value = st.s;
      m.topics.forEach(t => topicBy.set(t[0], t));
      cats = new Set(store.arr('qf-cats').filter(id => (m.cats || []).some(c => c[0] === id))); drawCatChips();
      store.arr('qf-topics').forEach(x => { if (topicBy.has(x)) sel.add(x); }); if (st.t && topicBy.has(st.t)) sel.add(st.t);
      drawChips();
      drawToday();
      show(VIEW);
      if (VIEW === 'flows') apply(); // the list is only fetched on the Flows page
    }).catch(e => {
      // Nothing on this page works without that one file: say so wherever the reader is looking, with a way to try again.
      const again = '<button type="button" class="ghost" data-reload>Reload the page</button>';
      list.innerHTML = `<li class="empty">The flows could not be loaded (${esc(e.message)}). ${again}</li>`; moreEl.hidden = true;
      if (meta) return;
      const tl = $('#topic-list'), bb = $('#bubbles'), msg = `The topics could not be loaded (${esc(e.message)}). ${again}`;
      if (tl) tl.innerHTML = /^[OU]L$/.test(tl.tagName) ? `<li class="empty">${msg}</li>` : `<p class="v-err">${msg}</p>`;
      if (bb) bb.innerHTML = `<p class="bub-note">${msg}</p>`;
    });

    /* Topic chips: pick several topics; the list shows flows under any of them. Typed text that is not
       picked stays a text search (names, descriptions, surah names) or a verse reference like 2:255. */
    const sel = new Set(), topicBy = new Map();
    /* Categories (data/categories.json): every topic and flow coloured by one, and a filter shared by Topics and
       Flows: pick one or more, none picked shows all. */
    let cats = new Set();
    const catOf = slug => { const t = topicBy.get(slug), c = t && meta.cats ? meta.cats[t[5]] : null; return c ? c[0] : ''; };
    const inCats = slug => !cats.size || cats.has(catOf(slug));
    function drawCatChips() {
      if (!meta || !meta.cats) return;
      const tot = new Map(); meta.topics.forEach(t => { const c = meta.cats[t[5]]; if (c) tot.set(c[0], (tot.get(c[0]) || 0) + t[3]); });
      const html = `<button type="button" class="cats-all" data-cat-f="" aria-pressed="${!cats.size}">All</button>` +
        meta.cats.map(([id, name]) => `<button type="button" data-cat="${id}" data-cat-f="${id}" aria-pressed="${cats.has(id)}" title="${(tot.get(id) || 0).toLocaleString()} verses"><i class="cat-dot"></i>${esc(name)}<small>${(tot.get(id) || 0).toLocaleString()}</small></button>`).join('');
      $$('.cats').forEach(b => { b.innerHTML = html; });
    }
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-cat-f]'); if (!b || !meta) return;
      const id = b.dataset.catF;
      if (!id) cats.clear(); else if (cats.has(id)) cats.delete(id); else cats.add(id);
      store.set('qf-cats', [...cats]); drawCatChips();
      if (!$('#topics').hidden) drawTopics(true);
      if (!$('#flows').hidden) apply();
    });
    let acSel = -1, acOpts = [];
    function drawChips() {
      fchips.innerHTML = [...sel].map(slug => { const t = topicBy.get(slug); return t ? `<span class="f-chip">${esc(t[1])}<small>${t[3]}</small><button type="button" data-unchip="${slug}" aria-label="Remove ${esc(t[1])}">×</button></span>` : ''; }).join('');
    }
    function drawAc() {
      const raw = fq.value, q = norm(raw), ws = q ? q.split(' ') : [], rel = new Map();
      acOpts = !meta || (!q && !isTa(raw)) ? [] : meta.topics.filter(t => {
        if (sel.has(t[0])) return false;
        if (q && norm(t[1]).includes(q)) return true;
        const w = relatedWord(t[6], raw, ws); if (w) rel.set(t[0], w);
        return !!w;
      }).sort((a, b) => (rel.has(a[0]) - rel.has(b[0])) || b[3] - a[3]).slice(0, 12);
      fac.innerHTML = acOpts.map((t, i) => `<li role="option" data-i="${i}" aria-selected="${i === acSel}">${esc(t[1])}<small>${rel.has(t[0]) ? `related to “${esc(rel.get(t[0]))}” · ` : ''}${pl(t[2], 'flow')} · ${pl(t[3], 'verse')}</small></li>`).join('');
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
    fg.addEventListener('change', () => { store.set('qf-groupby', fg.value); apply(); });
    // Clear all filters (also Esc): search, topic chips, surah and sort back to the start. Display choices stay.
    function clearFilters() {
      fq.value = ''; fs.value = ''; sel.clear(); drawChips(); fac.hidden = true; cats.clear(); store.set('qf-cats', []); drawCatChips();
      sort = { key: 'no', dir: 1 };
      $$('[data-sort]', table).forEach(x => x.setAttribute('aria-sort', x.dataset.sort === 'no' ? 'ascending' : 'none'));
      apply();
    }
    fclear.addEventListener('click', () => { clearFilters(); fq.focus(); });
    $$('[data-sort]', table).forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.sort;
      sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: 1 };
      $$('[data-sort]', table).forEach(x => x.setAttribute('aria-sort', x.dataset.sort === sort.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'));
      apply();
    }));

    document.addEventListener('keydown', e => {
      if (e.defaultPrevented || $('#flows').hidden || !dlg.hidden || document.querySelector('dialog[open]')) return;
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (e.key === 'Escape') { if (!fac.hidden) { fac.hidden = true; return; } if (typing) document.activeElement.blur(); clearFilters(); return; }
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

    /* ---------- topics: the list, by surah, and the topic popup ---------- */
    /* Sorts: most verses, fewest verses, A-Z, or reading order (where a topic first appears: in the Quran for the
       whole list, in that surah for the By surah view). */
    let tsort = store.get('qf-tsort', 'v'), tview = store.get('qf-tview', 'all');
    if (!['v', 'vasc', 'az', 'read'].includes(tsort)) tsort = 'v';
    const byName = (a, b) => a.name.localeCompare(b.name);
    const SORTS = { v: (a, b) => b.v - a.v || byName(a, b), vasc: (a, b) => a.v - b.v || byName(a, b), az: byName, read: (a, b) => a.first - b.first };
    const order = arr => arr.slice().sort(SORTS[tsort]);
    // meta.topics: [slug, name, flows, verses, number of the topic's first flow], so every sort works without more data
    const allTopics = () => order(meta.topics.filter(t => inCats(t[0])).map(t => ({ slug: t[0], name: t[1], n: t[2], v: t[3], first: t[4] || 0 })));
    let surahTopics = null; // surah -> [{slug, name, n, v, first}], from data/bysurah.json on first use
    async function loadSurahTopics() {
      if (surahTopics) return surahTopics;
      const bs = await getJSON('data/bysurah.json'); // per surah [topic index (A-Z, as meta.topics), flows, verses, first flow]
      surahTopics = new Map(bs.map((arr, i) => [i + 1, arr.map(([ti, n, v, first]) => ({ slug: meta.topics[ti][0], name: meta.topics[ti][1], n, v, first }))]));
      return surahTopics;
    }
    async function drawTopicList() {
      const ts = allTopics();
      $('#topic-list').innerHTML = ts.map(t => `<li data-cat="${catOf(t.slug)}"><a href="${BASE}topic/${t.slug}/" data-topic="${t.slug}"><i class="cat-dot"></i>${esc(t.name)}</a><span>${t.v}</span></li>`).join('');
      $('#tl-count').textContent = `${ts.length} topics`;
    }
    async function drawBySurah() {
      const box = $('#by-surah');
      if (!surahTopics) box.innerHTML = '<p class="v-err">Loading the surahs…</p>';
      let per; try { per = await loadSurahTopics(); } catch (e) { box.innerHTML = `<p class="v-err">The topics could not be loaded (${esc(e.message)}).</p>`; return; }
      /* Each surah with the topics in it, as chips: the count is that topic's verses in this surah, and the shade
         says how much of the surah it takes up, so the heavy themes of a surah stand out at a glance. */
      const jumps = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110].map(n => `<a href="#bs-${n}">${n}</a>`).join('');
      let html = `<nav class="bs-jump" aria-label="Jump to surah"><span>Jump to</span>${jumps}</nav><p class="bs-key"><i class="w1"></i><i class="w2"></i><i class="w3"></i><i class="w4"></i> darker = more of the surah</p>`;
      for (let s = 1; s <= 114; s++) {
        const ts = per.get(s) || [], tot = ts.reduce((n, t) => n + t.v, 0);
        const chips = order(ts.filter(t => inCats(t.slug))).map(t => { const sh = t.v / (tot || 1), w = sh >= 0.3 ? 4 : sh >= 0.15 ? 3 : sh >= 0.07 ? 2 : 1; return `<li><button type="button" class="tchip w${w}" data-topic="${t.slug}" data-surah="${s}"><i class="cat-dot" data-cat="${catOf(t.slug)}"></i>${esc(t.name)}<span>${t.v}</span></button></li>`; }).join('');
        html += `<section class="bs" id="bs-${s}"><div class="bs-head"><a class="bs-name" href="${BASE}surah/${s}/"><span class="bs-no">${s}</span>${esc(surahName(s))}</a><span class="bs-meta">${pl(ts.length, 'topic')} · ${pl(tot, 'verse')}</span></div><ul class="bs-chips">${chips}</ul></section>`;
      }
      box.innerHTML = html;
      $('#tl-count').textContent = '114 surahs';
      // Jump links scroll without touching the address: on this page "#..." picks the tab.
      $$('.bs-jump a', box).forEach(a => a.addEventListener('click', e => {
        e.preventDefault();
        $(a.getAttribute('href'), box).scrollIntoView({ block: 'start' }); // instant: an index jump can cross the whole page
      }));
    }
    function drawTopicsView() {
      $$('[data-tview]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tview === tview)));
      $('#tl-sort').value = tsort;
      $('#topic-list').hidden = tview !== 'all'; $('#by-surah').hidden = tview !== 'surah';
      if (tview === 'surah') drawBySurah(); else drawTopicList();
    }
    $$('[data-tview]').forEach(b => b.addEventListener('click', () => { tview = b.dataset.tview; store.set('qf-tview', tview); drawTopicsView(); }));
    $('#tl-sort').addEventListener('change', e => { tsort = e.target.value; store.set('qf-tsort', tsort); drawTopicsView(); });

    /* The popup: a topic's flows (or its flows in one surah) without leaving the page. Rows open their verses,
       read-aloud works inside, and the footer steps to the previous or next topic in the current order. The
       browser's Back button closes it, as people expect on a phone. */
    const pop = $('#topic-pop'), popList = $('#tp-list'), LOAD = Math.random().toString(36).slice(2);
    const popGroup = $('#tp-group'), popRead = $('#tp-read');
    popGroup.checked = store.get('qf-popgroup', false);
    if ('speechSynthesis' in window) { popRead.innerHTML = `${ICON_SPEAK} Read aloud`; popRead.hidden = false; }
    let popOpener = null, popCur = null;
    async function openTopic(slug, surah = 0, fromHistory = false) {
      const t = topicBy.get(slug); if (!t) return;
      // This topic's flows only (a few hundred bytes): [number, surah, first, last, description]
      let rows; try { rows = await getJSON(`data/topic/${slug}.json`); } catch (e) { location.href = `${BASE}topic/${slug}/`; return; }
      const all = rows.map(r => [r[0], r[1], r[2], r[3], t[1], slug, r[4]]), flows = surah ? all.filter(f => f[1] === surah) : all;
      const v = flows.reduce((n, f) => n + f[3] - f[2] + 1, 0);
      speech.drop(pop);
      popCur = { slug, surah }; syncCover();
      $('#tp-title').textContent = surah ? `${t[1]} in ${surahName(surah)}` : t[1];
      const tc = meta.cats && meta.cats[t[5]];
      $('.tp-eyebrow', pop).innerHTML = tc ? `Topic · <span class="cat-name" data-cat="${tc[0]}">${esc(tc[1])}</span>` : 'Topic';
      $('#tp-meta').textContent = `${pl(flows.length, 'flow')} · ${pl(v, 'verse')}` + (surah ? '' : ` · ${pl(new Set(all.map(f => f[1])).size, 'surah')}`);
      const allBtn = $('#tp-all');
      allBtn.hidden = !surah || all.length === flows.length;
      if (surah) { allBtn.textContent = `See all ${all.length} flows on ${t[1]} in the Quran`; allBtn.onclick = () => openTopic(slug, 0); }
      $('#tp-page').href = `${BASE}topic/${slug}/`;
      const tbl = $('.tp-table', pop), grouped = !surah && popGroup.checked;
      tbl.classList.toggle('hide-desc', false);
      tbl.classList.toggle('no-surah', grouped || !!surah); // one surah, or a surah heading, names it already
      popGroup.closest('label').hidden = !!surah;
      // Grouped by surah: a heading per surah (its flows and verses on this topic), flows under it in reading order.
      let items = flows;
      if (grouped) {
        const gs = new Map();
        for (const f of flows) { if (!gs.has(f[1])) gs.set(f[1], { surah: f[1], name: surahName(f[1]), n: 0, v: 0, flows: [] }); const g = gs.get(f[1]); g.n++; g.v += f[3] - f[2] + 1; g.flows.push(f); }
        items = [...gs.values()].flatMap(g => [g, ...g.flows]);
      }
      popList.innerHTML = items.map(x => (Array.isArray(x) ? rowHTML(x).replace(/ id="f-[^"]+"/, '') : groupHTML(x))).join(''); // the list below may hold the same rows
      const seq = surah ? order((await loadSurahTopics()).get(surah) || []) : allTopics(), i = seq.findIndex(x => x.slug === slug);
      $$('.tp-nav', pop).forEach(b => {
        const n = seq[i + +b.dataset.dir];
        b.hidden = !n; if (!n) return;
        b.textContent = +b.dataset.dir < 0 ? `‹ ${n.name}` : `${n.name} ›`;
        b.onclick = () => openTopic(n.slug, surah);
      });
      if (!pop.open) { popOpener = document.activeElement; pop.showModal(); syncBars(); document.documentElement.classList.add('modal-open'); if (fromHistory) history.replaceState({ qfTopic: slug, s: surah, k: LOAD }, ''); else history.pushState({ qfTopic: slug, s: surah, k: LOAD }, ''); }
      else history.replaceState({ qfTopic: slug, s: surah, k: LOAD }, '');
      $('.tp-body', pop).scrollTop = 0;
      if (flows.length <= 3) $$('.fl', popList).forEach(li => toggle(li, true)); // a few passages: show their verses straight away
      syncOpenAll();
    }
    // "Open all verses" / "Close all verses": every passage of the topic opened at once, inside the popup.
    const openAllBtn = $('#tp-openall');
    const syncOpenAll = () => { const rows = $$('.fl', popList); openAllBtn.textContent = rows.length && rows.every(li => li.classList.contains('open')) ? 'Close all verses' : 'Open all verses'; };
    openAllBtn.addEventListener('click', () => { const rows = $$('.fl', popList), open = !rows.every(li => li.classList.contains('open')); rows.forEach(li => { if (li.classList.contains('open') !== open) toggle(li, open); }); syncOpenAll(); });
    popList.addEventListener('click', () => setTimeout(syncOpenAll)); // a row opened or closed by hand
    popGroup.addEventListener('change', () => { store.set('qf-popgroup', popGroup.checked); if (popCur) openTopic(popCur.slug, popCur.surah); });
    // Read aloud: every passage in the popup, in order; their verses are opened first so there is something to read.
    if (popRead) popRead.addEventListener('click', async () => {
      if (popRead.getAttribute('aria-pressed') === 'true') { speech.stop(); return; }
      popRead.disabled = true;
      try {
        await Promise.all($$('.fl', popList).map(li => (!li.classList.contains('open') ? toggle(li, true) : !$('[data-speak]', li) ? renderVerses(li) : null)));
      } finally { popRead.disabled = false; }
      syncOpenAll();
      const lines = $$('[data-speak]', popList);
      if (lines.length) speech.say(lines, popRead);
    });
    function finishClose() {
      speech.drop(pop);
      if (pop.open) pop.close();
      document.documentElement.classList.remove('modal-open');
      if (popOpener && document.contains(popOpener)) popOpener.focus({ preventScroll: true });
    }
    const closeTopic = () => { if (history.state && history.state.k === LOAD) history.back(); else finishClose(); };
    window.addEventListener('popstate', () => {
      const st = history.state, ours = st && st.k === LOAD;
      if (pop.open && !ours) finishClose(); // Back
      else if (!pop.open && ours && topicBy.has(st.qfTopic)) openTopic(st.qfTopic, st.s || 0, true); // Forward, onto the popup's own step
    });
    pop.addEventListener('cancel', e => { e.preventDefault(); closeTopic(); });
    pop.addEventListener('click', e => { if (outside(pop, e)) closeTopic(); }); // the dimmed area around it
    $('.tp-close', pop).addEventListener('click', closeTopic);
    // On this page a topic opens in the popup: list, chips, bubbles, group headings, search results, verse links.
    document.addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !meta) return;
      const chip = e.target.closest('button[data-topic]'), a = e.target.closest('a[href]');
      let slug = null, surah = 0;
      if (chip) { slug = chip.dataset.topic; surah = +chip.dataset.surah || 0; }
      else if (a && !a.hasAttribute('data-nav')) { const m = a.getAttribute('href').match(/\/topic\/([^/]+)\/$/); if (m) slug = decodeURIComponent(m[1]); }
      if (!slug || !topicBy.has(slug)) return;
      // From the Flows tab with a surah chosen, the popup keeps to that surah (a button inside widens it).
      if (!surah && !pop.contains(e.target) && e.target.closest('#flows') && +fs.value) surah = +fs.value;
      e.preventDefault();
      closeSearch();
      openTopic(slug, surah);
    });

    /* Today's topic: one topic a day, picked at random from those this reader has not covered yet, so the topics can
       be worked through one a day instead of by browsing. The pick holds for the day (the reader's own date);
       "Another topic" swaps it. A topic is covered once it has been opened from this card, or when the reader ticks
       "Mark as covered" in any topic's popup (unticking puts it back in the draw). Kept in this browser only, and
       carried in the progress file with the rest (Quiz page). */
    const today = $('#today'), tpCover = $('#tp-cover');
    const dayKey = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
    const covered = () => { const l = store.get('qf-covered', []); return Array.isArray(l) ? [...new Set(l)].filter(s => topicBy.has(s)) : []; };
    const isCovered = slug => covered().includes(slug);
    function setCovered(slug, on) {
      const l = covered().filter(s => s !== slug); if (on) l.push(slug);
      store.set('qf-covered', l); drawToday(); syncCover();
    }
    function syncCover() { // the tick in the popup; a topic shown for one surah only is a part of it, so no tick there
      if (!tpCover) return;
      const on = !!popCur && isCovered(popCur.slug);
      tpCover.hidden = !popCur || !!popCur.surah;
      tpCover.setAttribute('aria-pressed', String(on)); tpCover.textContent = on ? '✓ Covered' : 'Mark as covered';
    }
    // Today's pick; other = the reader asked for a different one. null when there is nothing left to offer.
    function pickToday(other) {
      const d = store.get('qf-daily', null), cur = d && d.d === dayKey() && topicBy.has(d.s) ? d.s : null;
      if (cur && !other) return cur;
      const done = new Set(covered()), pool = meta.topics.map(t => t[0]).filter(s => !done.has(s) && s !== cur);
      if (!pool.length) return cur;
      const s = pool[Math.floor(Math.random() * pool.length)];
      store.set('qf-daily', { d: dayKey(), s });
      return s;
    }
    function drawToday(other) {
      if (!today || !meta || !meta.topics.length) return;
      const total = meta.topics.length, done = covered().length, slug = done < total ? pickToday(other) : null, t = slug && topicBy.get(slug);
      const tally = `${done} of ${total} topics covered`;
      if (!t) {
        today.innerHTML = `<div class="today-text"><p class="today-eyebrow">Today's topic</p><p class="today-name">All ${total} topics covered</p><p class="today-meta">You have been through every topic. Start again to be offered one a day afresh.</p></div>` +
          '<div class="today-acts"><button type="button" data-today="reset">Start again</button></div>';
        delete today.dataset.slug;
      } else {
        const on = isCovered(slug), last = !on && total - done === 1;
        today.innerHTML = `<div class="today-text"><p class="today-eyebrow">Today's topic${on ? ' <span class="today-done">✓ covered</span>' : ''}</p>` +
          `<p class="today-name" data-cat="${catOf(slug)}"><i class="cat-dot"></i>${esc(t[1])}</p>` +
          `<p class="today-meta">${t[2]} flow${t[2] === 1 ? '' : 's'} · ${t[3]} verse${t[3] === 1 ? '' : 's'}${done ? ` · ${tally}` : ''}</p></div>` +
          `<div class="today-acts"><button type="button" data-today="open"${on ? '' : ' class="main"'}>${on ? 'Read again' : 'Read it'}</button>` +
          (last ? '' : `<button type="button" data-today="other"${on ? ' class="main"' : ''}>Another topic</button>`) + '</div>';
        today.dataset.slug = slug;
      }
      today.hidden = false;
    }
    if (today) today.addEventListener('click', async e => {
      const b = e.target.closest('[data-today]'); if (!b) return;
      if (b.dataset.today === 'other') { drawToday(true); const go = $('[data-today="open"]', today); if (go) go.focus({ preventScroll: true }); return; }
      if (b.dataset.today === 'reset') {
        if (!confirm('Start again? This clears the list of topics you have covered, in this browser.')) return;
        store.set('qf-covered', []); drawToday(); syncCover(); return;
      }
      const slug = today.dataset.slug;
      await openTopic(slug);
      if (pop.open && popCur && popCur.slug === slug && !popCur.surah && !isCovered(slug)) setCovered(slug, true); // it did open: counted
    });
    if (tpCover) tpCover.addEventListener('click', () => { if (popCur) setCovered(popCur.slug, !isCovered(popCur.slug)); });
    // A page left open overnight, or progress changed in another tab: the card follows.
    document.addEventListener('visibilitychange', () => { if (!document.hidden && meta) { drawToday(); syncCover(); } });
    addEventListener('storage', e => { if (meta && (e.key === 'qf-covered' || e.key === 'qf-daily' || e.key === null)) { drawToday(); syncCover(); } });

    /* The tips on the field ("Drag to explore ...") show each time the page is opened and go away after 30 seconds, at
       the first drag, zoom or tap on the field, or with their own close button; the "?" button brings them back.
       Nothing is remembered between visits, and a redraw (theme, category) keeps whatever state they are in. */
    const TIPS_MS = 30000, tips = { on: true, t: 0 };
    function setTips(on) {
      clearTimeout(tips.t); tips.on = on; tips.t = on ? setTimeout(() => setTips(false), TIPS_MS) : 0;
      const h = document.getElementById('bub-hint'), q = $('#bubbles [data-tips="toggle"]');
      if (h) h.classList.toggle('off', !on);
      if (q) q.setAttribute('aria-expanded', String(on));
    }
    let drawn = false;
    function drawTopics(again) {
      if (!meta) { metaP.then(() => drawTopics(), () => {}); return; }
      const topics = meta.topics.filter(t => inCats(t[0])).map(t => ({ slug: t[0], name: t[1], n: t[2], v: t[3], cat: catOf(t[0]) })).sort((a, b) => b.v - a.v);
      if (!drawn || again) { drawTopicsView(); drawn = true; }
      const box = $('#bubbles');
      /* Apple Watch style field: one packed layout (biggest topics in the middle, sized by verse count),
         dragged, swiped or scrolled around. Bubbles shrink and bunch up toward the edge (a tanh lens), so the
         topics around the one in the centre stay in view. Tapping a topic that is small or far out glides it to
         the centre and zooms in; tapping a topic you can read opens it. */
      const draw = () => {
        if (!window.d3) { box.innerHTML = '<p class="bub-note">The picture of topics could not be loaded. Every topic is in the list below.</p>'; return; }
        if (box._qf) box._qf.abort(); // a redraw (theme change) replaces the old listeners, never adds to them
        const ac = box._qf = new AbortController(), on = (t, f, o) => box.addEventListener(t, f, { ...o, signal: ac.signal });
        const cs = getComputedStyle(document.documentElement), c = k => cs.getPropertyValue(k).trim();
        // a category's strong colour or its tint ('-t'); a topic without one keeps the old green and soft fill
        const cc = (cat, t) => (cat ? c(`--c-${cat}${t}`) : t ? c('--soft') : c('--accent'));
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
        box.innerHTML = `<p class="bub-hint${tips.on ? '' : ' off'}" id="bub-hint"><span>Drag to explore · pinch, Ctrl+scroll or + − to zoom · tap a small topic to bring it close, tap again to open</span><button type="button" data-tips="hide" aria-label="Hide these tips">×</button></p>` +
          `<div class="bub-zoom"><button type="button" data-z="in" aria-label="Zoom in">+</button><button type="button" data-z="out" aria-label="Zoom out">−</button><button type="button" data-tips="toggle" aria-label="How to move around" aria-controls="bub-hint" aria-expanded="${tips.on}">?</button></div>`;
        if (tips.on && !tips.t) setTips(true); // the 30 seconds start when the field is first drawn
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
          const big = l.r > max * 0.55, count = pl(l.data.v, 'verse');
          const { fs, lines, top, sh, body } = layout(l.data.name, count, l.r), y = e => (e * fs).toFixed(2);
          const g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'bub'); g.dataset.slug = l.data.slug;
          g.style.setProperty('--sh', `${y(sh)}px`); // re-centres the name when the count is hidden
          g.innerHTML = `<title>${esc(l.data.name)}: ${pl(l.data.v, 'verse')} in ${pl(l.data.n, 'flow')}</title>` +
            `<circle r="${l.r.toFixed(1)}" fill="${big ? cc(l.data.cat, '') : cc(l.data.cat, '-t')}" stroke="${cc(l.data.cat, '')}" stroke-width="${big ? 0 : 1.2}"></circle>` +
            `<text class="bn" text-anchor="middle" font-size="${fs.toFixed(2)}" fill="${big ? c('--cat-ink') : c('--fg')}">` +
            lines.map((t, i) => `<tspan x="0" y="${y(top + ASC + i * LH)}">${esc(t)}</tspan>`).join('') + '</text>' +
            `<text class="bc" text-anchor="middle" x="0" y="${y(top + body + CG + CS * ASC)}" font-size="${(fs * CS).toFixed(2)}" fill="${big ? c('--cat-ink') : c('--muted')}">${count}</text>`;
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
          if (nd.fs * nd.sc >= 12) { openTopic(nd.l.data.slug); return; }
          const fit = (Math.min(box.clientWidth, box.clientHeight) * 0.42) / (nd.l.r * base); // no bigger than the view
          animateTo(-nd.l.wx, -nd.l.wy, Math.min(fit, Math.max(zoom, 18 / (nd.fs * base))));
        };
        const hitAt = (x, y) => { const el = document.elementsFromPoint(x, y).map(e => e.closest && e.closest('.bub')).find(Boolean); return el && bySlug.get(el.dataset.slug); };

        let down = null, moved = 0, last = null;
        const pts = new Map(); let pinch = null;
        on('pointerdown', e => {
          if (e.button !== 0 || e.target.closest('.bub-zoom, .bub-hint')) return;
          setTips(false); stop(); try { box.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or lost pointer: dragging still works */ }
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
        on('click', e => {
          const tb = e.target.closest('[data-tips]');
          if (tb) { setTips(tb.dataset.tips === 'toggle' && !tips.on); return; }
          const b = e.target.closest('.bub-zoom button'); if (b) { setTips(false); animateTo(px, py, zoom * (b.dataset.z === 'in' ? 1.6 : 1 / 1.6)); }
        });
        on('wheel', e => {
          e.preventDefault(); stop(); setTips(false);
          if (e.ctrlKey) { const rc = box.getBoundingClientRect(); zoomAt(zoom * Math.exp(-e.deltaY / 300), e.clientX - rc.left - rc.width / 2, e.clientY - rc.top - rc.height / 2); }
          else { px -= e.deltaX / (zoom * base); py -= e.deltaY / (zoom * base); clamp(); }
          render();
        }, { passive: false });
        box.tabIndex = 0; box.setAttribute('role', 'group');
        box.setAttribute('aria-label', 'Topics as bubbles. Arrow keys move the picture, plus and minus zoom, Enter opens the topic in the middle. Every topic is also in the list below.');
        on('keydown', e => {
          const m = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
          if (!e.target.closest('[data-tips]') && (m || ['+', '=', '-', 'Enter'].includes(e.key))) setTips(false);
          if (m) { e.preventDefault(); stop(); px += m[0] / zoom; py += m[1] / zoom; clamp(); render(); }
          else if (e.key === '+' || e.key === '=') animateTo(px, py, zoom * 1.4);
          else if (e.key === '-') animateTo(px, py, zoom / 1.4);
          else if (e.key === 'Enter' && !e.target.closest('.bub-zoom, .bub-hint')) {
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
      if (window.d3 || document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    }
    // Redraw for the new colours only while the field is on screen (labels are measured, which needs it shown);
    // opening the Topics tab always draws afresh anyway.
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { const b = $('#bubbles'); if (window.__qfBubbles && b && b.offsetParent) window.__qfBubbles(); });
  }
})();
