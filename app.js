/* LAZART review gallery: named online feedback, reversible hearts and local retry cache. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const legacyHost = location.hostname === 'lazart-moss-gallery.netlify.app';
  const sharedHost = legacyHost || location.hostname === 'gallery.lazart.art' ||
    location.hostname === 'lazart-gallery.pages.dev' || location.hostname.endsWith('.lazart-gallery.pages.dev') ||
    (['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '8195');
  const curationHost = sharedHost && !legacyHost;
  const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname) && location.pathname.startsWith('/gallery/');
  if ($('#owner-curate')) $('#owner-curate').hidden = !localPreview;
  $('#btn-curate').hidden = !curationHost;
  const publicationOrigins = ['https://raw.githubusercontent.com/lokigod69/lazart-gallery/main/', 'https://lokigod69.github.io/lazart-gallery/'];
  const endpoint = '/.netlify/functions/print-requests';
  const state = { data: null, category: 'all', tags: new Set(), favsOnly: false, candidatesExpanded: false, list: [], index: -1, votes: null, key: null };
  let storageAvailable = true;
  let reviewer = null, pendingReaction = null, profileMessage = '', languageExplicit = false;
  let profileReturnFocus = null, viewerReturnId = null, theme = 'dark';
  try { if (localStorage.getItem('lazart-theme') === 'light') theme = 'light'; } catch {}
  let language = (navigator.language || 'en').startsWith('de') ? 'de' : 'en';
  try { const saved = localStorage.getItem('lazart-language'); if (['en', 'de'].includes(saved)) { language = saved; languageExplicit = true; } } catch {}
  const words = {
    en: { feedback: 'My selection', nickname: 'Your name or nickname', startTitle: 'What should we call you?', startInfo: 'Choose a nickname once. Your likes save online automatically, and this browser remembers you.', accountInfo: 'Your likes are saved online for Michael. Tap a heart again to unlike. Finish selection when you want to save a dated snapshot.', start: 'Start liking', rename: 'Save name', finish: 'Finish selection', done: 'Done', cancel: 'Not now', backup: 'Backup / restore', download: 'Download backup', restore: 'Restore my backup', legacy: 'Include my {n} existing likes in this profile', likes: '{n} liked images', showLikes: 'Show my {n} liked images', like: 'Like this image', unlike: 'Unlike this image', more: 'More like this', no: 'Not for me', note: 'Note (optional)', details: 'Prompt & provenance', close: 'Close', prev: 'Previous', next: 'Next', selected: 'AI selections', all: 'All reviewed', ready: 'Ready for print', allCollections: 'All collections', allRuns: 'All runs', allLanes: 'All styles', safe: 'Classic', twist: 'Lazart twist', allCategories: 'All', loading: 'Connecting to your selection…', saving: 'Saving…', saved: 'Saved online · {name}', offline: 'Waiting to sync · your changes are kept on this device', needsName: 'Like the pictures you love. We’ll ask for your nickname with your first heart.', noStorage: 'This browser cannot keep an offline backup. Keep this page open until your changes are saved online.', empty: 'No images match these filters.', emptyLikes: 'No liked images here yet. Turn off the heart filter to explore.', submitted: 'Selection finished. Michael can see this snapshot. You can keep liking and finish again later.', submittedAt: 'Last finished: {date}', createError: 'Could not create your profile. Check your connection and try again.', saveError: 'Could not save yet. Your choices are kept here; please try again.', nameRequired: 'Please enter a name or nickname.', wrongBackup: 'This backup has another name. Import other people’s files in the private reviewer view.', restored: 'Restored {n} reactions. Existing choices are kept.', backupSaved: 'Backup downloaded. Your online likes do not need to be emailed.', run: 'Filter by run', images: '{n} images', likedWall: '{n} liked images', reviewWall: '{selected} selected · {all} reviewed', built: 'updated', cloudLink: 'Open the online gallery to save your selection', profileReady: 'Profile ready. Just tap the hearts you like.' },
    de: { feedback: 'Meine Auswahl', nickname: 'Dein Name oder Spitzname', startTitle: 'Wie sollen wir dich nennen?', startInfo: 'Wähle einmal einen Spitznamen. Deine Likes werden automatisch online gespeichert. Dieser Browser merkt sich dein Profil.', accountInfo: 'Deine Likes werden online für Michael gespeichert. Tippe erneut auf ein Herz, um es zu entfernen. Mit „Auswahl abschließen“ speicherst du einen festen Zwischenstand.', start: 'Loslegen', rename: 'Namen speichern', finish: 'Auswahl abschließen', done: 'Fertig', cancel: 'Später', backup: 'Sicherung / Wiederherstellen', download: 'Sicherung herunterladen', restore: 'Meine Sicherung laden', legacy: 'Meine {n} bisherigen Likes diesem Profil hinzufügen', likes: '{n} gelikte Bilder', showLikes: 'Meine {n} gelikten Bilder anzeigen', like: 'Bild liken', unlike: 'Like entfernen', more: 'Mehr in diesem Stil', no: 'Nicht mein Geschmack', note: 'Notiz (optional)', details: 'Prompt & Herkunft', close: 'Schließen', prev: 'Zurück', next: 'Weiter', selected: 'KI-Auswahl', all: 'Alle Bilder', ready: 'Druckdatei vorhanden', allCollections: 'Alle Sammlungen', allRuns: 'Alle Serien', allLanes: 'Alle Stile', safe: 'Klassisch', twist: 'Lazart-Twist', allCategories: 'Alle', loading: 'Deine Auswahl wird geladen…', saving: 'Wird gespeichert…', saved: 'Online gespeichert · {name}', offline: 'Noch nicht synchronisiert · Änderungen bleiben auf diesem Gerät', needsName: 'Like die Bilder, die dir gefallen. Beim ersten Herz fragen wir nach deinem Spitznamen.', noStorage: 'Dieser Browser kann keine lokale Sicherung speichern. Lass die Seite offen, bis deine Änderungen online gespeichert sind.', empty: 'Keine Bilder passen zu diesen Filtern.', emptyLikes: 'Hier sind noch keine gelikten Bilder. Schalte den Herzfilter aus und entdecke weitere Bilder.', submitted: 'Auswahl abgeschlossen. Michael sieht diesen Zwischenstand. Du kannst weiter liken und später erneut abschließen.', submittedAt: 'Zuletzt abgeschlossen: {date}', createError: 'Dein Profil konnte nicht angelegt werden. Prüfe die Verbindung und versuche es erneut.', saveError: 'Noch nicht gespeichert. Deine Auswahl bleibt hier erhalten. Bitte versuche es erneut.', nameRequired: 'Bitte gib einen Namen oder Spitznamen ein.', wrongBackup: 'Diese Sicherung trägt einen anderen Namen. Dateien anderer Personen gehören in die private Bewertungsansicht.', restored: '{n} Bewertungen wiederhergestellt. Vorhandene Entscheidungen bleiben erhalten.', backupSaved: 'Sicherung heruntergeladen. Deine Online-Likes musst du nicht per E-Mail senden.', run: 'Nach Serie filtern', images: '{n} Bilder', likedWall: '{n} gelikte Bilder', reviewWall: '{selected} ausgewählt · {all} bewertet', built: 'aktualisiert', cloudLink: 'Online-Galerie öffnen und deine Auswahl speichern', profileReady: 'Dein Profil ist bereit. Tippe einfach auf die Herzen.' }
  };
  Object.assign(words.en, { myLikes: 'My likes', allArtwork: 'All artwork', filters: 'Filters', clearFilters: 'Clear filters', searchCategories: 'Search categories', noCategories: 'No matching categories.', filterHelp: 'Combine filters across every category. Images must match every selected filter.', shortlist: 'Release shortlist', shortlistLabel: 'Shortlist', candidates: 'Artwork', moreCandidates: 'More in this category', allCandidates: 'More artwork', showCandidates: 'Show {n} other candidates', hideCandidates: 'Hide other candidates', chosen: '{n} of {target} chosen', chosenAll: '{n} chosen', shortlistFiltered: '{n} shown · {total} chosen', noArt: 'This category is taking shape.', noArtHelp: 'There are no candidates here yet. Explore another category while we build this collection.', emptyHelp: 'Try removing a filter or choose another category.', allDescription: 'Find the pieces you would love to live with.', uncategorizedDescription: 'Good possibilities, still finding their place.', light: 'Light', dark: 'Dark', switchLight: 'Switch to light theme', switchDark: 'Switch to dark theme', removeFilter: 'Remove {tag} filter', imageUnavailable: 'Preview unavailable', selectedCategory: 'Selected category', exploreAll: 'Explore all artwork' });
  Object.assign(words.de, { myLikes: 'Meine Likes', allArtwork: 'Alle Kunstwerke', filters: 'Filter', clearFilters: 'Filter löschen', searchCategories: 'Kategorien suchen', noCategories: 'Keine passende Kategorie.', filterHelp: 'Filter gelten für jede Kategorie. Bilder müssen zu allen gewählten Filtern passen.', shortlist: 'Auswahl für den Shop', shortlistLabel: 'Vorauswahl', candidates: 'Kunstwerke', moreCandidates: 'Mehr in dieser Kategorie', allCandidates: 'Weitere Kunstwerke', showCandidates: '{n} weitere Kandidaten zeigen', hideCandidates: 'Weitere Kandidaten ausblenden', chosen: '{n} von {target} ausgewählt', chosenAll: '{n} ausgewählt', shortlistFiltered: '{n} sichtbar · {total} ausgewählt', noArt: 'Diese Kategorie entsteht gerade.', noArtHelp: 'Hier gibt es noch keine Kandidaten. Entdecke inzwischen eine andere Kategorie.', emptyHelp: 'Entferne einen Filter oder wähle eine andere Kategorie.', allDescription: 'Finde die Bilder, mit denen du leben möchtest.', uncategorizedDescription: 'Gute Möglichkeiten, deren Platz noch offen ist.', light: 'Hell', dark: 'Dunkel', switchLight: 'Zum hellen Design wechseln', switchDark: 'Zum dunklen Design wechseln', removeFilter: 'Filter {tag} entfernen', imageUnavailable: 'Vorschau nicht verfügbar', selectedCategory: 'Gewählte Kategorie', exploreAll: 'Alle Kunstwerke entdecken' });
  Object.assign(words.en, {
    filters: 'Tag filters', browseCategories: 'Browse by category', shortlist: 'Category shortlist',
    shortlistLabel: 'Selected', suggestedLabel: 'Suggested', shortlistProgress: '{n} of {target} shortlisted',
    suggestedCount: '{n} suggested', candidateCount: '{n} candidates', communityLikes: '{n} total likes',
    order: 'Order', suggestedOrder: 'Gallery order', likedOrder: 'Most liked',
    shortlistHelp: 'Hearts save your personal likes and contribute to the gallery total. Only the gallery owner selects the final shortlist.',
  });
  Object.assign(words.de, {
    filters: 'Schlagwortfilter', browseCategories: 'Nach Kategorie stöbern', shortlist: 'Vorauswahl der Kategorie',
    shortlistLabel: 'Ausgewählt', suggestedLabel: 'Vorgeschlagen', shortlistProgress: '{n} von {target} in der Vorauswahl',
    suggestedCount: '{n} vorgeschlagen', candidateCount: '{n} Kandidaten', communityLikes: '{n} Likes insgesamt',
    order: 'Reihenfolge', suggestedOrder: 'Galerie-Reihenfolge', likedOrder: 'Meiste Likes',
    shortlistHelp: 'Mit einem Herz speicherst du dein Like und erhöhst die Gesamtzahl der Galerie. Die endgültige Vorauswahl trifft nur der Galeriebesitzer.',
  });
  Object.assign(words.en, {"curationUnavailable": "Shared shortlist unavailable. Reconnect before editing or saving.", "curationRetry": "Could not connect. Your draft is retained; try again.", "curationAlternate": "Another version selected", "curationAlternateHelp": "Another version of this artwork is selected. Remove that version first.", "curationConflictError": "The online shortlist changed. Resolve the conflict below.", "curationAuthError": "Enter the curator access code to continue. Your draft is retained.", "curationInvalid": "Could not save this selection. Check for duplicate versions of the same artwork.", "curationRate": "Too many unlock attempts. Please try again later.", "curationConflict": "Online changes detected. Your draft has been kept.", "curationUnlockHelp": "Unlock to edit the shared shortlist.", "curationChoose": "Choose a category to curate its shortlist.", "curationCount": "{n} selected", "curationDirty": "Unsaved changes", "curationSavedSelection": "Saved selection", "curationPending": "Pending categories: {n}", "curationSaved": "Shortlist saved online.", "curationReapplied": "Your changes were reapplied. Review and save the shortlist online.", "curationReloaded": "Loaded the latest online selection.", "curationLocked": "Curation locked. Pending drafts remain in this tab.", "curate": "Curate", "curationCode": "Curator access code", "curationUnlock": "Unlock curation", "curationHelp": "Your shortlist is shared online. Hearts remain your personal likes. Changes in other categories stay in this tab until saved.", "curationSave": "Save shortlist online", "curationLock": "Lock curation", "curationConflictHelp": "This category changed online. Your draft is still here. Reload to discard it, or reapply your additions and removals to the latest list, then save.", "curationReload": "Reload online selection", "curationReapply": "Reapply my changes", "curationAdd": "+ Add", "curationRemove": "− Remove", "curationAddLabel": "Add to shortlist: ", "curationRemoveLabel": "Remove from shortlist: "});
  Object.assign(words.de, {"curationUnavailable": "Online-Auswahl nicht erreichbar. Vor dem Bearbeiten oder Speichern erneut verbinden.", "curationRetry": "Keine Verbindung. Dein Entwurf bleibt erhalten. Bitte erneut versuchen.", "curationAlternate": "Andere Version ausgewählt", "curationAlternateHelp": "Eine andere Version dieses Kunstwerks ist ausgewählt. Entferne zuerst diese Version.", "curationConflictError": "Die Online-Auswahl hat sich geändert. Löse den Konflikt unten.", "curationAuthError": "Gib den Zugangscode ein. Dein Entwurf bleibt erhalten.", "curationInvalid": "Auswahl konnte nicht gespeichert werden. Prüfe auf mehrere Versionen desselben Kunstwerks.", "curationRate": "Zu viele Anmeldeversuche. Bitte versuche es später erneut.", "curationConflict": "Online-Änderungen erkannt. Dein Entwurf bleibt erhalten.", "curationUnlockHelp": "Entsperren, um die gemeinsame Auswahl zu bearbeiten.", "curationChoose": "Wähle eine Kategorie, um ihre Auswahl zu bearbeiten.", "curationCount": "{n} ausgewählt", "curationDirty": "Ungespeicherte Änderungen", "curationSavedSelection": "Gespeicherte Auswahl", "curationPending": "Ungespeicherte Kategorien: {n}", "curationSaved": "Auswahl online gespeichert.", "curationReapplied": "Deine Änderungen wurden erneut angewendet. Prüfe die Auswahl und speichere sie online.", "curationReloaded": "Aktuelle Online-Auswahl geladen.", "curationLocked": "Bearbeitung gesperrt. Entwürfe bleiben in diesem Tab.", "curate": "Kuratieren", "curationCode": "Zugangscode zur Kuration", "curationUnlock": "Kuration entsperren", "curationHelp": "Deine Auswahl wird online geteilt. Herzen bleiben deine persönlichen Likes. Änderungen anderer Kategorien bleiben bis zum Speichern in diesem Tab.", "curationSave": "Auswahl online speichern", "curationLock": "Kuration sperren", "curationConflictHelp": "Diese Kategorie wurde online geändert. Dein Entwurf bleibt hier. Lade neu, um ihn zu verwerfen, oder übertrage deine Ergänzungen und Entfernungen auf die aktuelle Liste und speichere sie.", "curationReload": "Online-Auswahl neu laden", "curationReapply": "Meine Änderungen erneut anwenden", "curationAdd": "+ Hinzufügen", "curationRemove": "− Entfernen", "curationAddLabel": "Zur Auswahl hinzufügen: ", "curationRemoveLabel": "Aus Auswahl entfernen: "});
  const categoryCopy = {
    'cult-poster': ['Cinema for films that only exist in your imagination.', 'Kino für Filme, die nur in deiner Fantasie existieren.'],
    surrealism: ['Familiar things. Unexpected worlds.', 'Vertraute Dinge. Unerwartete Welten.'],
    'dream-space': ['A little further from the everyday.', 'Ein Stück weiter weg vom Alltag.'],
    'black-white': ['Shape, shadow and everything in between.', 'Form, Schatten und alles dazwischen.'],
    'abstract-modern': ['Colour, texture and room to imagine.', 'Farbe, Textur und Raum für Fantasie.'],
    landscapes: ['Somewhere you would like to stay.', 'Orte, an denen man bleiben möchte.'],
    'people-portraits': ['Faces, gestures and moments of connection.', 'Gesichter, Gesten und Begegnungen.'],
    'pop-art': ['A bolder point of view.', 'Ein Blick mit mehr Farbe.'],
    kids: ['Small adventures. Big imaginations.', 'Kleine Abenteuer. Große Fantasie.'],
    'animal-humor': ['A little absurd. A lot to love.', 'Ein bisschen absurd. Sehr liebenswert.'],
    'graphic-illustration': ['Stories told in shapes and lines.', 'Geschichten in Formen und Linien.'],
    'photo-art': ['Light, detail and a different way of seeing.', 'Licht, Details und ein anderer Blick.'],
    'expressionist-paintings': ['A feeling you can see.', 'Ein Gefühl, das man sehen kann.'],
    erotic: ['Intimate forms and quiet gestures.', 'Intime Formen und stille Gesten.'],
    'floral-botanical': ['A little nature, brought indoors.', 'Ein Stück Natur für drinnen.'],
    'food-drink': ['Good company for the kitchen.', 'Gute Gesellschaft für die Küche.'],
  };
  function t(key, values = {}) { return Object.entries(values).reduce((text, [key, value]) => text.replaceAll('{' + key + '}', value), words[language][key] || words.en[key] || key); }
  let catalogueCheckedAt = Date.now(), cataloguePromise = null, deferredCatalogue = null;
  let likeTotals = null, likeTotalsRequest = null, likeTotalsCheckedAt = 0, candidateOrder = 'suggested';

  const curation = { open: curationHost && new URL(location.href).searchParams.get('curate') === '1', authenticated: false, loaded: false, categories: {}, drafts: new Map(), busy: false, request: null, message: '' };
  const sameIds = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function baselineIds(category) {
    const entry = state.data.shop.shortlists?.[category];
    return entry ? entry.artwork_ids.slice() : allImages().filter(img => img.shop.pick_category_ids.includes(category) || img.shop.suggested_category_ids.includes(category)).map(img => img.id);
  }
  function selectionIds(category) { return (curation.authenticated && curation.open ? curation.drafts.get(category)?.ids : null) || curation.categories[category]?.artwork_ids || baselineIds(category); }
  function dirtyDrafts() { return [...curation.drafts.values()].filter(d => !sameIds(d.ids, d.baseIds)); }
  function draftFor(category) {
    if (!curation.drafts.has(category)) {
      const ids = selectionIds(category).slice();
      curation.drafts.set(category, { ids, baseIds: ids.slice(), revision: curation.categories[category]?.revision || 0, conflict: false });
    }
    return curation.drafts.get(category);
  }
  function acceptCuration(payload) {
    const changed = !curation.loaded || curation.authenticated !== payload.authenticated || JSON.stringify(curation.categories) !== JSON.stringify(payload.categories || {});
    if (!curation.loaded) curation.message = '';
    curation.loaded = true; curation.authenticated = payload.authenticated; curation.categories = payload.categories || {};
    for (const [category, draft] of curation.drafts) {
      if (sameIds(draft.ids, draft.baseIds)) curation.drafts.delete(category);
      else draft.conflict = draft.revision !== (curation.categories[category]?.revision || 0);
    }
    if (changed) { renderCoverage(); renderGrid(); }
  }
  async function curationRequest(body) {
    const response = await fetch('/api/curation', { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 401) curation.authenticated = false;
      if (response.status === 409 && body?.category_id) {
        if (payload.category) curation.categories[body.category_id] = payload.category;
        else delete curation.categories[body.category_id];
        draftFor(body.category_id).conflict = true;
      }
      throw new Error(response.status === 409 ? t('curationConflictError') : response.status === 401 ? t('curationAuthError') : response.status === 400 ? t('curationInvalid') : response.status === 429 ? t('curationRate') : t('curationRetry'));
    }
    return payload;
  }
  async function refreshCuration() {
    if (!curationHost || document.hidden || curation.busy || curation.request || !$('#viewer').hidden || !$('#sheet').hidden) return;
    curation.request = (async () => { try { acceptCuration(await curationRequest()); } catch { if (!curation.loaded) { curation.message = t('curationUnavailable'); renderCuration(); } } finally { curation.request = null; } })();
    await curation.request;
  }
  function renderCuration() {
    $('#curation-panel').hidden = !curation.open;
    $('#curation-panel').setAttribute('aria-label', t('curate'));
    $('#curation-bar').setAttribute('aria-label', t('curationSave'));
    $('#curation-bar').hidden = !curation.open || !curation.authenticated;
    document.documentElement.classList.toggle('curating', curation.open && curation.authenticated);
    $('#curation-login').hidden = curation.authenticated;
    $('#curation-controls').hidden = !curation.authenticated;
    $('#btn-curate').setAttribute('aria-expanded', curation.open);
    $('#btn-curate').setAttribute('aria-controls', 'curation-panel');
    const draft = curation.drafts.get(state.category), dirty = draft && !sameIds(draft.ids, draft.baseIds);
    const editable = !['all', 'uncategorized'].includes(state.category);
    $('#curation-save').disabled = curation.busy || !curation.loaded || !dirty || !!draft?.conflict || !editable;
    for (const id of ['curation-logout', 'curation-reload', 'curation-reapply']) $('#' + id).disabled = curation.busy;
    $('#curation-conflict').hidden = !draft?.conflict;
    $('#curation-status').textContent = curation.busy ? t('saving') : draft?.conflict ? t('curationConflict') : curation.message || (!curation.authenticated ? t('curationUnlockHelp') : !editable ? t('curationChoose') : t('curationCount', { n: selectionIds(state.category).length }) + ' · ' + (dirty ? t('curationDirty') : t('curationSavedSelection')) + (dirtyDrafts().length ? ' · ' + t('curationPending', { n: dirtyDrafts().length }) : ''));
    $('#curation-bar-status').textContent = $('#curation-status').textContent;
  }
  function toggleCurated(id) {
    const selected = selectionIds(state.category), image = allImages().find(img => img.id === id);
    if (!selected.includes(id) && image?.shop.concept_group && allImages().some(other => other.id !== id && selected.includes(other.id) && other.shop.concept_group === image.shop.concept_group)) return;
    const oldGrid = selected.includes(id) ? $('#shortlist-grid') : $('#grid');
    const oldIds = [...oldGrid.children].map(card => card.dataset.imageId), indexInGrid = oldIds.indexOf(id);
    const nextFocus = oldIds[indexInGrid + 1] || oldIds[indexInGrid - 1];
    const scrollY = window.scrollY;
    const draft = draftFor(state.category), index = draft.ids.indexOf(id);
    if (index < 0) draft.ids.push(id); else draft.ids.splice(index, 1);
    curation.message = ''; renderCoverage(); renderGrid();
    (nextFocus ? document.querySelector('[data-curate-id="' + nextFocus + '"]') : $('#curation-save'))?.focus({ preventScroll: true });
    window.scrollTo({ top: scrollY });
  }
  async function saveCuration() {
    const category = state.category, draft = draftFor(category);
    if (curation.busy || draft.conflict || sameIds(draft.ids, draft.baseIds)) return;
    curation.busy = true; curation.message = ''; renderGrid();
    try {
      // A GET already in flight must settle before the save so stale data cannot replace its response.
      if (curation.request) await curation.request;
      if (draft.conflict) return;
      const payload = await curationRequest({ action: 'save', category_id: category, base_revision: draft.revision, artwork_ids: draft.ids.slice() });
      curation.drafts.delete(category); acceptCuration(payload); curation.message = t('curationSaved');
    } catch (error) { curation.message = error.message === 'offline' || error.name === 'TypeError' || error.name === 'TimeoutError' ? t('curationRetry') : error.message; }
    finally { curation.busy = false; renderGrid(); }
  }
  function resolveCuration(reapply) {
    const category = state.category, draft = curation.drafts.get(category); if (!draft) return;
    const latest = curation.categories[category]?.artwork_ids || baselineIds(category);
    curation.drafts.delete(category);
    if (reapply) {
      const removed = new Set(draft.baseIds.filter(id => !draft.ids.includes(id)));
      const added = draft.ids.filter(id => !draft.baseIds.includes(id));
      draftFor(category).ids = [...latest.filter(id => !removed.has(id)), ...added.filter(id => !latest.includes(id))];
    }
    curation.message = reapply ? t('curationReapplied') : t('curationReloaded');
    renderCoverage(); renderGrid(); $('#curation-save').focus();
  }

  function renderLikeTotal(element, id) {
    const total = likeTotals?.[id] ?? 0;
    element.hidden = !likeTotals;
    element.textContent = String(total);
    element.title = t('communityLikes', { n: total });
    element.setAttribute('aria-label', element.title);
  }
  function refreshLikeTotals() {
    if (!sharedHost || legacyHost || document.hidden || likeTotalsRequest ||
      (likeTotalsCheckedAt && Date.now() - likeTotalsCheckedAt < 2000)) return;
    likeTotalsCheckedAt = Date.now();
    likeTotalsRequest = (async () => {
      try {
        const response = await fetch('/api/like-totals', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
        if (!response.ok) return;
        const { counts } = await response.json();
        if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return;
        const entries = Object.entries(counts).filter(([id, n]) => /^[a-f0-9]{16}$/.test(id) && Number.isSafeInteger(n) && n >= 0);
        const changed = !likeTotals || entries.length !== Object.keys(likeTotals).length || entries.some(([id, n]) => likeTotals[id] !== n);
        likeTotals = Object.fromEntries(entries);
        document.querySelectorAll('[data-like-total]').forEach(element => renderLikeTotal(element, element.dataset.likeTotal));
        $('#candidate-order-control').hidden = state.favsOnly || $('#grid').hidden || !$('#grid').children.length;
        if (changed && candidateOrder === 'likes' && $('#viewer').hidden && $('#sheet').hidden) {
          const focused = document.activeElement?.dataset;
          renderGrid();
          if (focused?.heartId) $('[data-heart-id="' + focused.heartId + '"]')?.focus();
          if (focused?.openId) $('[data-open-id="' + focused.openId + '"]')?.focus();
        }
      } catch { /* Keep the last available totals and let personal likes sync independently. */ }
      finally { likeTotalsRequest = null; }
    })();
  }

  function renderProfile() {
    if (!$('#profile-save')) return;
    const active = !!reviewer?.profile;
    $('#btn-feedback').textContent = active ? reviewer.profile.name : t('feedback');
    $('#fb-title').textContent = t(active ? 'feedback' : 'startTitle');
    $('#fb-info').textContent = t(active ? 'accountInfo' : 'startInfo');
    $('#profile-save').textContent = t(active ? 'rename' : 'start');
    $('#profile-save').classList.toggle('primary', !active);
    $('#profile-save').disabled = reviewer?.status === 'loading' || reviewer?.actionBusy || (!active && reviewer?.status === 'saving');
    $('#profile-submit').hidden = !active;
    $('#profile-submit').textContent = t('finish');
    $('#profile-submit').disabled = !!reviewer?.actionBusy;
    $('#fb-cancel').textContent = t(active ? 'done' : 'cancel');
    const n = Object.values(state.votes.reactions).filter(r => r.love).length;
    $('#include-existing-row').hidden = active || !n;
    $('#include-existing-text').textContent = t('legacy', { n });
    $('#profile-submitted').textContent = reviewer?.profile?.submission ? t('submittedAt', { date: new Date(reviewer.profile.submission.submitted_at).toLocaleString(language) }) : '';
    $('#vote-status').hidden = false;
    $('#vote-status').textContent = !storageAvailable ? t('noStorage') : t(reviewer?.status || 'needsName', { name: reviewer?.profile?.name || '' });
    $('#fb-status').textContent = profileMessage;
  }
  function refreshFeedbackUI() {
    if (!state.data) return;
    if (document.activeElement === $('#v-note')) { updateHeartCount(); renderProfile(); return; }
    const imageId = !$('#viewer').hidden ? state.list[state.index]?.id : null;
    renderGrid(); updateHeartCount(); renderProfile();
    if (imageId) {
      const index = state.list.findIndex(image => image.id === imageId);
      if (index >= 0) open(index); else close();
    }
  }
  function setLanguage(value, explicit = false) {
    if (!['en', 'de'].includes(value) || (!explicit && languageExplicit)) return;
    const curationMessageKey = Object.keys(words.en).find(key => key.startsWith('curation') && [words.en[key], words.de[key]].includes(curation.message));
    language = value;
    if (curationMessageKey) curation.message = t(curationMessageKey);
    if (explicit) { languageExplicit = true; try { localStorage.setItem('lazart-language', value); } catch {} }
    document.documentElement.lang = value;
    document.querySelectorAll('[data-language]').forEach(button => { button.classList.toggle('on', button.dataset.language === value); button.setAttribute('aria-pressed', button.dataset.language === value); });
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    $('#fb-name').placeholder = t('nickname'); $('#fb-name').setAttribute('aria-label', t('nickname'));
    $('#v-note').placeholder = t('note');
    for (const [id, key] of [['close', 'close'], ['fb-close', 'close'], ['prev', 'prev'], ['next', 'next'], ['r-no', 'no']]) {
      $('#' + id).setAttribute('aria-label', t(key)); $('#' + id).title = t(key);
    }
    setTheme(theme);
    if (state.data) { renderCategories(); renderCoverage(); renderTags(); refreshFeedbackUI(); }
  }
  function showProfile(action = null) {
    profileReturnFocus = { element: document.activeElement, heartId: document.activeElement?.dataset?.heartId };
    pendingReaction = action; profileMessage = '';
    $('#fb-name').value = reviewer?.profile?.name || state.votes.name || '';
    $('#include-existing').checked = true;
    renderProfile(); $('#sheet').hidden = false; syncModalBackground();
    (reviewer?.profile ? $('#fb-close') : $('#fb-name')).focus();
  }
  function syncModalBackground() {
    const modalOpen = !$('#viewer').hidden || !$('#sheet').hidden;
    $('#gallery-content').inert = modalOpen; $('.top').inert = modalOpen;
    $('#viewer').inert = !$('#sheet').hidden;
    document.body.style.overflow = modalOpen ? 'hidden' : '';
  }
  function closeProfile() {
    pendingReaction = null; $('#sheet').hidden = true; syncModalBackground(); applyDeferredCatalogue();
    const target = profileReturnFocus?.heartId ? document.querySelector('[data-heart-id="' + profileReturnFocus.heartId + '"]') : profileReturnFocus?.element;
    (target?.isConnected ? target : !$('#viewer').hidden ? $('#r-love') : $('#btn-feedback')).focus();
  }
  function cleanReactions(reactions) {
    return Object.fromEntries(Object.entries(reactions).filter(([id, value]) => /^[a-f0-9]{16}$/.test(id) && value && typeof value === 'object').map(([id, value]) => [id, {
      ...(typeof value.love === 'boolean' ? {love: value.love} : {}), ...(typeof value.more === 'boolean' ? {more: value.more} : {}), ...(typeof value.no === 'boolean' ? {no: value.no} : {}), ...(typeof value.note === 'string' ? {note: value.note.slice(0, 10000)} : {})
    }]));
  }
  async function saveProfile() {
    const name = $('#fb-name').value.trim();
    if (!name) { profileMessage = t('nameRequired'); renderProfile(); return; }
    try {
      if (reviewer.profile) await reviewer.action('rename', { name });
      else {
        const initial = $('#include-existing').checked ? cleanReactions(state.votes.reactions) : {};
        await reviewer.create(name, initial);
      }
      const action = pendingReaction; profileMessage = ''; closeProfile();
      if (action) changeReaction(action.id, action.kind);
      else refreshFeedbackUI();
    } catch { profileMessage = t(reviewer?.profile ? 'saveError' : 'createError'); renderProfile(); }
  }
  async function finishSelection() {
    try { await reviewer.action('submit'); profileMessage = t('submitted'); }
    catch { profileMessage = t('saveError'); }
    renderProfile();
  }

  async function recoverLegacyHearts() {
    if (!legacyHost || state.votes.legacyPrintHeartsRecovered) return;
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
    $('#btn-favs').setAttribute('aria-label', t('showLikes', { n: loved.size }));
    $('#fb-count').textContent = t('likes', { n: loved.size });
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
    if (reviewer) renderProfile();
  }
  function reaction(id) { return state.votes.reactions[id] || (state.votes.reactions[id] = {}); }

  function allImages() {
    const images = new Map();
    for (const c of state.data.categories) for (const img of c.images) {
      if (images.has(img.id)) continue;
      const collection = img.collection || (img.run?.endsWith('-robert') ? 'robert' : 'studio');
      const originalCategory = state.data.collections?.find(g => g.slug === collection)?.categories?.find(category => category.slug === img.category);
      images.set(img.id, { categoryTitle: originalCategory?.title || c.title, collection, ...img });
    }
    return [...images.values()];
  }
  function categoryOptions() { return [...state.data.shop.categories, state.data.shop.holding_category]; }
  function categoryLabel(category) { return language === 'de' ? category.label_de || category.label : category.label; }
  function tagLabel(tag) { return language === 'de' ? tag.label_de || tag.label : tag.label; }
  function hasCategory(img, category = state.category) { return category === 'all' || img.shop.category_ids.includes(category); }
  function isPick(img, category = state.category) {
    if (!curationHost) return category === 'all' ? img.shop.pick_category_ids.length > 0 : img.shop.pick_category_ids.includes(category);
    return category === 'all' ? categoryOptions().some(c => selectionIds(c.slug).includes(img.id)) : selectionIds(category).includes(img.id);
  }
  function isSuggested(img, category = state.category) { return !curationHost && category !== 'all' && img.shop.suggested_category_ids.includes(category); }
  function conceptCount(images) { return new Set(images.map(img => img.shop.concept_group || img.id)).size; }
  function categoryTarget(category) { return category?.target || state.data.shop.target_per_category || 30; }
  function syncUrl() {
    const url = new URL(location.href);
    for (const key of ['collection', 'run', 'wave', 'lane', 'view']) url.searchParams.delete(key);
    if (state.category === 'all') url.searchParams.delete('category'); else url.searchParams.set('category', state.category);
    if (state.tags.size) url.searchParams.set('tags', [...state.tags].sort().join(',')); else url.searchParams.delete('tags');
    history.replaceState(null, '', url);
  }
  function chooseCategory(slug) {
    curation.message = '';
    state.category = slug; state.candidatesExpanded = false; state.favsOnly = false;
    $('#btn-favs').classList.toggle('on', false); $('#btn-favs').setAttribute('aria-pressed', false);
    $('#category-menu').open = false; $('#category-search').value = '';
    syncUrl(); renderCategories(); renderGrid(); $('#category-trigger').focus();
    window.scrollTo({ top: 0 });
  }
  function renderCategories() {
    const nav = $('#categories'); nav.innerHTML = '';
    const search = $('#category-search').value.trim().toLocaleLowerCase(language);
    const images = allImages();
    const options = [{ slug: 'all', label: t('allArtwork'), label_de: t('allArtwork') }, ...categoryOptions()];
    for (const category of options) {
      if (search && ![category.label, category.label_de, category.slug].join(' ').toLocaleLowerCase(language).includes(search)) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'category-option'; b.dataset.category = category.slug;
      b.setAttribute('aria-pressed', state.category === category.slug);
      const title = document.createElement('span'); title.textContent = categoryLabel(category);
      const count = document.createElement('span'); count.className = 'category-count'; count.textContent = images.filter(img => hasCategory(img, category.slug)).length;
      b.setAttribute('aria-label', categoryLabel(category) + ' · ' + t('images', { n: count.textContent }));
      b.appendChild(title); b.appendChild(count); b.onclick = () => chooseCategory(category.slug); nav.appendChild(b);
    }
    const selected = categoryOptions().find(c => c.slug === state.category);
    $('#category-label').textContent = selected ? categoryLabel(selected) : t('allArtwork');
    $('#category-trigger').setAttribute('aria-label', t('selectedCategory') + ': ' + $('#category-label').textContent);
    $('#category-no-results').hidden = nav.children.length > 0;
    $('#category-search').placeholder = t('searchCategories');
    $('#category-search').setAttribute('aria-label', t('searchCategories'));
  }
  function renderCoverage() {
    const grid = $('#coverage-grid'); grid.innerHTML = '';
    const images = allImages().sort((a, b) => (a.rank || 0) - (b.rank || 0));
    for (const category of state.data.shop.categories) {
      const candidates = images.filter(img => hasCategory(img, category.slug));
      const selected = candidates.filter(img => isPick(img, category.slug));
      const suggested = candidates.filter(img => isSuggested(img, category.slug));
      const firstChoice = state.data.shop.shortlists?.[category.slug]?.artwork_ids?.[0];
      const cover = candidates.find(img => img.id === firstChoice) || selected[0] || suggested[0] || candidates[0];
      const tile = document.createElement('button'); tile.type = 'button'; tile.className = 'coverage-tile';
      tile.dataset.category = category.slug; tile.onclick = () => chooseCategory(category.slug);
      const preview = document.createElement('span'); preview.className = 'coverage-preview';
      if (cover?.thumb) {
        const image = document.createElement('img');
        image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
        image.onerror = () => { image.hidden = true; };
        image.src = cover.thumb; preview.appendChild(image);
      }
      const label = document.createElement('span'); label.className = 'coverage-label';
      const title = document.createElement('strong'); title.textContent = categoryLabel(category);
      const count = document.createElement('span'); count.className = 'meta';
      count.textContent = t('chosenAll', { n: conceptCount([...selected, ...suggested]) });
      const total = document.createElement('span'); total.className = 'meta';
      total.textContent = t('candidateCount', { n: candidates.length });
      label.appendChild(title); label.appendChild(count); label.appendChild(total);
      tile.appendChild(preview); tile.appendChild(label); grid.appendChild(tile);
    }
  }
  function setTag(slug) {
    if (state.tags.has(slug)) state.tags.delete(slug); else state.tags.add(slug);
    syncUrl(); renderTags(); renderGrid();
  }
  function clearFilters() {
    state.tags.clear(); state.favsOnly = false;
    $('#btn-favs').classList.toggle('on', false); $('#btn-favs').setAttribute('aria-pressed', false);
    syncUrl(); renderTags(); renderGrid();
  }
  function renderTags() {
    const options = $('#tag-options'), active = $('#active-filters'); options.innerHTML = ''; active.innerHTML = '';
    for (const tag of state.data.shop.tags) {
      const selected = state.tags.has(tag.slug);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tag-option' + (selected ? ' on' : ''); b.dataset.tag = tag.slug;
      b.textContent = tagLabel(tag); b.setAttribute('aria-pressed', selected); b.onclick = () => setTag(tag.slug); options.appendChild(b);
      if (selected) {
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'active-tag'; remove.textContent = tagLabel(tag) + ' ×';
        remove.setAttribute('aria-label', t('removeFilter', { tag: tagLabel(tag) })); remove.onclick = () => setTag(tag.slug); active.appendChild(remove);
      }
    }
    active.hidden = !state.tags.size; $('#filter-count').textContent = state.tags.size ? ' ' + state.tags.size : '';
    $('#clear-filters').hidden = !state.tags.size;
  }
  function setTheme(value) {
    theme = value === 'light' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('lazart-theme', theme); } catch {}
    $('#btn-theme').textContent = t(theme === 'dark' ? 'light' : 'dark');
    $('#btn-theme').setAttribute('aria-label', t(theme === 'dark' ? 'switchLight' : 'switchDark'));
    $('#btn-theme').setAttribute('aria-pressed', theme === 'light');
  }
  function makeCard(img, index, status) {
    const card = document.createElement('article'); card.className = 'card' + (img.w > img.h ? ' wide' : ''); card.dataset.imageId = img.id; card.dataset.aspect = String((img.w || 1024) / (img.h || 1536));
    const art = document.createElement('button'); art.type = 'button'; art.className = 'artwork-open'; art.setAttribute('aria-label', img.title || img.key || 'Artwork');
    art.dataset.openId = img.id; art.onclick = () => open(index);
    const pic = document.createElement('img'); pic.loading = 'lazy'; pic.decoding = 'async'; pic.alt = '';
    pic.width = img.w || 1024; pic.height = img.h || 1536; pic.src = img.thumb;
    pic.onload = () => pic.classList.add('loaded');
    pic.onerror = () => { pic.classList.add('failed'); art.classList.add('image-failed'); art.setAttribute('data-error', t('imageUnavailable')); };
    art.appendChild(pic); card.appendChild(art);
    if (status && !curationHost) {
      const label = document.createElement('span'); label.className = 'shortlist-label' + (status === 'suggestedLabel' ? ' suggested' : '');
      label.textContent = t(status); card.appendChild(label);
    }
    const caption = document.createElement('div'); caption.className = 'card-caption';
    const title = document.createElement('button'); title.type = 'button'; title.className = 'card-title'; title.textContent = img.title || img.key || 'Artwork'; title.onclick = () => open(index);
    const heart = document.createElement('button'); heart.type = 'button'; heart.className = 'card-heart'; heart.dataset.heartId = img.id;
    const loved = !!state.votes.reactions[img.id]?.love;
    heart.textContent = loved ? '♥' : '♡'; heart.classList.toggle('on', loved); heart.setAttribute('aria-pressed', loved);
    heart.setAttribute('aria-label', t(loved ? 'unlike' : 'like') + ': ' + title.textContent);
    heart.onclick = () => {
      if (reviewer && !reviewer.profile) showProfile({ id: img.id, kind: 'love' });
      else changeReaction(img.id, 'love');
    };
    const reactions = document.createElement('div'); reactions.className = 'card-reactions';
    const total = document.createElement('span'); total.className = 'like-total'; total.dataset.likeTotal = img.id;
    renderLikeTotal(total, img.id);
    reactions.appendChild(heart); reactions.appendChild(total);
    caption.appendChild(title); caption.appendChild(reactions); card.appendChild(caption);
    if (curationHost && curation.open && curation.authenticated && !['all', 'uncategorized'].includes(state.category)) {
      const selected = selectionIds(state.category).includes(img.id);
      const control = document.createElement('button'); control.type = 'button'; control.className = 'curate-art ' + (selected ? 'remove' : 'add');
      control.dataset.curateId = img.id; control.textContent = selected ? t('curationRemove') : t('curationAdd');
      control.setAttribute('aria-label', (selected ? t('curationRemoveLabel') : t('curationAddLabel')) + title.textContent);
      const sameConcept = !selected && img.shop.concept_group && allImages().some(other => other.id !== img.id && selectionIds(state.category).includes(other.id) && other.shop.concept_group === img.shop.concept_group);
      control.disabled = curation.busy || !curation.loaded || sameConcept;
      if (sameConcept) { control.textContent = t('curationAlternate'); control.title = t('curationAlternateHelp'); control.setAttribute('aria-label', t('curationAlternateHelp') + ': ' + title.textContent); }
      control.onclick = () => toggleCurated(img.id); card.appendChild(control);
    }
    return card;
  }
  // Lay out consecutive artwork in proportional rows, retaining DOM and shortlist order.
  // Each row shares an image height; the final row keeps a modest natural size.
  function layoutArtwork(grid) {
    // clientWidth rounds fractional CSS pixels up, which can wrap the last card.
    const width = Math.floor((grid.getBoundingClientRect?.().width || grid.clientWidth) * 100) / 100 - .1;
    if (width <= 0 || grid.hidden) return;
    const gap = 16, columns = width > 1050 ? 4 : width > 650 ? 3 : 2;
    const cards = [...grid.children], targetRatio = columns * .95;
    let offset = 0, rowIndex = 0;
    grid.classList.add('justified');
    while (offset < cards.length) {
      const row = []; let sum = 0;
      while (offset < cards.length && row.length < columns && sum < targetRatio) {
        const card = cards[offset++]; row.push(card); sum += Number(card.dataset.aspect) || 1;
      }
      const available = width - gap * (row.length - 1);
      const height = offset === cards.length && row.length < columns ? Math.min(available / sum, width / columns / .85) : available / sum;
      for (const card of row) {
        card.style.width = Math.floor(height * (Number(card.dataset.aspect) || 1) * 100) / 100 + 'px';
        card.dataset.row = String(rowIndex);
      }
      rowIndex++;
    }
  }
  function layoutArtworkGrids() { layoutArtwork($('#shortlist-grid')); layoutArtwork($('#grid')); }
  function renderGrid() {
    const categoryImages = allImages().filter(img => hasCategory(img));
    const images = categoryImages.filter(img => [...state.tags].every(tag => img.shop.tag_ids.includes(tag)) && (!state.favsOnly || state.votes.reactions[img.id]?.love)).sort((a,b) => (a.rank || 0) - (b.rank || 0));
    const picks = images.filter(img => isPick(img));
    const suggestions = images.filter(img => !isPick(img) && isSuggested(img));
    const order = new Map((curationHost ? selectionIds(state.category) : state.data.shop.shortlists?.[state.category]?.artwork_ids || []).map((id, index) => [id, index]));
    const byShortlistOrder = (a, b) => (order.get(a.id) ?? order.size) - (order.get(b.id) ?? order.size);
    const shortlistImages = [...picks.sort(byShortlistOrder), ...suggestions.sort(byShortlistOrder)];
    const candidates = images.filter(img => !isPick(img) && !isSuggested(img));
    const split = (shortlistImages.length > 0 || (curation.open && curation.authenticated && !['all', 'uncategorized'].includes(state.category))) && !state.favsOnly;
    const expanded = !split || state.candidatesExpanded;
    const candidateImages = split ? candidates : images;
    if (!state.favsOnly && candidateOrder === 'likes' && likeTotals) {
      candidateImages.sort((a, b) => (likeTotals[b.id] || 0) - (likeTotals[a.id] || 0));
    }
    state.list = split ? [...shortlistImages, ...(expanded ? candidateImages : [])] : candidateImages;
    const grid = $('#grid'), shortlist = $('#shortlist-grid'); grid.innerHTML = ''; shortlist.innerHTML = '';
    state.list.forEach((img, index) => {
      const status = isPick(img) ? 'shortlistLabel' : isSuggested(img) ? 'suggestedLabel' : '';
      (split && status ? shortlist : grid).appendChild(makeCard(img, index, status));
    });
    $('#category-coverage').hidden = state.category !== 'all' || state.favsOnly || state.tags.size > 0;
    $('#shortlist-section').hidden = !split;
    const totalPicks = conceptCount(categoryImages.filter(img => isPick(img)));
    const shownPicks = conceptCount(picks);
    const category = categoryOptions().find(c => c.slug === state.category);
    const suggestedCount = conceptCount(suggestions);
    const selectedLabel = state.tags.size && shownPicks !== totalPicks ? t('shortlistFiltered', { n: shownPicks, total: totalPicks }) :
      t('chosenAll', { n: totalPicks });
    $('#shortlist-count').textContent = [selectedLabel, suggestedCount ? t('suggestedCount', { n: suggestedCount }) : ''].filter(Boolean).join(' · ');
    $('#candidates-section').hidden = split && !candidates.length;
    $('#candidates-title').textContent = t(split ? state.category === 'all' ? 'allCandidates' : 'moreCandidates' : 'candidates');
    $('#candidates-title').classList.toggle('sr-only', !split);
    $('#toggle-candidates').hidden = !split || !candidates.length;
    $('#toggle-candidates').textContent = t(expanded ? 'hideCandidates' : 'showCandidates', { n: candidates.length });
    $('#toggle-candidates').setAttribute('aria-expanded', expanded); grid.hidden = !expanded;
    $('#candidate-order-control').hidden = !likeTotals || !expanded || state.favsOnly || !candidateImages.length;
    $('#category-title').textContent = state.favsOnly ? t('myLikes') : category ? categoryLabel(category) : t('allArtwork');
    $('#category-description').textContent = state.favsOnly ? t('likes', { n: images.length }) : state.category === 'all' ? t('allDescription') : state.category === 'uncategorized' ? t('uncategorizedDescription') : categoryCopy[state.category]?.[language === 'de' ? 1 : 0] || '';
    $('#subtitle').textContent = t('images', { n: images.length });
    $('#empty').hidden = images.length > 0;
    const emptyCategory = categoryImages.length === 0;
    $('#empty-title').textContent = t(emptyCategory ? 'noArt' : state.favsOnly ? 'emptyLikes' : 'empty');
    $('#empty-description').textContent = t(emptyCategory ? 'noArtHelp' : 'emptyHelp');
    $('#empty-reset').textContent = t(emptyCategory ? 'exploreAll' : 'clearFilters');
    $('#empty-reset').onclick = () => { if (emptyCategory) chooseCategory('all'); else clearFilters(); };
    layoutArtworkGrids();
    renderCuration();
    $('#foot').textContent = t('images', { n: images.length }) + ' · LAZART · ' + t('built') + ' ' + (state.data.built_at || '').slice(0, 10);
  }

  function open(i) {
    state.index = i;
    const img = state.list[i];
    if (!img) return;
    const v = $('#viewer');
    const wasHidden = v.hidden;
    if (wasHidden) viewerReturnId = img.id;
    v.hidden = false; syncModalBackground();
    const big = $('#big');
    big.src = img.full; big.alt = img.title || '';
    $('#v-title').textContent = img.title || img.key;
    $('#v-meta').textContent = img.shop.category_ids.map(slug => categoryOptions().find(c => c.slug === slug)).filter(Boolean).map(categoryLabel).join(' · ');
    $('#v-prompt').textContent = [
      img.prompt, 'Key: ' + img.key, 'Run: ' + img.run,
      'Original category: ' + img.categoryTitle, img.lane ? 'Original lane: ' + img.lane : '',
      img.w + '×' + img.h, img.seed != null ? 'Seed: ' + img.seed : '', img.profile,
      img.score10 || img.score ? aiScore(img) + ' · ' + img.status + (img.editorial_recheck ? ' · editorial recheck' : '') : '',
      img.loras?.length ? 'Adapters: ' + img.loras.join(', ') : '',
      img.parent ? 'Parent: ' + img.parent : '',
      img.note ? 'AI note: ' + img.note : '',
      img.rating_note ? 'Ten-point review: ' + img.rating_note : '',
    ].filter(Boolean).join('\n\n');
    const r = state.votes.reactions[img.id] || {};
    renderPrintStatus(img);
    $('#r-no').classList.toggle('on', !!r.no);
    $('#r-no').setAttribute('aria-pressed', !!r.no);
    $('#v-note').value = r.note || '';
    $('#prev').disabled = i === 0; $('#next').disabled = i === state.list.length - 1;
    if (wasHidden) $('#close').focus();
    if (state.list[i + 1]) { const pre = new Image(); pre.src = state.list[i + 1].full; }
  }
  function close() {
    $('#viewer').hidden = true; syncModalBackground(); if (!applyDeferredCatalogue()) renderGrid();
    (document.querySelector('[data-open-id="' + viewerReturnId + '"]') || $('#category-trigger')).focus();
  }
  function step(d) { const n = state.index + d; if (n >= 0 && n < state.list.length) open(n); }
  function renderPrintStatus(img) {
    if (!img) return;
    const button = $('#r-love');
    const local = !!state.votes.reactions[img.id]?.love;
    button.classList.toggle('on', local);
    button.disabled = false;
    button.textContent = local ? '♥' : '♡';
    button.title = t(local ? 'unlike' : 'like');
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', local);
    const total = $('#v-like-total'); total.dataset.likeTotal = img.id;
    renderLikeTotal(total, img.id);
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
    if (reviewer && !reviewer.profile) { showProfile({ id: img.id, kind }); return; }
    changeReaction(img.id, kind);
  }
  function changeReaction(id, kind) {
    const viewerOpen = !$('#viewer').hidden, currentId = state.list[state.index]?.id;
    const r = reaction(id);
    r[kind] = !r[kind];
    if (kind === 'no' && r.no) r.love = false;
    if (kind === 'love' && r.love) r.no = false;
    saveVotes();
    const index = state.index;
    const patch = { [kind]: r[kind] };
    if (kind === 'no' && r.no) patch.love = false;
    if (kind === 'love' && r.love) patch.no = false;
    if (reviewer?.profile) reviewer.queue({ [id]: patch });
    renderGrid();
    if (viewerOpen) {
      if (!state.list.length) close();
      else { const current = state.list.findIndex(img => img.id === currentId); open(current < 0 ? Math.min(index, state.list.length - 1) : current); }
    } else (document.querySelector('[data-heart-id="' + id + '"]') || $('#btn-favs')).focus();
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
    profileMessage = t('backupSaved'); $('#fb-status').textContent = profileMessage;
  }
  async function restore(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const accepted = [state.votes.catalogue];
      if (state.votes.catalogue === 'lazart-moss') accepted.push('lazart-run-001');
      if (backup.version !== 1 || !accepted.includes(backup.catalogue) || !backup.reactions || typeof backup.reactions !== 'object') throw new Error('Choose feedback from this MOSS gallery.');
      if (reviewer?.profile && backup.name && backup.name.trim().toLowerCase() !== reviewer.profile.name.trim().toLowerCase()) throw new Error(t('wrongBackup'));
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
      if (reviewer?.profile) reviewer.queue(cleanReactions(state.votes.reactions));
      profileMessage = t('restored', { n: count }); $('#fb-status').textContent = profileMessage;
    } catch (e) { $('#fb-status').textContent = 'Could not restore votes. ' + e.message; }
  }
  function trapFocus(event, dialog) {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea,summary,a[href],[tabindex="0"]')].filter(el => !el.hidden && el.getClientRects().length && !el.closest('[hidden]'));
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  function resetBrowse() {
    state.category = 'all'; state.tags.clear(); state.favsOnly = false; state.candidatesExpanded = false;
    $('#btn-favs').classList.toggle('on', false); $('#btn-favs').setAttribute('aria-pressed', false);
    syncUrl(); renderCategories(); renderTags(); renderGrid();
  }
  function wire() {
    if (typeof ResizeObserver !== 'undefined') { const observer = new ResizeObserver(layoutArtworkGrids); observer.observe($('#shortlist-grid')); observer.observe($('#grid')); }
    else window.addEventListener('resize', layoutArtworkGrids);
    $('#btn-curate').onclick = () => { curation.open = !curation.open; renderGrid(); if (curation.open && !curation.authenticated) $('#curation-code').focus(); };
    $('#curation-login').onsubmit = async event => {
      event.preventDefault(); if (curation.busy) return;
      curation.busy = true; renderCuration();
      try { if (curation.request) await curation.request; acceptCuration(await curationRequest({ action: 'login', code: $('#curation-code').value })); curation.message = ''; }
      catch (error) { curation.message = error.message === 'offline' || error.name === 'TypeError' || error.name === 'TimeoutError' ? t('curationRetry') : error.message; }
      finally { $('#curation-code').value = ''; curation.busy = false; renderGrid(); if (curation.authenticated) $('#category-trigger').focus(); }
    };
    $('#curation-save').onclick = saveCuration;
    $('#curation-reload').onclick = () => resolveCuration(false);
    $('#curation-reapply').onclick = () => resolveCuration(true);
    $('#curation-logout').onclick = async () => {
      curation.busy = true; renderCuration();
      try { if (curation.request) await curation.request; acceptCuration(await curationRequest({ action: 'logout' })); curation.message = t('curationLocked'); }
      catch (error) { curation.message = error.message === 'offline' || error.name === 'TypeError' || error.name === 'TimeoutError' ? t('curationRetry') : error.message; }
      finally { curation.busy = false; renderGrid(); }
    };
    window.addEventListener('beforeunload', event => { if (dirtyDrafts().length) { event.preventDefault(); event.returnValue = ''; } });
    $('#close').onclick = close;
    $('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1);
    $('#r-love').onclick = () => toggle('love'); $('#r-no').onclick = () => toggle('no');
    $('#v-note').onchange = () => {
      const img = state.list[state.index]; if (!img) return;
      const note = $('#v-note').value.trim().slice(0, 10000); reaction(img.id).note = note; saveVotes();
      if (reviewer?.profile) reviewer.queue({ [img.id]: { note } }); else if (reviewer) showProfile();
    };
    $('#btn-home').onclick = () => { resetBrowse(); window.scrollTo({ top: 0 }); };
    $('#btn-theme').onclick = () => setTheme(theme === 'dark' ? 'light' : 'dark');
    $('#category-search').oninput = renderCategories;
    $('#category-menu').addEventListener('toggle', () => { if ($('#category-menu').open) $('#category-search').focus(); });
    $('#category-search').onkeydown = (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); $('#categories').querySelector('button')?.focus(); }
    };
    $('#categories').onkeydown = (event) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...$('#categories').querySelectorAll('button')]; if (!buttons.length) return;
      event.preventDefault(); const i = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (i + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    };
    document.addEventListener('click', (event) => { if ($('#category-menu').open && !$('#category-menu').contains(event.target)) $('#category-menu').open = false; });
    $('#btn-filters').onclick = () => {
      $('#filters-panel').hidden = !$('#filters-panel').hidden;
      $('#btn-filters').setAttribute('aria-expanded', !$('#filters-panel').hidden);
    };
    $('#clear-filters').onclick = clearFilters;
    $('#toggle-candidates').onclick = () => { state.candidatesExpanded = !state.candidatesExpanded; renderGrid(); $('#toggle-candidates').focus(); };
    $('#candidate-order').onchange = event => { candidateOrder = event.target.value; renderGrid(); };
    $('#btn-favs').onclick = () => {
      state.favsOnly = !state.favsOnly;
      $('#btn-favs').classList.toggle('on', state.favsOnly); $('#btn-favs').setAttribute('aria-pressed', state.favsOnly);
      if (state.favsOnly) { state.category = 'all'; state.tags.clear(); state.candidatesExpanded = true; syncUrl(); renderCategories(); renderTags(); }
      renderGrid();
    };
    $('#btn-feedback').onclick = () => showProfile();
    $('#fb-cancel').onclick = closeProfile; $('#fb-close').onclick = closeProfile;
    $('#profile-save').onclick = saveProfile; $('#profile-submit').onclick = finishSelection;
    $('#fb-name').onkeydown = event => { if (event.key === 'Enter' && reviewer) { event.preventDefault(); saveProfile(); } };
    document.querySelectorAll('[data-language]').forEach(button => { button.onclick = () => setLanguage(button.dataset.language, true); });
    $('#fb-export').onclick = download; $('#fb-import').onclick = () => $('#fb-file').click();
    $('#fb-file').onchange = () => { restore($('#fb-file').files[0]); $('#fb-file').value = ''; };
    document.addEventListener('keydown', event => {
      if (!$('#sheet').hidden) { if (event.key === 'Escape') closeProfile(); else trapFocus(event, $('#sheet')); return; }
      if ($('#category-menu').open && event.key === 'Escape') { $('#category-menu').open = false; $('#category-trigger').focus(); return; }
      if ($('#viewer').hidden) return;
      trapFocus(event, $('#viewer'));
      if (event.target.matches('textarea,input') && event.key !== 'Escape') return;
      if (event.key === 'Escape') close(); else if (event.key === 'ArrowRight') step(1); else if (event.key === 'ArrowLeft') step(-1);
      else if (event.key.toLowerCase() === 'l') toggle('love'); else if (event.key.toLowerCase() === 'x') toggle('no');
    });
    let x0 = null; const big = $('#big');
    big.addEventListener('touchstart', event => { x0 = event.touches[0].clientX; }, { passive: true });
    big.addEventListener('touchend', event => { if (x0 == null) return; const dx = event.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); }, { passive: true });
  }

  function aiScore(img) {
    return Number.isInteger(img.score10) && img.score10 >= 1 && img.score10 <= 10 ? 'AI ' + img.score10 + '/10' : img.score ? 'AI ' + img.score + '/5' : '';
  }
  function normalizeCatalogue(data) {
    data.collections ||= [{ slug: 'studio', title: 'Studio', categories: data.categories }];
    const fallbackLabels = ['Cult poster', 'Surrealism', 'Dream & Space Art', 'Schwarz Weiß', 'Abstrakt & Modern', 'Landscapes', 'Mensch Portrait', 'Pop Art', 'Kids', 'Animal Humor', 'Graphische Kunst / Illustrationen', 'Fotokunst', 'Expressionist Paintings', 'Erotisch', 'Floral / Botanical', 'Food & Drink'];
    data.shop ||= { version: 1, target_per_category: 30, categories: Object.keys(categoryCopy).map((slug, i) => ({ slug, label: fallbackLabels[i], target: 30 })), holding_category: { slug: 'uncategorized', label: 'Uncategorized', label_de: 'Noch nicht zugeordnet' }, tags: [], aliases: {} };
    data.shop.holding_category ||= { slug: 'uncategorized', label: 'Uncategorized', label_de: 'Noch nicht zugeordnet' };
    data.shop.tags ||= []; data.shop.aliases ||= {};
    const known = new Set([...data.shop.categories.map(c => c.slug), 'uncategorized']);
    const tags = new Set(data.shop.tags.map(tag => tag.slug));
    const shortlists = Object.entries(data.shop.shortlists || {}).filter(([id, entry]) =>
      id !== 'uncategorized' && known.has(id) && ['ai', 'owner'].includes(entry?.source) && Array.isArray(entry.artwork_ids));
    if (data.shop.shortlists) data.shop.shortlists = Object.fromEntries(shortlists);
    const shortlistMembers = new Map(shortlists.map(([id, entry]) => [id, new Set(entry.artwork_ids)]));
    for (const category of data.categories) for (const img of category.images) {
      const mapped = data.shop.aliases[img.category] || img.category;
      const shop = img.shop || {};
      const categoryIds = [...new Set((shop.category_ids || [mapped]).filter(id => known.has(id)))];
      const picks = data.shop.shortlists ? [] :
        [...new Set((shop.pick_category_ids || []).filter(id => categoryIds.includes(id) && id !== 'uncategorized'))];
      const suggestions = [];
      for (const [id, entry] of shortlists) {
        if (!categoryIds.includes(id) || !shortlistMembers.get(id).has(img.id)) continue;
        if (entry.source === 'owner') picks.push(id);
        else suggestions.push(id);
      }
      img.shop = {
        ...shop, category_ids: categoryIds.length ? categoryIds : ['uncategorized'],
        tag_ids: [...new Set((shop.tag_ids || []).filter(id => tags.has(id)))],
        pick_category_ids: picks,
        suggested_category_ids: suggestions,
      };
    }
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
        if (current?.shop && !data.shop) continue;
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
    renderCategories(); renderCoverage(); renderTags(); renderGrid(); updateHeartCount();
  }
  function applyDeferredCatalogue() {
    if (!deferredCatalogue || !$('#viewer').hidden || !$('#sheet').hidden) return false;
    const data = deferredCatalogue; deferredCatalogue = null; applyCatalogue(data); return true;
  }
  async function refreshCatalogue(awakened = false) {
    const elapsed = Date.now() - catalogueCheckedAt;
    if ((!sharedHost && !localPreview) || document.hidden || cataloguePromise || elapsed < (awakened ? localPreview ? 1000 : 15000 : localPreview ? 30000 : 120000)) return;
    catalogueCheckedAt = Date.now();
    cataloguePromise = (async() => {
      try {
        const current = deferredCatalogue || state.data;
        let data;
        if (localPreview) {
          const response = await fetch('data.json', { cache: 'no-store' });
          if (!response.ok) throw new Error('Local catalogue unavailable');
          data = normalizeCatalogue(await response.json());
        } else data = await publishedCatalogue(current);
        if (Date.parse(data.built_at) < Date.parse(current.built_at)) return;
        if (data === current || (!data._releaseDigest && data.built_at === current.built_at && data.count === current.count && data.shop?.curation_revision === current.shop?.curation_revision && JSON.stringify(data.progress) === JSON.stringify(current.progress))) return;
        deferredCatalogue = data; applyDeferredCatalogue();
      } catch { /* Retain the visible publication and all local reactions on transient failure. */ }
    })();
    try { await cataloguePromise; } finally { cataloguePromise = null; }
  }
  async function loadCatalogue() {
    let local = null;
    try {
      const r = await fetch('data.json');
      if (r.ok) local = await r.json();
    } catch { /* The public origin may still provide a valid catalogue. */ }
    if (sharedHost) {
      try {
        return await publishedCatalogue(local?.shop ? local : null);
      } catch { /* Use the last reviewed snapshot bundled with the gallery. */ }
    }
    if (!local) throw new Error('Gallery catalogue unavailable');
    return normalizeCatalogue(local);
  }

  loadCatalogue().then(async(data) => {
    state.data = normalizeCatalogue(data);
    loadVotes(data.catalogue);
    const url = new URL(location.href);
    const requested = url.searchParams.get('category');
    const category = data.shop.aliases[requested] || requested;
    state.category = !requested || requested === 'all' ? 'all' : categoryOptions().some(c => c.slug === category) ? category : 'uncategorized';
    const knownTags = new Set(data.shop.tags.map(tag => tag.slug));
    state.tags = new Set((url.searchParams.get('tags') || '').split(',').filter(tag => knownTags.has(tag)));
    wire(); syncUrl(); saveVotes(); setLanguage(language, languageExplicit);
    if (window.LazartReviewer && sharedHost) {
      reviewer = new window.LazartReviewer({
        endpoint: legacyHost ? '/.netlify/functions/reviewer-profiles' : '/api/reviewer-profiles',
        getVotes: () => state.votes, persist: saveVotes,
        onChange: () => { updateHeartCount(); renderProfile(); if (reviewer?.status === 'saved') refreshLikeTotals(); },
        onLanguage: value => setLanguage(value),
        backup: votes => { try { localStorage.setItem(state.key + ':before-online:' + Date.now(), JSON.stringify(votes)); } catch {} },
      });
      setLanguage(language, languageExplicit);
      if (!state.votes.cloudProfileId) await recoverLegacyHearts();
      await reviewer.refresh(); refreshFeedbackUI();
      window.addEventListener('online', () => reviewer.refresh());
    } else if (window.LazartReviewer) {
      setLanguage(language, languageExplicit);
      $('#profile-save').hidden = true; $('#profile-submit').hidden = true;
      $('#vote-status').hidden = false; $('#vote-status').textContent = t('cloudLink');
    }
    if (sharedHost || localPreview) {
      refreshLikeTotals(); refreshCuration();
      if (!reviewer) recoverLegacyHearts();
      const awaken = () => { if (!document.hidden) { refreshCatalogue(true); refreshLikeTotals(); refreshCuration(); if (reviewer) reviewer.refresh().then(refreshFeedbackUI); } };
      window.addEventListener('focus', awaken);
      document.addEventListener('visibilitychange', awaken);
      setInterval(() => { if (!document.hidden) { refreshCatalogue(); refreshLikeTotals(); refreshCuration(); if (reviewer && $('#viewer').hidden && $('#sheet').hidden) reviewer.refresh().then(refreshFeedbackUI); } }, 30000);
    }
  }).catch((e) => { $('#subtitle').textContent = 'Could not load data.json (' + e.message + ')'; });
})();
