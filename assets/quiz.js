/* Quran Flow - the Quiz page: ten questions made from the flows, and your progress surah by surah.
   Every question comes from the site's own data: the map of flows (data/map.json) and, for a verse question, that
   flow's own verse file. Scores, reading progress and favourites stay in this browser; they can be downloaded
   and restored from a file to keep them safe or move them to another device. */
(() => {
  'use strict';
  const A = window.QF && window.QF.api;
  const setup = document.getElementById('qz-setup'), box = document.getElementById('qz'), pg = document.getElementById('pg');
  if (!A || !setup || !box || !pg) return;
  const { getJSON, qmap, flowText, esc, store, rng, LOADING, markHard, wantLangs, toast, track, favs } = A;
  const BASE = (window.QF && window.QF.base) || '/';
  const $ = (q, el = document) => el.querySelector(q), $$ = (q, el = document) => [...el.querySelectorAll(q)];
  const N = 10;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let M = null;
  const sName = s => M.su[s - 1][0];
  const flowsOf = s => { const f = M.f[s - 1] || [], out = []; for (let i = 0; i < f.length; i += 3) out.push({ s, a: f[i], b: f[i + 1], name: M.t[f[i + 2]][1] }); return out; };

  /* ---------- questions ---------- */
  // Three wrong answers: other flow names of the same surah first, then any topic; never the right one twice.
  function options(right, pool) {
    let wrong = shuffle([...new Set(pool.map(f => f.name))].filter(n => n !== right)).slice(0, 3);
    if (wrong.length < 3) wrong = wrong.concat(shuffle(M.t.map(t => t[1]).filter(n => n !== right && !wrong.includes(n))).slice(0, 3 - wrong.length));
    return shuffle([right, ...wrong]);
  }
  async function makeQ(s, kind) {
    const fl = flowsOf(s);
    if (!fl.length) return null;
    if (kind === 'next') { // which flow comes right after this one (pairs with the same name are left out)
      const pairs = fl.slice(0, -1).map((f, i) => [f, fl[i + 1]]).filter(([x, y]) => x.name !== y.name);
      if (!pairs.length) return null;
      const [x, y] = pick(pairs);
      return { kind, s, key: `n${s}:${x.a}`, prompt: `In ${sName(s)}, which flow comes right after “${x.name}” (${rng(s, x.a, x.b)})?`, opts: options(y.name, fl.filter(f => f.name !== x.name)), right: y.name, flow: y };
    }
    if (kind === 'where') { // which verses a flow covers (only names that occur once in the surah)
      const uniq = fl.filter(f => fl.filter(g => g.name === f.name).length === 1);
      if (fl.length < 4 || !uniq.length) return null;
      const f = pick(uniq), right = rng(s, f.a, f.b);
      return { kind, s, key: `w${s}:${f.a}`, prompt: `Where in ${sName(s)} is the flow “${f.name}”?`, opts: shuffle([right, ...shuffle(fl.filter(g => g !== f)).slice(0, 3).map(g => rng(s, g.a, g.b))]), right, flow: f };
    }
    // which flow a verse is in, with the verse shown in the reader's language (English unless only Tamil is on)
    const f = pick(fl), v = f.a + Math.floor(Math.random() * (f.b - f.a + 1)), ls = wantLangs().filter(l => l !== 'ar'), lang = ls[0] || 'en';
    const t = await flowText(lang, s, f.a, f.b);
    return { kind: 'verse', s, v, lang, key: `v${s}:${v}`, text: t[v - f.a], prompt: `Which flow is verse ${s}:${v} in?`, opts: options(f.name, fl), right: f.name, flow: f };
  }
  async function makeRound(surah) {
    const kinds = shuffle(['verse', 'verse', 'verse', 'verse', 'next', 'next', 'next', 'where', 'where', 'where']);
    const any = (min) => { const ok = M.f.map((f, i) => (f.length / 3 >= min ? i + 1 : 0)).filter(Boolean); return pick(ok); };
    const qs = [], keys = new Set();
    for (const kind of kinds) {
      for (let tries = 0; tries < 25; tries++) {
        const s = surah || any(kind === 'where' ? 4 : kind === 'next' ? 2 : 1);
        const q = await makeQ(s, tries > 15 ? 'verse' : kind);
        if (q && !keys.has(q.key)) { keys.add(q.key); qs.push(q); break; }
      }
    }
    return qs;
  }

  /* ---------- playing a round ---------- */
  let round = null;
  async function start(surah) {
    setup.hidden = true; box.hidden = false; box.innerHTML = LOADING('Making your questions…');
    try { M = M || await qmap(); round = { surah, qs: await makeRound(surah), i: 0, right: 0, answers: [] }; }
    catch (e) { box.innerHTML = `<p class="v-err">The questions could not be made (${esc(e.message)}). Check your connection and try again.</p>`; setup.hidden = false; return; }
    show();
  }
  function show() {
    const q = round.qs[round.i], dots = round.qs.map((_, k) => `<i class="${k < round.i ? (round.answers[k] ? 'ok' : 'no') : k === round.i ? 'cur' : ''}"></i>`).join('');
    box.innerHTML = `<div class="qz-top"><span>Question ${round.i + 1} of ${round.qs.length}</span><span class="qz-dots" aria-hidden="true">${dots}</span><span>Score ${round.right}</span></div>` +
      `<h2 class="qz-q">${esc(q.prompt)}</h2>` +
      (q.kind === 'verse' ? `<div class="qz-verse ${q.lang === 'ta' ? 'v-ta' : 'v-en'}"${q.lang === 'ta' ? ' lang="ta"' : ''}><span class="vt">${esc(q.text)}</span></div>` : '') +
      `<div class="qz-opts" role="group" aria-label="Answers">${q.opts.map((o, k) => `<button type="button" data-o="${esc(o)}"><kbd>${k + 1}</kbd>${esc(o)}</button>`).join('')}</div>` +
      '<div class="qz-after" hidden></div>';
    markHard(box);
    const first = $('.qz-opts button', box); if (first) first.focus({ preventScroll: true });
  }
  function answer(btn) {
    const q = round.qs[round.i], ok = btn.dataset.o === q.right;
    if ($('.qz-opts', box).dataset.done) return;
    $('.qz-opts', box).dataset.done = '1';
    round.answers[round.i] = ok; if (ok) round.right++;
    $$('.qz-opts button', box).forEach(b => { b.disabled = true; if (b.dataset.o === q.right) b.classList.add('right'); else if (b === btn) b.classList.add('wrong'); });
    const f = q.flow, after = $('.qz-after', box), last = round.i === round.qs.length - 1;
    after.innerHTML = `<p class="qz-fb ${ok ? 'ok' : 'no'}">${ok ? 'Right.' : `Not quite: it is “${esc(q.right)}”.`} <a href="${BASE}surah/${f.s}/#f-${f.s}-${f.a}">Read “${esc(f.name)}” · ${rng(f.s, f.a, f.b)}</a></p>` +
      `<button type="button" class="qz-next">${last ? 'See your score' : 'Next question'}</button>`;
    after.hidden = false; $('.qz-next', after).focus({ preventScroll: true });
    $('.qz-top span:last-child', box).textContent = `Score ${round.right}`;
  }
  function next() { round.i++; if (round.i < round.qs.length) show(); else finish(); }
  function finish() {
    const key = String(round.surah), all = store.get('qf-quiz', {}), r = all[key] || { best: 0, last: 0, rounds: 0, right: 0, asked: 0 };
    const isBest = round.right > r.best;
    Object.assign(r, { best: Math.max(r.best, round.right), last: round.right, rounds: r.rounds + 1, right: r.right + round.right, asked: r.asked + round.qs.length, n: round.qs.length, at: new Date().toISOString().slice(0, 10) });
    all[key] = r; store.set('qf-quiz', all);
    track('quiz_done', { surah: round.surah, score: round.right });
    const where = round.surah ? sName(round.surah) : 'the whole Quran', n = round.qs.length;
    const say = round.right === n ? 'Every one right. Well done.' : round.right >= n * 0.7 ? 'Very good.' : round.right >= n * 0.4 ? 'Good going; reading the flows again will help.' : 'A start: read the flows, then try again.';
    box.innerHTML = `<div class="qz-end"><p class="qz-score"><b>${round.right}</b> out of ${n}</p><p>${say}${isBest && r.rounds > 1 ? ' A new best for this quiz.' : ''}</p>` +
      `<p class="qz-meta">${esc(where)} · best ${r.best} of ${n} · ${r.rounds} round${r.rounds === 1 ? '' : 's'} played</p>` +
      `<div class="qz-acts"><button type="button" data-again>Try again</button><button type="button" class="ghost" data-other>Choose another surah</button>${round.surah ? `<a href="${BASE}surah/${round.surah}/#read">Read ${esc(where)} through</a>` : ''}</div></div>`;
    drawProgress();
    $('[data-again]', box).focus({ preventScroll: true });
  }
  setup.addEventListener('submit', e => { e.preventDefault(); start(+$('#qz-s').value); });
  box.addEventListener('click', e => {
    const o = e.target.closest('.qz-opts button'); if (o) { answer(o); return; }
    if (e.target.closest('.qz-next')) { next(); return; }
    if (e.target.closest('[data-again]')) { start(round.surah); return; }
    if (e.target.closest('[data-other]')) { box.hidden = true; setup.hidden = false; $('#qz-s').focus(); }
  });
  document.addEventListener('keydown', e => { // 1-4 answer, Enter goes on (when not typing)
    if (box.hidden || /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const k = +e.key; if (k >= 1 && k <= 4) { const b = $$('.qz-opts button', box)[k - 1]; if (b && !b.disabled) { e.preventDefault(); answer(b); } }
  });
  const pre = new URLSearchParams(location.search).get('surah');
  if (pre && $(`#qz-s option[value="${CSS.escape(pre)}"]`)) $('#qz-s').value = pre;

  /* ---------- your progress ---------- */
  const KEYS = ['qf-seen', 'qf-quiz', 'qf-favs'];
  async function drawProgress() {
    try { M = M || await qmap(); } catch (e) { pg.innerHTML = `<p class="v-err">Your progress could not be shown (${esc(e.message)}).</p>`; return; }
    const seen = store.get('qf-seen', {}), quiz = store.get('qf-quiz', {}), nf = store.get('qf-favs', []).length;
    const total = M.f.reduce((n, f) => n + f.length / 3, 0), read = Object.values(seen).reduce((n, l) => n + l.length, 0);
    const rounds = Object.values(quiz).reduce((n, r) => n + r.rounds, 0), right = Object.values(quiz).reduce((n, r) => n + r.right, 0), asked = Object.values(quiz).reduce((n, r) => n + r.asked, 0);
    const started = M.su.map((su, i) => i + 1).filter(s => (seen[s] && seen[s].length) || quiz[s]);
    const pct = x => Math.round(x * 100);
    const card = (big, small) => `<div class="pg-card"><b>${big}</b><span>${small}</span></div>`;
    let html = `<div class="pg-cards">${card(`${read.toLocaleString()}`, `of ${total.toLocaleString()} flows read (${pct(read / total)}%)`)}${card(started.length, `of 114 surahs started`)}${card(rounds, `quiz${rounds === 1 ? '' : 'zes'} played`)}${card(asked ? `${pct(right / asked)}%` : '–', 'answers right')}${card(nf, `favourite verse${nf === 1 ? '' : 's'}`)}</div>`;
    html += `<div class="pg-keep"><p><b>Kept in this browser only.</b> ${read || rounds || nf ? `You have ${[read && `${read} flow${read === 1 ? '' : 's'} read`, rounds && `${rounds} quiz${rounds === 1 ? '' : 'zes'} played`, nf && `${nf} favourite${nf === 1 ? '' : 's'}`].filter(Boolean).join(', ')}. ` : ''}Clearing your browsing data, a private window or another device starts again from nothing, and nothing is sent to us. Download a copy to keep it safe or to carry it to another device.</p>` +
      '<div class="pg-acts"><button type="button" data-export>Download my progress</button><label class="pg-import">Restore from a file<input type="file" accept="application/json,.json" data-import></label><button type="button" class="ghost" data-reset>Start again</button></div></div>';
    const rows = M.su.map((su, i) => {
      const s = i + 1, n = M.f[i].length / 3, r = (seen[s] || []).length, q = quiz[s];
      return { s, su, n, r, q };
    });
    const only = started.length > 0 && store.get('qf-pg-all', false) !== true;
    html += `<div class="pg-head"><h3>Surah by surah</h3>${started.length ? `<label class="tp-check"><input type="checkbox" data-pg-all${only ? '' : ' checked'}> Show all 114</label>` : ''}</div>`;
    html += '<ol class="pg-list">' + rows.filter(x => !only || x.r || x.q).map(({ s, su, n, r, q }) => `<li class="${r || q ? '' : 'pg-none'}"><a href="${BASE}surah/${s}/" class="pg-name"><span class="pg-no">${s}</span>${esc(su[0])}</a>` +
      `<span class="pg-bar" role="img" aria-label="${r} of ${n} flows read"><span style="width:${pct(r / (n || 1))}%"></span></span><span class="pg-n">${r}/${n} flows</span>` +
      `<span class="pg-q">${q ? `quiz best ${q.best}/${q.n || 10}` : n >= 3 ? `<a href="?surah=${s}#qz-setup" data-quiz="${s}">take the quiz</a>` : ''}</span></li>`).join('') + '</ol>';
    if (quiz['0']) html += `<p class="pg-all">Whole-Quran quiz: best ${quiz['0'].best} of ${quiz['0'].n || 10}, ${quiz['0'].rounds} round${quiz['0'].rounds === 1 ? '' : 's'}.</p>`;
    pg.innerHTML = html;
  }
  pg.addEventListener('click', e => {
    const qz = e.target.closest('[data-quiz]');
    if (qz) { e.preventDefault(); $('#qz-s').value = qz.dataset.quiz; box.hidden = true; setup.hidden = false; setup.scrollIntoView({ block: 'center' }); $('#qz-s').focus(); return; }
    if (e.target.closest('[data-export]')) {
      const data = { app: 'quran-flow', version: 1, saved: new Date().toISOString() };
      KEYS.forEach(k => { data[k] = store.get(k, null); });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      a.download = `quran-flow-progress-${data.saved.slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      return;
    }
    if (e.target.closest('[data-reset]')) {
      if (!confirm('Start again? This clears your reading progress and quiz scores in this browser (favourites stay). Download a copy first if you may want them back.')) return;
      store.set('qf-seen', {}); store.set('qf-quiz', {}); drawProgress(); toast('Progress and scores cleared');
    }
  });
  pg.addEventListener('change', async e => {
    if (e.target.matches('[data-pg-all]')) { store.set('qf-pg-all', e.target.checked); drawProgress(); return; }
    const inp = e.target.closest('[data-import]'); if (!inp || !inp.files[0]) return;
    try {
      const d = JSON.parse(await inp.files[0].text());
      if (!d || d.app !== 'quran-flow') throw new Error('this is not a Quran Flow progress file');
      // Merged with what is here, never replacing it: flows read and favourites are joined, quiz scores keep the best.
      const seen = store.get('qf-seen', {}); Object.entries(d['qf-seen'] || {}).forEach(([s, l]) => { if (Array.isArray(l)) seen[s] = [...new Set([...(seen[s] || []), ...l.filter(Number.isInteger)])]; });
      const quiz = store.get('qf-quiz', {}); Object.entries(d['qf-quiz'] || {}).forEach(([k, r]) => { const o = quiz[k] || { best: 0, last: 0, rounds: 0, right: 0, asked: 0 }; ['best', 'rounds', 'right', 'asked'].forEach(f => { o[f] = Math.max(o[f] || 0, +r[f] || 0); }); o.last = o.last || +r.last || 0; quiz[k] = o; });
      const fv = [...new Set([...store.get('qf-favs', []), ...(Array.isArray(d['qf-favs']) ? d['qf-favs'].filter(x => /^\d+:\d+$/.test(x)) : [])])];
      store.set('qf-seen', seen); store.set('qf-quiz', quiz); store.set('qf-favs', fv);
      fv.forEach(r => favs.add(r));
      toast('Progress restored and merged with this browser’s', 3500); drawProgress();
    } catch (err) { toast(`Could not restore: ${err.message}`, 4000); }
    inp.value = '';
  });
  drawProgress();
})();
