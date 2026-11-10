/* Browser-owned online reviewer profiles. Nicknames are labels, never credentials. */
(function () {
  'use strict';
  class ReviewerClient {
    constructor(options) {
      Object.assign(this, options);
      this.endpoint = options.endpoint || '/api/reviewer-profiles';
      this.profile = this.getVotes().cloudProfile || null; this.status = 'loading'; this.busy = null; this.actionBusy = false;
    }
    changed() { this.onChange?.(this); }
    async request(body) {
      const response = await fetch(this.endpoint, {
        cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000),
        ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'Could not save.'); error.status = response.status; error.profile = data.profile; throw error; }
      if (data.version !== 1) throw new Error('Profile service unavailable.');
      return data;
    }
    apply(profile) {
      if (this.profile?.id === profile.id && profile.revision < this.profile.revision) return;
      const votes = this.getVotes();
      if (votes.cloudProfileId !== profile.id) {
        this.backup?.(votes);
        votes.pendingChanges = {}; delete votes.inFlight; delete votes.pendingAction;
      }
      this.profile = profile;
      votes.cloudProfile = { id: profile.id, name: profile.name, revision: profile.revision, submission: profile.submission };
      votes.cloudProfileId = profile.id; votes.name = profile.name;
      votes.reactions = structuredClone(profile.reactions);
      votes.pendingChanges ||= {};
      for (const [id, patch] of Object.entries(votes.pendingChanges)) Object.assign(votes.reactions[id] ||= {}, patch);
      this.persist();
    }
    async refresh() {
      if (this.busy || this.actionBusy) return;
      try {
        const data = await this.request(); this.onLanguage?.(data.language);
        if (data.profile) {
          this.apply(data.profile); this.status = 'saved';
          if (Object.keys(this.getVotes().pendingChanges || {}).length || this.getVotes().inFlight) await this.flush();
        } else { this.profile = null; delete this.getVotes().cloudProfile; this.persist(); this.status = 'needsName'; }
      } catch { this.status = 'offline'; }
      this.changed();
    }
    async create(name, reactions) {
      this.status = 'saving'; this.changed();
      try {
        // Recover a cookie from a response that may have been lost before making another profile.
        const current = await this.request();
        const data = current.profile ? current : await this.request({ action: 'create', name, reactions });
        this.apply(data.profile); this.status = 'saved'; this.changed(); return this.profile;
      } catch (error) { this.status = 'offline'; this.changed(); throw error; }
    }
    queue(changes) {
      const votes = this.getVotes(); votes.pendingChanges ||= {};
      for (const [id, patch] of Object.entries(changes)) Object.assign(votes.pendingChanges[id] ||= {}, patch);
      this.persist(); this.status = 'saving'; this.changed();
      void this.flush();
    }
    async flush() {
      if (this.busy) return this.busy;
      if (!this.profile || this.actionBusy) return false;
      this.busy = this.flushLoop();
      try { return await this.busy; } finally { this.busy = null; this.changed(); }
    }
    async flushLoop() {
      for (let attempt = 0; attempt < 20; attempt++) {
        const votes = this.getVotes();
        if (!votes.inFlight && !Object.keys(votes.pendingChanges || {}).length) { this.status = 'saved'; return true; }
        votes.inFlight ||= { action: 'update', operation_id: crypto.randomUUID(), base_revision: this.profile.revision, changes: structuredClone(votes.pendingChanges) };
        const operation = structuredClone(votes.inFlight); this.persist();
        try {
          const data = await this.request(operation);
          // New choices made during the request remain queued, including explicit unlikes.
          for (const [id, patch] of Object.entries(operation.changes)) {
            for (const [field, value] of Object.entries(patch)) if (votes.pendingChanges[id]?.[field] === value) delete votes.pendingChanges[id][field];
            if (votes.pendingChanges[id] && !Object.keys(votes.pendingChanges[id]).length) delete votes.pendingChanges[id];
          }
          delete votes.inFlight; this.apply(data.profile);
        } catch (error) {
          if (error.status === 409 && error.profile) { delete votes.inFlight; this.apply(error.profile); continue; }
          this.status = 'offline'; this.persist(); return false;
        }
      }
      this.status = 'offline'; return false;
    }
    async action(action, fields = {}) {
      if (this.actionBusy) return false;
      if (!await this.flush()) throw new Error('Your latest choices have not synced yet.');
      this.actionBusy = true; this.status = 'saving'; this.changed();
      try {
        const votes = this.getVotes();
        if (!votes.pendingAction || votes.pendingAction.action !== action || (action === 'rename' && votes.pendingAction.name !== fields.name)) {
          votes.pendingAction = { action, ...fields, operation_id: crypto.randomUUID(), base_revision: this.profile.revision }; this.persist();
        }
        const desired = structuredClone(votes.reactions);
        let data = await this.request(votes.pendingAction);
        const canonical = value => value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
        // Recover a lost acknowledgement first; finishing newer edits needs a new snapshot.
        if (action === 'submit' && canonical(data.profile.submission?.reactions) !== canonical(desired)) {
          votes.pendingAction = { action, operation_id: crypto.randomUUID(), base_revision: data.profile.revision }; this.persist();
          data = await this.request(votes.pendingAction);
        }
        delete votes.pendingAction; this.apply(data.profile); this.status = 'saved'; return true;
      } catch (error) {
        if (error.status === 409 && error.profile) { delete this.getVotes().pendingAction; this.apply(error.profile); }
        this.status = 'offline'; throw error;
      } finally { this.actionBusy = false; this.changed(); if (Object.keys(this.getVotes().pendingChanges || {}).length) void this.flush(); }
    }
  }
  window.LazartReviewer = ReviewerClient;
})();
