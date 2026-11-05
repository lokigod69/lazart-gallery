/* LAZART review gallery: static, phone-first. Reactions persist in localStorage per catalogue;
   "Send feedback" posts to the Netlify form (works only on Netlify); "Download JSON" always works. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const state = { data: null, lane: 'all', scope: 'all', category: 'all', favsOnly: false, list: [], index: -1, votes: null, key: null };

  function loadVotes(catalogue) {
    state.key = 'lazart-votes:' + catalogue;
    try {
      let stored = localStorage.getItem(state.key);
      if (!stored && catalogue === 'lazart-moss') stored = localStorage.getItem('lazart-votes:lazart-run-001');
      state.votes = JSON.parse(stored || 'null');
    } catch (e) { state.votes = null; }
    if (!state.votes || !state.votes.reactions) state.votes = { name: '', reactions: {}, updated: null };
    state.votes.catalogue = catalogue;
    try { state.votes.name = state.votes.name || localStorage.getItem('lazart-name') || ''; } catch (e) {}
  }
  function saveVotes() {
    state.votes.updated = new Date().toISOString();
    try { localStorage.setItem(state.key, JSON.stringify(state.votes)); localStorage.setItem('lazart-name', state.votes.name || ''); } catch (e) {}
    $('#fav-count').textContent = Object.values(state.votes.reactions).filter((r) => r.love).length;
  }
  function reaction(id) { return state.votes.reactions[id] || (state.votes.reactions[id] = {}); }

  function allImages() {
    const out = [];
    for (const c of state.data.categories) for (const img of c.images) out.push(Object.assign({ categoryTitle: c.title }, img));
    return out;
  }
  function setupRuns() {
    const menu = $('#run');
    const runs = Array.from(new Set(allImages().map((img) => img.run))).sort().reverse();
    menu.add(new Option('All runs', 'all'));
    const families = new Set(runs.map((run) => /^run-\d+/.exec(run)?.[0]).filter(Boolean));
    for (const family of families) {
      if (runs.some((run) => run.startsWith(family + '-'))) menu.add(new Option(family + ' · whole wave', 'wave:' + family));
    }
    for (const run of runs) menu.add(new Option(run, 'run:' + run));
    const url = new URL(location.href);
    const requested = url.searchParams.get('wave') || url.searchParams.get('run');
    const scope = (url.searchParams.has('wave') ? 'wave:' : 'run:') + requested;
    if (Array.from(menu.options).some((option) => option.value === scope)) state.scope = scope;
    else if (runs.includes(requested)) state.scope = 'run:' + requested;
    menu.value = state.scope;
    menu.onchange = () => {
      state.scope = menu.value;
      const url = new URL(location.href);
      url.searchParams.delete('run'); url.searchParams.delete('wave');
      if (state.scope !== 'all') {
        const [key, value] = state.scope.split(':');
        url.searchParams.set(key, value);
      }
      history.replaceState(null, '', url);
      state.category = 'all'; renderCategories(); renderGrid();
    };
  }
  function inScope(img) {
    if (state.scope === 'all') return true;
    const [kind, id] = state.scope.split(':');
    return img.run === id || (kind === 'wave' && img.run.startsWith(id + '-'));
  }
  function filtered() {
    return allImages().filter((img) => {
      if (!inScope(img)) return false;
      if (state.category !== 'all' && img.category !== state.category) return false;
      if (state.lane !== 'all' && img.lane !== state.lane) return false;
      if (state.favsOnly && !(state.votes.reactions[img.id] || {}).love) return false;
      return true;
    }).sort((a, b) => a.rank - b.rank);
  }

  function renderCategories() {
    const nav = $('#categories');
    nav.innerHTML = '';
    const mk = (slug, title, lazart, count) => {
      const b = document.createElement('button');
      b.className = 'chip' + (lazart ? ' lazart' : '') + (state.category === slug ? ' on' : '');
      b.textContent = title + (count != null ? ' · ' + count : '');
      b.onclick = () => { state.category = slug; renderCategories(); renderGrid(); window.scrollTo({ top: 0 }); };
      nav.appendChild(b);
    };
    mk('all', 'All', false, allImages().filter(inScope).length);
    for (const c of state.data.categories) {
      const count = c.images.filter(inScope).length;
      if (count) mk(c.slug, c.title, c.lazart, count);
    }
  }

  function renderGrid() {
    const grid = $('#grid');
    grid.innerHTML = '';
    state.list = filtered();
    const frag = document.createDocumentFragment();
    state.list.forEach((img, i) => {
      const card = document.createElement('button');
      card.className = 'card' + (img.w > img.h ? ' wide' : '');
      card.setAttribute('aria-label', img.title || img.key);
      const pic = document.createElement('img');
      pic.loading = 'lazy'; pic.decoding = 'async'; pic.src = img.thumb; pic.alt = '';
      pic.onload = () => pic.classList.add('loaded');
      card.appendChild(pic);
      const tag = document.createElement('span');
      tag.className = 'tag ' + (img.lane || 'safe'); tag.textContent = img.lane === 'twist' ? 'twist' : 'safe';
      card.appendChild(tag);
      const r = state.votes.reactions[img.id] || {};
      if (r.love || r.more || r.no) {
        const marks = document.createElement('div'); marks.className = 'marks';
        if (r.love) marks.innerHTML += '<span style="color:#ff5c7a">♥</span>';
        if (r.more) marks.innerHTML += '<span style="color:#ffd166">★</span>';
        if (r.no) marks.innerHTML += '<span>✕</span>';
        card.appendChild(marks);
      }
      if (img.score) { const s = document.createElement('span'); s.className = 'score'; s.textContent = 'AI ' + img.score + '/5'; card.appendChild(s); }
      card.onclick = () => open(i);
      frag.appendChild(card);
    });
    grid.appendChild(frag);
    $('#empty').hidden = state.list.length > 0;
    $('#foot').textContent = state.list.length + ' images · ' + state.data.title + ' · built ' + state.data.built_at.slice(0, 16).replace('T', ' ');
  }

  function open(i) {
    state.index = i;
    const img = state.list[i];
    if (!img) return;
    const v = $('#viewer');
    v.hidden = false;
    document.body.style.overflow = 'hidden';
    const big = $('#big');
    big.src = img.full; big.alt = img.title || '';
    $('#v-title').textContent = img.title || img.key;
    $('#v-meta').textContent = [
      img.run, img.categoryTitle, img.lane, img.w + '×' + img.h,
      img.seed != null ? 'seed ' + img.seed : '', img.profile,
      img.score ? 'AI ' + img.score + '/5 · ' + img.status : '',
    ].filter(Boolean).join(' · ');
    $('#v-prompt').textContent = [
      img.prompt, 'Key: ' + img.key, 'Run: ' + img.run,
      img.loras?.length ? 'Adapters: ' + img.loras.join(', ') : '',
      img.parent ? 'Parent: ' + img.parent : '',
      img.note ? 'AI note: ' + img.note : '',
    ].filter(Boolean).join('\n\n');
    const r = state.votes.reactions[img.id] || {};
    $('#r-love').classList.toggle('on', !!r.love);
    $('#r-more').classList.toggle('on', !!r.more);
    $('#r-no').classList.toggle('on', !!r.no);
    $('#v-note').value = r.note || '';
    if (state.list[i + 1]) { const pre = new Image(); pre.src = state.list[i + 1].full; }
  }
  function close() { $('#viewer').hidden = true; document.body.style.overflow = ''; renderGrid(); }
  function step(d) { const n = state.index + d; if (n >= 0 && n < state.list.length) open(n); }
  function toggle(kind) {
    const img = state.list[state.index]; if (!img) return;
    const r = reaction(img.id);
    r[kind] = !r[kind];
    if (kind === 'no' && r.no) { r.love = false; r.more = false; }
    if ((kind === 'love' || kind === 'more') && r[kind]) r.no = false;
    saveVotes();
    open(state.index);
  }

  function payload() {
    return JSON.stringify({ version: 1, catalogue: state.votes.catalogue, name: state.votes.name, updated: state.votes.updated, reactions: state.votes.reactions, userAgent: navigator.userAgent.slice(0, 80) });
  }
  function download() {
    state.votes.name = $('#fb-name').value.trim(); saveVotes();
    const blob = new Blob([payload()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'lazart-feedback-' + (state.votes.name || 'anon') + '-' + Date.now() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function restore(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const accepted = [state.votes.catalogue];
      if (state.votes.catalogue === 'lazart-moss') accepted.push('lazart-run-001');
      if (backup.version !== 1 || !accepted.includes(backup.catalogue) || !backup.reactions || typeof backup.reactions !== 'object') throw new Error('Choose feedback from this MOSS gallery.');
      const ids = new Set(allImages().map((img) => img.id));
      let count = 0;
      for (const [id, vote] of Object.entries(backup.reactions)) {
        if (!ids.has(id) || !vote || typeof vote !== 'object' || state.votes.reactions[id]) continue;
        state.votes.reactions[id] = { love: vote.love === true, more: vote.more === true, no: vote.no === true, note: typeof vote.note === 'string' ? vote.note : '' };
        count++;
      }
      state.votes.name ||= typeof backup.name === 'string' ? backup.name.slice(0, 40) : '';
      $('#fb-name').value = state.votes.name;
      saveVotes(); renderGrid();
      $('#fb-status').textContent = 'Restored ' + count + ' reactions. Existing reactions are kept.';
    } catch (e) { $('#fb-status').textContent = 'Could not restore votes. ' + e.message; }
  }
  async function send() {
    const name = $('#fb-name').value.trim();
    if (!name) { $('#fb-status').textContent = 'Please enter a name first.'; return; }
    state.votes.name = name; saveVotes();
    const body = new URLSearchParams({ 'form-name': 'lazart-feedback', 'bot-field': '', name, catalogue: state.votes.catalogue, payload: payload() });
    $('#fb-status').textContent = 'Sending…';
    try {
      const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      $('#fb-status').textContent = 'Sent. Thank you, ' + name + '!';
    } catch (e) {
      $('#fb-status').textContent = 'Online sending is not available here (' + e.message + '). Use Download JSON and send the file instead.';
    }
  }

  function wire() {
    $('#close').onclick = close;
    $('#prev').onclick = () => step(-1);
    $('#next').onclick = () => step(1);
    $('#r-love').onclick = () => toggle('love');
    $('#r-more').onclick = () => toggle('more');
    $('#r-no').onclick = () => toggle('no');
    $('#v-note').onchange = () => { const img = state.list[state.index]; if (!img) return; reaction(img.id).note = $('#v-note').value.trim(); saveVotes(); };
    $('#btn-favs').onclick = () => { state.favsOnly = !state.favsOnly; $('#btn-favs').classList.toggle('on', state.favsOnly); renderGrid(); };
    $('#btn-feedback').onclick = () => { $('#fb-name').value = state.votes.name || ''; $('#fb-status').textContent = ''; $('#sheet').hidden = false; };
    $('#fb-cancel').onclick = () => { $('#sheet').hidden = true; };
    $('#fb-export').onclick = download;
    $('#fb-import').onclick = () => $('#fb-file').click();
    $('#fb-file').onchange = () => { restore($('#fb-file').files[0]); $('#fb-file').value = ''; };
    $('#fb-send').onclick = send;
    // Netlify injects form-name only when it has registered this form.
    $('#fb-send').hidden = !document.querySelector('form[name="lazart-feedback"] input[name="form-name"]');
    document.querySelectorAll('#lanes .chip').forEach((b) => { b.onclick = () => { state.lane = b.dataset.lane; document.querySelectorAll('#lanes .chip').forEach((x) => x.classList.toggle('on', x === b)); renderGrid(); }; });
    document.addEventListener('keydown', (e) => {
      if ($('#viewer').hidden) return;
      if (e.target.matches('textarea,input') && e.key !== 'Escape') return;
      if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') step(1); else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key.toLowerCase() === 'l') toggle('love'); else if (e.key.toLowerCase() === 'm') toggle('more'); else if (e.key.toLowerCase() === 'x') toggle('no');
    });
    let x0 = null;
    const big = $('#big');
    big.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    big.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); }, { passive: true });
  }

  fetch('data.json').then((r) => r.json()).then((data) => {
    state.data = data;
    loadVotes(data.catalogue);
    $('#subtitle').textContent = data.title + ' · ' + data.count + ' images · highest AI scores first';
    setupRuns(); wire(); renderCategories(); renderGrid(); saveVotes();
  }).catch((e) => { $('#subtitle').textContent = 'Could not load data.json (' + e.message + ')'; });
})();
