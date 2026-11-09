/* LAZART review gallery: personal, reversible reactions saved in this browser.
   Download JSON to share feedback. Hearts never submit print requests. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const sharedHost = location.hostname === 'lazart-moss-gallery.netlify.app';
  const publicationOrigins = ['https://raw.githubusercontent.com/lokigod69/lazart-gallery/main/', 'https://lokigod69.github.io/lazart-gallery/'];
  const endpoint = '/.netlify/functions/print-requests';
  const state = { data: null, collection: 'all', lane: 'all', scope: 'all', view: 'all', category: 'all', favsOnly: false, list: [], index: -1, votes: null, key: null };
  let storageAvailable = true;
  let catalogueCheckedAt = Date.now(), cataloguePromise = null, deferredCatalogue = null;

  async function recoverLegacyHearts() {
    if (!sharedHost || state.votes.legacyPrintHeartsRecovered) return;
    try {
      // Read old hearts once so the earlier server-backed UI loses no selections.
      // An explicit local choice, including an unlike made during this read, wins.
      const response = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(12000) });
      const data = await response.json();
      if (!response.ok || data.version !== 1 || !Array.isArray(data.mine)) return;
      for (const id of data.mine) {
        if (typeof id !== 'string' || !/^[a-f0-9]{16}$/.test(id)) continue;
        const vote = reaction(id);
        if (!Object.prototype.hasOwnProperty.call(vote, 'love') && !vote.no) vote.love = true;
      }
      state.votes.legacyPrintHeartsRecovered = true;
      saveVotes();
      if ($('#viewer').hidden) renderGrid();
      else renderPrintStatus(state.list[state.index]);
    } catch { /* Personal hearts work offline; retry recovery on the next visit. */ }
  }

  function updateHeartCount() {
    const loved = new Set(Object.entries(state.votes.reactions).filter(([, r]) => r.love).map(([id]) => id));
    $('#fav-count').textContent = loved.size;
    $('#btn-favs').setAttribute('aria-label', 'Show my ' + loved.size + ' liked images');
    $('#fb-count').textContent = loved.size + (loved.size === 1 ? ' liked image' : ' liked images') + ' in your feedback.';
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
    try {
      localStorage.setItem(state.key, JSON.stringify(state.votes));
      storageAvailable = true;
      try { localStorage.setItem('lazart-name', state.votes.name || ''); } catch {}
    } catch { storageAvailable = false; }
    $('#vote-status').hidden = storageAvailable;
    $('#vote-status').textContent = storageAvailable ? '' : 'This browser cannot save feedback. Download JSON before refreshing or closing this page.';
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
    menu.innerHTML = '';
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
      && (state.view !== 'selected' || img.status === 'selected');
  }
  function reviewedByControls() {
    return allImages().filter((img) => {
      if (!inScope(img)) return false;
      if (state.category !== 'all' && img.category !== state.category) return false;
      if (state.lane !== 'all' && img.lane !== state.lane) return false;
      if (state.favsOnly && !(state.votes.reactions[img.id] || {}).love) return false;
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
    renderProgress();
    const grid = $('#grid');
    grid.innerHTML = '';
    const reviewed = reviewedByControls();
    state.list = reviewed.filter(inView).sort((a, b) => a.rank - b.rank);
    const subtitle = state.favsOnly ? state.list.length + ' liked images'
      : state.view === 'ready' ? state.list.length + ' ready for print'
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
      if (img.score10 || img.score) { const s = document.createElement('span'); s.className = 'score'; s.textContent = aiScore(img); card.appendChild(s); }
      if (img.editorial_recheck) { const flag = document.createElement('span'); flag.className = 'rating-state'; flag.textContent = 'Editorial recheck'; card.appendChild(flag); }
      if (img.print_proof || img.requires_typography || img.concept_variant) {
        const p = document.createElement('span'); p.className = 'print-state';
        p.textContent = [img.requires_typography ? 'Typography pending' : img.print_proof ? 'Ready for print' : '', img.concept_variant ? 'Composition variant · shared target credit' : ''].filter(Boolean).join(' · ');
        card.appendChild(p);
      }
      card.onclick = () => open(i);
      frag.appendChild(card);
    });
    grid.appendChild(frag);
    $('#empty').hidden = state.list.length > 0;
    $('#empty').textContent = state.favsOnly ? 'No liked images match these filters. Turn off the heart filter to browse and add more.' : 'No images match these filters.';
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
      img.score10 || img.score ? aiScore(img) + ' · ' + img.status + (img.editorial_recheck ? ' · editorial recheck' : '') : '',
    ].filter(Boolean).join(' · ');
    $('#v-prompt').textContent = [
      img.prompt, 'Key: ' + img.key, 'Run: ' + img.run,
      img.loras?.length ? 'Adapters: ' + img.loras.join(', ') : '',
      img.parent ? 'Parent: ' + img.parent : '',
      img.note ? 'AI note: ' + img.note : '',
      img.rating_note ? 'Ten-point review: ' + img.rating_note : '',
    ].filter(Boolean).join('\n\n');
    const r = state.votes.reactions[img.id] || {};
    renderPrintStatus(img);
    $('#r-more').classList.toggle('on', !!r.more);
    $('#r-more').setAttribute('aria-pressed', !!r.more);
    $('#r-no').classList.toggle('on', !!r.no);
    $('#r-no').setAttribute('aria-pressed', !!r.no);
    $('#v-note').value = r.note || '';
    if (state.list[i + 1]) { const pre = new Image(); pre.src = state.list[i + 1].full; }
  }
  function close() { $('#viewer').hidden = true; document.body.style.overflow = ''; if (!applyDeferredCatalogue()) renderGrid(); }
  function step(d) { const n = state.index + d; if (n >= 0 && n < state.list.length) open(n); }
  function renderPrintStatus(img) {
    if (!img) return;
    const button = $('#r-love');
    const local = !!state.votes.reactions[img.id]?.love;
    button.classList.toggle('on', local);
    button.disabled = false;
    button.textContent = local ? '♥' : '♡';
    button.title = local ? 'Unlike this image' : 'Like this image';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', local);
    const lines = [];
    if (img.requires_typography) lines.push('Text-free design base · awaiting Robert’s typography');
    if (img.concept_variant) lines.push('Composition variant · retained with its ratings, hearts and proofs; shares target credit with ' + img.concept_variant.keeper_concept.replace(/-/g, ' ') + '.');
    if (img.print_proof) {
      const proof = img.print_proof;
      lines.push((img.requires_typography ? 'Design-base proof' : 'Ready for print') + ' · ' + proof.width + '×' + proof.height + ' px · ' + proof.ppi + ' ppi ' + proof.profile + ' · paper sample ' + proof.physical_sample);
    }
    if (!storageAvailable) lines.push('Feedback is only saved for this visit. Download JSON before leaving.');
    $('#v-print').textContent = lines.join(' · ');
  }
  function toggle(kind) {
    const img = state.list[state.index]; if (!img) return;
    const r = reaction(img.id);
    r[kind] = !r[kind];
    if (kind === 'no' && r.no) { r.love = false; r.more = false; }
    if ((kind === 'love' || kind === 'more') && r[kind]) r.no = false;
    saveVotes();
    const index = state.index;
    renderGrid();
    if (!state.list.length) close();
    else open(Math.min(index, state.list.length - 1));
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
    $('#fb-status').textContent = 'JSON downloaded. Send this file to Michael to share your feedback.';
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
  function setView(view, updateUrl) {
    const landingView = sharedHost && state.scope === 'all' ? 'selected' : 'all';
    state.view = ['all', 'selected', 'ready'].includes(view) ? view : landingView;
    const url = new URL(location.href);
    url.searchParams.set('view', state.view);
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
    $('#btn-favs').onclick = () => {
      state.favsOnly = !state.favsOnly;
      $('#btn-favs').classList.toggle('on', state.favsOnly);
      $('#btn-favs').setAttribute('aria-pressed', state.favsOnly);
      if (state.favsOnly) {
        // The total heart count opens the whole personal selection, even from a narrow run/category.
        state.collection = state.lane = state.scope = state.category = 'all';
        $('#run').value = 'all';
        const url = new URL(location.href);
        for (const key of ['collection', 'category', 'run', 'wave']) url.searchParams.delete(key);
        history.replaceState(null, '', url);
        document.querySelectorAll('#lanes [data-lane]').forEach((b) => b.classList.toggle('on', b.dataset.lane === 'all'));
        renderCollections(); setView('all', true);
      } else renderGrid();
    };
    $('#btn-feedback').onclick = () => {
      $('#fb-name').value = state.votes.name || ''; $('#fb-status').textContent = '';
      $('#fb-info').textContent = storageAvailable
        ? 'Hearts, stars and notes are saved in this browser. Tap a heart again to unlike. Download JSON and send the file to Michael to share your feedback.'
        : 'This browser cannot save feedback between visits. Download JSON before refreshing or leaving, then send the file to Michael.';
      $('#sheet').hidden = false;
    };
    $('#fb-cancel').onclick = () => { $('#sheet').hidden = true; applyDeferredCatalogue(); };
    $('#fb-export').onclick = download;
    $('#fb-import').onclick = () => $('#fb-file').click();
    $('#fb-file').onchange = () => { restore($('#fb-file').files[0]); $('#fb-file').value = ''; };
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

  function aiScore(img) {
    return Number.isInteger(img.score10) && img.score10 >= 1 && img.score10 <= 10 ? 'AI ' + img.score10 + '/10' : img.score ? 'AI ' + img.score + '/5' : '';
  }
  function renderProgress() {
    const element = $('#collection-progress'), progress = state.data.progress?.robert;
    element.hidden = state.collection !== 'robert' || !progress;
    if (element.hidden) return;
    const date = new Date(progress.published_at || state.data.built_at);
    const stamp = Number.isNaN(date.getTime()) ? state.data.built_at : date.toLocaleString();
    const target = Number.isInteger(progress.qualified_concepts)
      ? ' · ' + progress.qualified_concepts + ' concepts meet the 8/10+ target'
        + (progress.recheck_concepts ? ' · ' + progress.recheck_concepts + ' for recheck' : '')
        + (progress.rating_pending_concepts ? ' · ' + progress.rating_pending_concepts + ' awaiting rating' : '')
        + (progress.audit_pending_concepts ? ' · ' + progress.audit_pending_concepts + ' awaiting audit' : '') : '';
    const variants = progress.variant_concepts ? ' · ' + progress.variant_concepts + ' retained composition variants share target credit' : '';
    element.textContent = 'Robert · ' + progress.generated + ' generated · ' + progress.reviewed + ' reviewed · ' + progress.selected + ' AI-selected to date' + target + variants + ' · Snapshot published ' + stamp + '. Updates with gallery publications.';
  }
  function normalizeCatalogue(data) {
    data.collections ||= [{ slug: 'studio', title: 'Studio', categories: data.categories }];
    return data;
  }
  async function publishedCatalogue(current = null) {
    for (const origin of publicationOrigins) {
      try {
        const options = () => ({ cache: 'no-store', signal: AbortSignal.timeout(12000) });
        let release = null;
        try {
          const marker = await fetch(origin + 'release.json?v=' + Math.floor(Date.now() / 120000), options());
          if (marker.ok) {
            const value = await marker.json();
            if (/^[a-f0-9]{64}$/.test(value.sha256) && Number.isFinite(Date.parse(value.built_at))) release = value;
          }
        } catch { /* Older publications have no marker; read their ordinary JSON. */ }
        if (release && current?._releaseDigest === release.sha256) return current;
        if (release && current && Date.parse(release.built_at) < Date.parse(current.built_at)) continue;
        // A query on a mutable filename does not identify immutable GitHub bytes.
        // Only the exact digest-named relative path is allowed; never follow a
        // marker-supplied host, traversal, query or arbitrary public JSON file.
        const immutablePath = release?.catalogue_path;
        if (immutablePath !== undefined && immutablePath !== 'catalogues/' + release.sha256 + '.json') throw new Error('Invalid publication path');
        let r;
        if (immutablePath) {
          r = await fetch(origin + immutablePath, options());
          if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error('Publication unavailable');
        }
        // Old markers and expired immutable versions retain the legacy protocol.
        // Its bytes must still match this marker; otherwise try another origin.
        if (!r?.ok) r = await fetch(origin + 'data.json?v=' + (release?.sha256 || Math.floor(Date.now() / 120000)), options());
        if (!r.ok) throw new Error('Publication unavailable');
        let data;
        if (release) {
          const body = await r.text();
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body))), (b) => b.toString(16).padStart(2, '0')).join('');
          if (digest !== release.sha256) throw new Error('Publication is still propagating');
          data = JSON.parse(body);
          if (data.built_at !== release.built_at) throw new Error('Publication marker mismatch');
          data._releaseDigest = digest;
        } else data = await r.json();
        if (data.catalogue !== 'lazart-moss' || !data.categories?.length || !Number.isFinite(Date.parse(data.built_at))) throw new Error('Invalid publication');
        if (current && Date.parse(data.built_at) < Date.parse(current.built_at)) continue;
        // The feed and BOTH derivative sizes must use the same accessible release origin.
        for (const c of data.categories) for (const img of c.images) {
          for (const key of ['thumb', 'full']) if (img[key]) {
            const path = new URL(img[key], origin).pathname.match(/\/img\/[a-f0-9]{16}_[tf]\.webp$/)?.[0];
            if (!path) throw new Error('Invalid publication image');
            img[key] = new URL(path.slice(1), origin).href;
          }
        }
        return normalizeCatalogue(data);
      } catch { /* Try Pages, then retain the current or locally baked reviewed snapshot. */ }
    }
    if (current) return current;
    throw new Error('Publication unavailable');
  }
  function applyCatalogue(data) {
    state.data = data;
    // Rebuild only run options; current filters and all reactions keep their identities.
    const scope = state.scope, category = state.category;
    setupRuns(); state.scope = scope; $('#run').value = scope; state.category = category;
    renderCollections(); renderCategories(); renderGrid(); updateHeartCount();
  }
  function applyDeferredCatalogue() {
    if (!deferredCatalogue || !$('#viewer').hidden || !$('#sheet').hidden) return false;
    const data = deferredCatalogue; deferredCatalogue = null; applyCatalogue(data); return true;
  }
  async function refreshCatalogue(awakened = false) {
    const elapsed = Date.now() - catalogueCheckedAt;
    if (!sharedHost || document.hidden || cataloguePromise || elapsed < (awakened ? 15000 : 120000)) return;
    catalogueCheckedAt = Date.now();
    cataloguePromise = (async() => {
      try {
        const current = deferredCatalogue || state.data;
        const data = await publishedCatalogue(current);
        if (Date.parse(data.built_at) < Date.parse(current.built_at)) return;
        if (data === current || (!data._releaseDigest && data.built_at === current.built_at && data.count === current.count && JSON.stringify(data.progress) === JSON.stringify(current.progress))) return;
        deferredCatalogue = data; applyDeferredCatalogue();
      } catch { /* Retain the visible publication and all local reactions on transient failure. */ }
    })();
    try { await cataloguePromise; } finally { cataloguePromise = null; }
  }
  async function loadCatalogue() {
    if (sharedHost) {
      try {
        return await publishedCatalogue();
      } catch { /* Use the last reviewed snapshot bundled with the Netlify front end. */ }
    }
    const r = await fetch('data.json');
    if (!r.ok) throw new Error('Gallery catalogue unavailable');
    return normalizeCatalogue(await r.json());
  }

  loadCatalogue().then(async(data) => {
    state.data = data;
    loadVotes(data.catalogue);
    const url = new URL(location.href);
    if (data.collections.some((c) => c.slug === url.searchParams.get('collection'))) state.collection = url.searchParams.get('collection');
    state.category = categoryOptions().some((c) => c.slug === url.searchParams.get('category')) ? url.searchParams.get('category') : 'all';
    renderCollections();
    setupRuns(); wire();
    setView(url.searchParams.get('view'), false); saveVotes();
    if (sharedHost) {
      recoverLegacyHearts();
      const awaken = () => { if (!document.hidden) refreshCatalogue(true); };
      window.addEventListener('focus', awaken);
      document.addEventListener('visibilitychange', awaken);
      setInterval(() => { if (!document.hidden) refreshCatalogue(); }, 30000);
    }
  }).catch((e) => { $('#subtitle').textContent = 'Could not load data.json (' + e.message + ')'; });
})();
