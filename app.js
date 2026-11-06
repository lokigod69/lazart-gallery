/* LAZART review gallery: static, phone-first. Reactions persist in localStorage per catalogue;
   "Send feedback" posts to the Netlify form (works only on Netlify); "Download JSON" always works. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const sharedHost = location.hostname === 'lazart-moss-gallery.netlify.app';
  const publications = 'https://lokigod69.github.io/lazart-gallery/';
  const sharedSite = 'https://lazart-moss-gallery.netlify.app/';
  const endpoint = '/.netlify/functions/print-requests';
  const state = { data: null, collection: 'all', lane: 'all', scope: 'all', view: 'all', category: 'all', favsOnly: false, list: [], index: -1, votes: null, key: null };
  let counts = new Map(), mine = new Set(), pending = new Set(), online = false, requestSequence = 0;
  let printMessage = '';

  async function syncRequests(ids) {
    const sequence = ++requestSequence;
    const options = { cache: 'no-store', credentials: 'same-origin' };
    if (ids) Object.assign(options, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image_ids: ids }) });
    const response = await fetch(endpoint, options);
    const data = await response.json();
    if (!response.ok || data.version !== 1) throw new Error(data.error || 'Requests unavailable.');
    if (sequence < requestSequence) return;
    counts = new Map(data.requests.map((r) => [r.image_id, r.likes]));
    mine = new Set(data.mine);
    online = true;
    updateHeartCount();
    if ($('#viewer').hidden) { renderCategories(); renderGrid(); }
    else renderPrintStatus(state.list[state.index]);
  }

  async function refreshRequests() {
    if (!sharedHost || pending.size) return;
    try { await syncRequests(); }
    catch {
      online = false;
      if (!$('#viewer').hidden) renderPrintStatus(state.list[state.index]);
      if (state.view === 'requested' && $('#viewer').hidden) renderGrid();
    }
  }

  function updateHeartCount() {
    const loved = new Set(Object.entries(state.votes.reactions).filter(([, r]) => r.love).map(([id]) => id));
    for (const id of mine) loved.add(id);
    $('#fav-count').textContent = loved.size;
  }

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
    updateHeartCount();
  }
  function reaction(id) { return state.votes.reactions[id] || (state.votes.reactions[id] = {}); }

  function allImages() {
    const out = [];
    for (const c of state.data.categories) for (const img of c.images) {
      const collection = img.collection || (img.run.endsWith('-robert') ? 'robert' : 'studio');
      const category = state.data.collections?.find((g) => g.slug === collection)?.categories.find((category) => category.slug === img.category);
      out.push(Object.assign({ categoryTitle: category?.title || c.title, collection }, img));
    }
    return out;
  }
  function categoryOptions() {
    if (state.collection !== 'all') return state.data.collections.find((c) => c.slug === state.collection)?.categories || [];
    const options = new Map(state.data.categories.map((c) => [c.slug, c]));
    for (const group of state.data.collections) for (const c of group.categories) if (!options.has(c.slug)) options.set(c.slug, c);
    return Array.from(options.values());
  }
  function renderCollections() {
    const nav = $('#collections'); nav.innerHTML = '';
    for (const group of [{ slug: 'all', title: 'All collections' }, ...state.data.collections]) {
      const b = document.createElement('button');
      b.className = 'chip' + (state.collection === group.slug ? ' on' : '');
      b.textContent = group.title; b.setAttribute('aria-pressed', state.collection === group.slug);
      b.onclick = () => {
        state.collection = group.slug; state.category = 'all'; state.scope = 'all'; $('#run').value = 'all';
        const url = new URL(location.href);
        for (const key of ['category', 'run', 'wave']) url.searchParams.delete(key);
        if (group.slug === 'all') url.searchParams.delete('collection'); else url.searchParams.set('collection', group.slug);
        history.replaceState(null, '', url);
        renderCollections(); renderCategories(); renderGrid();
      };
      nav.appendChild(b);
    }
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
      url.searchParams.delete('category');
      url.searchParams.set('view', state.view);
      if (state.scope !== 'all') {
        const [key, value] = state.scope.split(':');
        url.searchParams.set(key, value);
      }
      history.replaceState(null, '', url);
      state.category = 'all'; renderCategories(); renderGrid();
    };
  }
  function inScope(img) {
    if (state.collection !== 'all' && img.collection !== state.collection) return false;
    if (state.scope === 'all') return true;
    const [kind, id] = state.scope.split(':');
    return img.run === id || (kind === 'wave' && img.run.startsWith(id + '-'));
  }
  function inView(img) {
    return inScope(img) && (state.view !== 'ready' || (!!img.print_proof && !img.requires_typography))
      && (state.view !== 'selected' || img.status === 'selected')
      && (state.view !== 'requested' || (counts.get(img.id) || 0) > 0);
  }
  function reviewedByControls() {
    return allImages().filter((img) => {
      if (!inScope(img)) return false;
      if (state.category !== 'all' && img.category !== state.category) return false;
      if (state.lane !== 'all' && img.lane !== state.lane) return false;
      if (state.favsOnly && !(state.votes.reactions[img.id] || {}).love && !mine.has(img.id)) return false;
      return true;
    });
  }

  function renderCategories() {
    const nav = $('#categories');
    nav.innerHTML = '';
    const mk = (slug, title, lazart, count) => {
      const b = document.createElement('button');
      b.className = 'chip' + (lazart ? ' lazart' : '') + (state.category === slug ? ' on' : '');
      b.setAttribute('aria-pressed', state.category === slug);
      b.textContent = title + (count != null ? ' · ' + count : '');
      b.onclick = () => {
        state.category = slug;
        const url = new URL(location.href);
        if (slug === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', slug);
        history.replaceState(null, '', url);
        renderCategories(); renderGrid(); window.scrollTo({ top: 0 });
      };
      nav.appendChild(b);
    };
    const images = allImages();
    // Robert's brief tracks actual AI selections, including categories still awaiting their first selection.
    const counted = (img) => state.collection === 'robert' ? inScope(img) && img.status === 'selected' : inView(img);
    mk('all', state.collection === 'robert' ? 'All AI selections' : 'All', false, images.filter(counted).length);
    for (const c of categoryOptions()) {
      const count = images.filter((img) => img.category === c.slug && counted(img)).length;
      if (count || state.collection === 'robert') mk(c.slug, c.title, c.lazart, count);
    }
  }

  function renderGrid() {
    const grid = $('#grid');
    grid.innerHTML = '';
    const reviewed = reviewedByControls();
    state.list = reviewed.filter(inView).sort((a, b) => (state.view === 'requested' ? counts.get(b.id) - counts.get(a.id) : 0) || a.rank - b.rank);
    const subtitle = state.view === 'ready' ? state.list.length + ' ready for print'
      : state.view === 'requested' ? state.list.length + ' requested artworks'
      : reviewed.filter((img) => img.status === 'selected').length + ' AI-selected of ' + reviewed.length + ' reviewed on the wall';
    $('#subtitle').textContent = state.data.title + ' · ' + subtitle;
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
      if (img.print_proof || img.requires_typography || counts.has(img.id)) {
        const p = document.createElement('span'); p.className = 'print-state';
        p.textContent = [img.requires_typography ? 'Typography pending' : img.print_proof ? 'Ready for print' : '', counts.has(img.id) ? '♥ ' + counts.get(img.id) : ''].filter(Boolean).join(' · ');
        card.appendChild(p);
      }
      card.onclick = () => open(i);
      frag.appendChild(card);
    });
    grid.appendChild(frag);
    $('#empty').hidden = state.list.length > 0;
    $('#empty').textContent = state.view === 'requested' && !online && sharedHost ? 'Loading shared print requests. Refresh to retry if the service is unavailable.' : 'No images match these filters.';
    $('#foot').textContent = state.list.length + ' images · ' + state.data.title + ' · built ' + state.data.built_at.slice(0, 16).replace('T', ' ');
  }

  function open(i) {
    if (state.index !== i) printMessage = '';
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
    renderPrintStatus(img);
    $('#r-more').classList.toggle('on', !!r.more);
    $('#r-no').classList.toggle('on', !!r.no);
    $('#v-note').value = r.note || '';
    if (state.list[i + 1]) { const pre = new Image(); pre.src = state.list[i + 1].full; }
  }
  function close() { $('#viewer').hidden = true; document.body.style.overflow = ''; renderGrid(); }
  function step(d) { const n = state.index + d; if (n >= 0 && n < state.list.length) open(n); }
  function renderPrintStatus(img) {
    if (!img) return;
    const button = $('#r-love');
    const local = !!state.votes.reactions[img.id]?.love;
    button.classList.toggle('on', local || mine.has(img.id));
    button.disabled = sharedHost && (pending.has(img.id) || mine.has(img.id));
    button.textContent = !sharedHost ? '♥' : mine.has(img.id) ? '♥ Requested' : pending.has(img.id) ? 'Sending…' : '♥ Like for print';
    button.title = sharedHost ? 'Send an anonymous shared print request' : 'Save a heart on this browser';
    const lines = [];
    if (img.requires_typography) lines.push('Text-free design base · awaiting Robert’s typography');
    if (img.print_proof) {
      const proof = img.print_proof;
      lines.push((img.requires_typography ? 'Design-base proof' : 'Ready for print') + ' · ' + proof.width + '×' + proof.height + ' px · ' + proof.ppi + ' ppi ' + proof.profile + ' · paper sample ' + proof.physical_sample);
    }
    if (sharedHost && online) {
      const n = counts.get(img.id) || 0;
      lines.push(n + (n === 1 ? ' shared print request' : ' shared print requests'));
      if (local && !mine.has(img.id)) lines.push('Saved locally. Like for print to share it.');
    }
    if (printMessage) lines.push(printMessage);
    $('#v-print').textContent = lines.join(' · ');
  }
  async function likeForPrint(img) {
    if (pending.has(img.id) || mine.has(img.id)) return;
    pending.add(img.id); printMessage = ''; renderPrintStatus(img);
    try {
      if (!online) await syncRequests();
      await syncRequests([img.id]);
      const vote = reaction(img.id); vote.love = true; vote.no = false; saveVotes();
    } catch (e) { printMessage = e.message || 'Please try again.'; }
    finally { pending.delete(img.id); if (!$('#viewer').hidden) renderPrintStatus(state.list[state.index]); }
  }
  function toggle(kind) {
    const img = state.list[state.index]; if (!img) return;
    if (kind === 'love' && sharedHost) { likeForPrint(img); return; }
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
      saveVotes(); renderGrid(); updateShareButton();
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

  function localUnshared() {
    return allImages().filter((i) => state.votes.reactions[i.id]?.love && !mine.has(i.id)).map((i) => i.id);
  }
  function updateShareButton() {
    const btn = $('#fb-share'), n = localUnshared().length;
    btn.hidden = !sharedHost || !n;
    btn.textContent = 'Share ' + n + ' saved ' + (n === 1 ? 'heart' : 'hearts') + ' as print requests';
  }
  async function shareSaved() {
    const btn = $('#fb-share'); btn.disabled = true;
    try {
      await syncRequests();
      const ids = localUnshared();
      for (let i = 0; i < ids.length; i += 30) await syncRequests(ids.slice(i, i + 30));
      $('#fb-status').textContent = 'Shared ' + ids.length + ' saved hearts as print requests.';
    } catch (e) { $('#fb-status').textContent = e.message + ' You can retry safely.'; }
    finally { btn.disabled = false; updateShareButton(); }
  }
  function setView(view, updateUrl) {
    const landingView = sharedHost && state.scope === 'all' ? 'selected' : 'all';
    state.view = ['all', 'selected', 'ready', 'requested'].includes(view) ? view : landingView;
    const url = new URL(location.href);
    url.searchParams.set('view', state.view);
    if (state.view === 'requested' && !sharedHost) {
      location.assign(sharedSite + url.search);
      return;
    }
    // Retain a selected category when it has matches in this view.
    if (state.collection !== 'robert' && state.category !== 'all' && !allImages().some((img) => img.category === state.category && inView(img))) {
      state.category = 'all'; url.searchParams.delete('category');
    }
    if (updateUrl) history.replaceState(null, '', url);
    document.querySelectorAll('#views [data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
    renderCategories(); renderGrid();
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
    $('#btn-feedback').onclick = () => { $('#fb-name').value = state.votes.name || ''; $('#fb-status').textContent = ''; updateShareButton(); $('#sheet').hidden = false; };
    $('#fb-share').onclick = shareSaved;
    $('#fb-info').textContent = sharedHost
      ? 'New hearts request a print publicly and anonymously. Stars and notes stay on this device until you share feedback. Restored hearts can be shared below.'
      : 'Hearts, stars and notes stay in this browser. Download a backup to share them or restore it on the Netlify gallery.';
    $('#fb-cancel').onclick = () => { $('#sheet').hidden = true; };
    $('#fb-export').onclick = download;
    $('#fb-import').onclick = () => $('#fb-file').click();
    $('#fb-file').onchange = () => { restore($('#fb-file').files[0]); $('#fb-file').value = ''; };
    $('#fb-send').onclick = send;
    // Netlify injects form-name only when it has registered this form.
    $('#fb-send').hidden = !document.querySelector('form[name="lazart-feedback"] input[name="form-name"]');
    document.querySelectorAll('#views [data-view]').forEach((b) => { b.onclick = () => setView(b.dataset.view, true); });
    document.querySelectorAll('#lanes [data-lane]').forEach((b) => { b.onclick = () => { state.lane = b.dataset.lane; document.querySelectorAll('#lanes [data-lane]').forEach((x) => x.classList.toggle('on', x === b)); renderGrid(); }; });
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

  async function loadCatalogue() {
    if (sharedHost) {
      try {
        const r = await fetch(publications + 'data.json?v=' + Math.floor(Date.now() / 60000), { signal: AbortSignal.timeout(12000) });
        if (!r.ok) throw new Error('Publication unavailable');
        const data = await r.json();
        if (data.catalogue !== 'lazart-moss' || !data.categories?.length) throw new Error('Invalid publication');
        for (const c of data.categories) for (const img of c.images) {
          img.thumb = new URL(img.thumb, publications).href; img.full = new URL(img.full, publications).href;
        }
        return data;
      } catch { /* Use the last reviewed snapshot bundled with the Netlify front end. */ }
    }
    const r = await fetch('data.json');
    if (!r.ok) throw new Error('Gallery catalogue unavailable');
    return r.json();
  }

  loadCatalogue().then(async(data) => {
    state.data = data;
    state.data.collections ||= [{ slug: 'studio', title: 'Studio', categories: data.categories }];
    loadVotes(data.catalogue);
    const url = new URL(location.href);
    if (data.collections.some((c) => c.slug === url.searchParams.get('collection'))) state.collection = url.searchParams.get('collection');
    state.category = categoryOptions().some((c) => c.slug === url.searchParams.get('category')) ? url.searchParams.get('category') : 'all';
    renderCollections();
    setupRuns(); wire();
    if (url.searchParams.get('view') === 'requested' && sharedHost) await refreshRequests();
    setView(url.searchParams.get('view'), false); saveVotes();
    if (sharedHost) {
      refreshRequests();
      window.addEventListener('focus', refreshRequests);
      setInterval(() => { if (!document.hidden) refreshRequests(); }, 30000);
    }
  }).catch((e) => { $('#subtitle').textContent = 'Could not load data.json (' + e.message + ')'; });
})();
