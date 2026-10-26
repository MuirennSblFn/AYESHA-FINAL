/* =====================================================================
   Moteur des « codex » : Grimoire de la Brume, Factions…
   ---------------------------------------------------------------------
   Un codex = des fiches en deux parties (joueurs / MJ), chaque section
   pouvant être voilée ou révélée aux joueurs, une publication faite par la
   base, des observations proposées par les joueurs.
   creerDepot(cfg)  accès aux tables Supabase
   creerCodex(cfg)  le module (page) complet
   La configuration d'un codex est décrite dans js/modules/grimoire.js
   et js/modules/factions.js.
   ===================================================================== */
import { sb } from '../core/supabase.js';
import { $, $$, esc, para, today, fmtDate, toast, copyText, modal, confirmer, ORN, SIGIL } from '../core/ui.js';
import { personnage } from './personnage.js';
import { message } from './banque.js';

export const isEmpty = v => v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isEmpty));
/* Une section est-elle visible des joueurs ? Par défaut : partie joueurs oui, partie MJ non. */
export const visOf = (entree, s) => (entree && entree.vis && typeof entree.vis[s.id] === 'boolean') ? entree.vis[s.id] : !s.mj;
export function roman(n) { n = parseInt(n, 10); if (!n || n < 1) return '—'; if (n > 3999) return String(n); const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let r = ''; for (const [v, s] of m) { while (n >= v) { r += s; n -= v; } } return r; }
export const jauge = (v, max) => { const n = Math.max(0, Math.min(max, parseInt(v, 10) || 0)); return `<span class="jauge" title="${n} / ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`; };
const trier = (a, b) => (+a.numero || 1e9) - (+b.numero || 1e9) || String(a.nom).localeCompare(String(b.nom), 'fr');

/* ---------------------------------------------------------------------
   Données. cfg : { table, tablePublique, tableObs, meta: [clés d'en-tête], SJ, SM, repli? }
   --------------------------------------------------------------------- */
export function creerDepot(cfg) {
  const COLS = 'id, numero, publie, entree, profil, updated_at';
  /* Ligne de la table → fiche au format lecture { id, numero, publie, …en-tête, secJ, secM, j, m, entree, profil } */
  function versLecture(r, { commeJoueur = false } = {}) {
    const e = r.entree || {}, p = r.profil || {};
    const sJ = cfg.SJ.filter(s => !commeJoueur || visOf(e, s)), sM = cfg.SM.filter(s => !commeJoueur || visOf(e, s));
    const j = {}, m = {};
    sJ.forEach(s => s.f.forEach(f => { if (f.k in e) j[f.k] = e[f.k]; }));
    sM.forEach(s => s.f.forEach(f => { if (f.k in p) m[f.k] = p[f.k]; }));
    const out = { id: r.id, numero: r.numero, publie: !!r.publie, secJ: sJ.map(s => s.id), secM: sM.map(s => s.id), j, m, entree: e, profil: p, updated_at: r.updated_at };
    cfg.meta.forEach(k => { out[k] = e[k] ?? ''; });
    return out;
  }
  const depot = {
    versLecture,
    /* Version joueurs (tout le monde, connecté ou non) */
    async lirePublic() {
      const { data, error } = await sb.from(cfg.tablePublique).select('id, numero, data, updated_at');
      if (!error && data && (data.length || !cfg.repli)) return { entries: data.map(r => ({ ...r.data, updated_at: r.updated_at })).sort(trier), source: 'base' };
      if (cfg.repli) {   // base pas encore prête ou vide : ancien fichier
        const r = await fetch(cfg.repli, { cache: 'no-store' }).catch(() => null);
        if (r && r.ok) { const d = await r.json(); return { entries: (d.entries || []).sort(trier), source: 'fichier', publishedAt: d.publishedAt }; }
        if (!error) return { entries: [], source: 'base' };
      }
      throw error;
    },
    /* Exemplaire du MJ : toutes les fiches, brouillons et partie MJ compris */
    async lireMJ() {
      const { data, error } = await sb.from(cfg.table).select(COLS);
      if (error) throw error;
      return (data || []).map(r => versLecture(r)).sort(trier);
    },
    async enregistrer({ id, numero, publie, entree, profil }) {
      const champs = { numero: numero ?? null, publie: !!publie, entree, profil };
      const q = id ? sb.from(cfg.table).update(champs).eq('id', id) : sb.from(cfg.table).insert(champs);
      const { data, error } = await q.select(COLS).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Fiche introuvable : a-t-elle été effacée ?');
      return versLecture(data);
    },
    async importer(lignes) {
      const { error } = await sb.from(cfg.table).upsert(lignes, { onConflict: 'id' });
      if (error) throw error;
    },
    async supprimer(id) {
      const { error } = await sb.from(cfg.table).delete().eq('id', id);
      if (error) throw error;
    },
    obs: {
      async lister() {
        const { data, error } = await sb.from(cfg.tableObs).select('id, entree_id, owner, perso, date_obs, texte, created_at');
        if (error) return [];
        return (data || []).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      },
      async proposer({ entree_id, perso, date_obs, texte }) {
        const { data, error } = await sb.from(cfg.tableObs).insert({ entree_id, perso, date_obs: date_obs || null, texte }).select('id, entree_id, owner, perso, date_obs, texte, created_at').maybeSingle();
        if (error) throw error;
        return data;
      },
      async retirer(id) {
        const { error } = await sb.from(cfg.tableObs).delete().eq('id', id);
        if (error) throw error;
      },
    },
  };
  return depot;
}

/* ---------------------------------------------------------------------
   Lecture. Types de champs : text, area, radio, checks, list, rows, stats, jauge.
   Colonnes de rows : type 'date' | 'jauge' (avec max) | 'ref' (avec source).
   ctx = { refs: { source: { base, items: Map(id → nom) } }, STATS, EXTRA }
   --------------------------------------------------------------------- */
function readStats(d, ctx) {
  const s = d.stats || {}; if (isEmpty(s)) return '';
  const grid = `<div class="statgrid">${ctx.STATS.map(k => `<div><div class="k">${k}</div><div class="v">${esc(s[k] || '—')}</div></div>`).join('')}</div>`;
  const ex = ctx.EXTRA.filter(x => !isEmpty(s[x.k])).map(x => `<span>${x.l} <b>${esc(s[x.k])}</b>${x.hint ? ` <small>${x.hint}</small>` : ''}</span>`).join('');
  return `<div class="field">${grid}${ex ? `<div class="statline">${ex}</div>` : ''}</div>`;
}
function cellule(c, v, ctx) {
  if (c.type === 'jauge') return isEmpty(v) ? '' : `${jauge(v, c.max)} <small>${esc(v)}/${c.max}</small>`;
  if (c.type === 'ref') { const r = ctx.refs[c.source]; const nom = r && r.items.get(v); return nom ? `<a href="${r.base}${encodeURIComponent(v)}">${esc(nom)}</a>` : ''; }
  if (c.type === 'date') return esc(fmtDate(v));
  return esc(v);
}
function readField(f, d, ctx) {
  if (f.t === 'stats') return readStats(d, ctx);
  let v = d[f.k]; if (isEmpty(v)) return '';
  let b = '';
  if (f.t === 'text' || f.t === 'area') b = para(v);
  else if (f.t === 'radio') b = `<p>${esc(v)}</p>`;
  else if (f.t === 'jauge') b = `<p>${jauge(v, f.max)} <b>${esc(v)}</b> / ${f.max}</p>`;
  else if (f.t === 'checks') b = `<p class="tags">${v.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</p>`;
  else if (f.t === 'list') b = `<ul class="signs">${v.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  else if (f.t === 'rows' && f.notes) b = `<div class="notes">${v.map(n => `<div class="note"><div class="who">${n.date ? esc(fmtDate(n.date)) + ' — ' : ''}<b>${esc(n[f.notes.qui] || (f.notes.qui === 'perso' ? 'Anonyme' : ''))}</b>${f.notes.extra ? f.notes.extra(n) : ''}</div>${para(n[f.notes.texte])}</div>`).join('')}</div>`;
  else if (f.t === 'rows') {
    // une ligne dont une référence est introuvable (fiche non publiée…) n'est pas montrée
    v = v.filter(r => f.cols.every(c => c.type !== 'ref' || cellule(c, r[c.k], ctx)));
    if (!v.length) return '';
    b = `<div class="tablewrap"><table class="atk"><thead><tr>${f.cols.map(c => `<th>${esc(c.l)}</th>`).join('')}</tr></thead><tbody>${v.map(r => `<tr>${f.cols.map(c => `<td>${cellule(c, r[c.k], ctx)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  return `<div class="field">${f.l ? `<div class="flabel">${esc(f.l)}</div>` : ''}<div class="fval">${b}</div></div>`;
}
function readSection(s, num, d, ctx, o = {}) {
  const inner = s.f.map(f => readField(f, d || {}, ctx)).join('');
  return `<section class="sec${o.voilee ? ' veiled' : ''}"><h3><span class="rn">${roman(num)}.</span>${esc(s.t)}${s.s ? `<span class="sub">${esc(s.s)}</span>` : ''}${o.badge || ''}</h3>${inner || o.vide || '<p class="blank">Page blanche.</p>'}${o.extra || ''}</section>`;
}

/* ---------------------------------------------------------------------
   Édition
   --------------------------------------------------------------------- */
let rowSeq = 0;
const colsTpl = f => f.cols.map(c => c.w.includes('fr') ? 'minmax(0,' + c.w + ')' : c.w).join(' ') + ' 34px';
function listRow(k, val = '') { return `<div class="lrow"><input class="in li" id="f-${k}-${rowSeq++}" value="${esc(val)}" aria-label="Élément"><button type="button" class="x" data-del-row aria-label="Retirer">×</button></div>`; }
function rowsRow(f, r = {}, ctx) {
  const n = rowSeq++;
  return `<div class="rrow" style="grid-template-columns:${colsTpl(f)}">${f.cols.map(c => {
    const id = `f-${f.k}-${n}-${c.k}`, lab = `aria-label="${esc(c.l)}"`;
    if (c.long) return `<textarea class="ta" rows="2" data-c="${c.k}" id="${id}" ${lab} placeholder="${esc(c.l)}">${esc(r[c.k])}</textarea>`;
    if (c.type === 'ref') { const src = ctx.refs[c.source]; const items = src ? [...src.items].sort((a, b) => a[1].localeCompare(b[1], 'fr')) : [];
      return `<select class="in" data-c="${c.k}" id="${id}" ${lab}><option value="">— ${esc(c.l)} —</option>${items.map(([i, nom]) => `<option value="${esc(i)}" ${r[c.k] === i ? 'selected' : ''}>${esc(nom)}</option>`).join('')}</select>`; }
    if (c.type === 'jauge') return `<input class="in" type="number" min="0" max="${c.max}" data-c="${c.k}" id="${id}" ${lab} value="${esc(r[c.k])}" placeholder="0–${c.max}">`;
    return `<input class="in" ${c.type === 'date' ? 'type="date"' : ''} data-c="${c.k}" id="${id}" ${lab} value="${esc(r[c.k])}" placeholder="${esc(c.l)}">`;
  }).join('')}<button type="button" class="x" data-del-row aria-label="Retirer">×</button></div>`;
}
function editField(f, d, ctx) {
  const v = d[f.k], id = 'f-' + f.k;
  const lab = f.l ? `<label class="flabel" for="${id}">${esc(f.l)}</label>` : '';
  let c = '';
  switch (f.t) {
    case 'text': c = `<input class="in" id="${id}" name="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">`; break;
    case 'area': c = `<textarea class="ta" id="${id}" name="${f.k}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`; break;
    case 'jauge': c = `<input class="in num" type="number" min="0" max="${f.max}" id="${id}" name="${f.k}" value="${esc(v)}" placeholder="0–${f.max}">`; break;
    case 'radio': c = `<div class="choices" role="radiogroup">${['', ...f.o].map((o, j) => `<label class="choice"><input type="radio" id="${id}-${j}" name="${f.k}" value="${esc(o)}" ${(v || '') === o ? 'checked' : ''}><span>${o ? esc(o) : 'Non précisé'}</span></label>`).join('')}</div>`; break;
    case 'checks': c = `<div class="choices">${f.o.map((o, j) => `<label class="choice"><input type="checkbox" id="${id}-${j}" name="${f.k}" value="${esc(o)}" ${(v || []).includes(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`; break;
    case 'list': c = `<div data-list="${f.k}">${(v && v.length ? v : ['']).map(x => listRow(f.k, x)).join('')}</div><button type="button" class="add" data-add="${f.k}">＋ ${esc(f.add)}</button>`; break;
    case 'rows': c = `<div class="rrow colhead" style="grid-template-columns:${colsTpl(f)}">${f.cols.map(x => `<span>${esc(x.l)}</span>`).join('')}<span></span></div><div data-rows="${f.k}">${(v && v.length ? v : []).map(r => rowsRow(f, r, ctx)).join('')}</div><button type="button" class="add" data-add="${f.k}">＋ ${esc(f.add)}</button>`; break;
    case 'stats': { const s = v || {}; c = `<div class="statedit">${ctx.STATS.map(k => `<label for="f-s-${k}">${k}<input class="in num" id="f-s-${k}" data-stat="${k}" inputmode="numeric" value="${esc(s[k])}"></label>`).join('')}</div>
      <div class="statedit" style="margin-top:12px">${ctx.EXTRA.map(x => `<label for="f-s-${x.k}">${x.l}${x.hint ? ' (' + x.hint + ')' : ''}<input class="in num" id="f-s-${x.k}" data-stat="${x.k}" value="${esc(s[x.k])}"></label>`).join('')}</div>`; break; }
  }
  return `<div class="field${f.demi ? ' demi' : ''}">${lab}${c}</div>`;
}
function editSection(s, i, d, e, ctx) {
  return `<section class="sec" id="ed-${s.id}"><h3><span class="rn">${roman(i + 1)}.</span>${esc(s.t)}${s.s ? `<span class="sub">${esc(s.s)}</span>` : ''}<label class="choice vis"><input type="checkbox" id="v-${s.id}" data-vis-in="${s.id}" ${visOf(e, s) ? 'checked' : ''}><span>Visible des joueurs</span></label></h3>${s.f.map(f => editField(f, d, ctx)).join('')}</section>`;
}
function collect(form, fields) {
  const out = {};
  fields.forEach(f => {
    const k = f.k;
    if (f.t === 'text' || f.t === 'area' || f.t === 'jauge') out[k] = form.querySelector(`[name="${k}"]`).value.trim();
    else if (f.t === 'radio') out[k] = (form.querySelector(`input[name="${k}"]:checked`) || {}).value || '';
    else if (f.t === 'checks') out[k] = $$(`input[name="${k}"]:checked`, form).map(i => i.value);
    else if (f.t === 'list') out[k] = $$(`[data-list="${k}"] .li`, form).map(i => i.value.trim()).filter(Boolean);
    else if (f.t === 'rows') out[k] = $$(`[data-rows="${k}"] .rrow`, form).map(r => { const o = {}; f.cols.forEach(c => { o[c.k] = r.querySelector(`[data-c="${c.k}"]`).value.trim(); }); return o; }).filter(o => Object.values(o).some(Boolean));
    else if (f.t === 'stats') { const o = {}; $$('[data-stat]', form).forEach(i => { o[i.dataset.stat] = i.value.trim(); }); out[k] = o; }
  });
  return out;
}
const champsDe = sections => sections.flatMap(s => s.f);

/* Brouillons d'édition non scellés (gardés sur l'appareil) */
function brouillonsDe(id) {
  const CLE = `ayesha.${id}.brouillons`;
  return {
    tous() { try { return JSON.parse(localStorage.getItem(CLE) || '{}'); } catch (e) { return {}; } },
    lire(k) { return this.tous()[k] || null; },
    ecrire(k, v) { const t = this.tous(); if (v) t[k] = v; else delete t[k]; try { Object.keys(t).length ? localStorage.setItem(CLE, JSON.stringify(t)) : localStorage.removeItem(CLE); } catch (e) {} },
  };
}

/* ---------------------------------------------------------------------
   Le module (page). Voir js/modules/grimoire.js pour la liste des options.
   --------------------------------------------------------------------- */
export function creerCodex(cfg) {
  const { SJ, SM, depot, T } = cfg;
  const FIELDS = {}; [...SJ, ...SM, { f: cfg.entete }].forEach(s => s.f.forEach(f => { FIELDS[f.k] = f; }));
  const brouillons = brouillonsDe(cfg.id);
  const base = `#/${cfg.id}/`;

  return {
    id: cfg.id, titre: cfg.titre, acces: 'public', nav: cfg.nav, carte: cfg.carte,

    async mount(root, { auth, params, naviguer }) {
      root.classList.add('m-codex');
      const MJ = auth.isMJ;
      const st = { sel: null, mode: 'read', q: '', fam: '', vueJoueur: false, entries: [], byId: new Map(), obs: [], source: 'base', publishedAt: null, erreur: null, alerteMJ: null, sale: false, cible: null };
      const ctx = { refs: {}, STATS: cfg.STATS || [], EXTRA: cfg.EXTRA || [] };
      let nomPerso = '';
      const route = p => { st.mode = p[0] === 'nouvelle' ? 'new' : p[1] === 'reecrire' ? 'edit' : 'read'; st.sel = p[0] === 'nouvelle' ? null : (p[0] || null); st.cible = st.mode === 'edit' ? (p[2] || null) : null; };
      route(params);
      try { st.vueJoueur = localStorage.getItem(`ayesha.${cfg.id}.vueJoueur`) === '1'; } catch (e) {}
      root.innerHTML = `<div class="loading">${esc(T.ouverture)}</div>`;

      async function charger() {
        st.erreur = null; st.alerteMJ = null;
        if (MJ) {
          try { st.entries = await depot.lireMJ(); st.source = 'base'; }
          catch (e) { st.alerteMJ = `La base « ${cfg.titre} » n’est pas encore prête : relancez supabase/schema.sql dans Supabase. En attendant, voici la version des joueurs, en lecture seule.`; }
        }
        if (!MJ || st.alerteMJ) {
          try { const d = await depot.lirePublic(); st.entries = d.entries; st.source = d.source; st.publishedAt = d.publishedAt || null; }
          catch (e) { st.erreur = `${cfg.titre} : lecture momentanément impossible (${message(e)}).`; st.entries = []; }
        }
        st.byId = new Map(st.entries.map(e => [e.id, e]));
        st.obs = auth.user && st.source === 'base' ? await depot.obs.lister() : [];
        // Références vers d'autres codex (ou vers celui-ci) : id → nom
        ctx.refs = {};
        for (const [nom, src] of Object.entries(cfg.refs || {})) {
          let items = [];
          if (src.depot === 'soi') items = st.entries;
          else { try { items = MJ ? await src.depot.lireMJ() : (await src.depot.lirePublic()).entries; } catch (e) { try { items = (await src.depot.lirePublic()).entries; } catch (x) { items = []; } } }
          ctx.refs[nom] = { base: src.base, items: new Map(items.map(x => [x.id, x.nom || 'Sans nom'])) };
        }
      }
      await charger();
      const peutEditer = MJ && !st.alerteMJ;
      if (auth.user) personnage.charger().then(p => { nomPerso = p?.data?.nom || ''; const i = $('#o-perso', root); if (i && !i.value) i.value = nomPerso; }).catch(() => {});

      root.innerHTML = `<div class="layout">
        <aside class="index" aria-label="Sommaire">
          <h2>SOMMAIRE <span id="count"></span></h2>
          ${peutEditer ? `<button class="btn primary" data-act="new">＋ ${esc(T.nouvelle)}</button>` : ''}
          <input class="search" id="q" type="search" placeholder="Chercher un nom…" autocomplete="off">
          <div class="famfilter" id="famfilter"></div>
          <ul class="toc" id="toc"></ul>
          ${peutEditer && cfg.importSauvegarde ? `<div class="mjfoot"><button class="linkbtn" data-act="import">${esc(cfg.importSauvegarde.libelle)}</button><input type="file" id="impfile" accept=".json,application/json" hidden></div>` : ''}
        </aside>
        <div id="gmain"></div>
      </div>`;

      const obsDe = id => st.obs.filter(o => o.entree_id === id);
      const lien = (id, suite = '') => base + encodeURIComponent(id) + suite;

      function renderIndex() {
        const n = st.entries.length, pub = st.entries.filter(e => e.publie).length;
        $('#count', root).textContent = peutEditer ? `${n} · ${pub} publiée${pub > 1 ? 's' : ''}` : `${n} ${n > 1 ? T.plurielCourt : T.singulierCourt}`;
        const F = cfg.filtre;
        const fams = F.options.filter(f => st.entries.some(e => e[F.k] === f));
        $('#famfilter', root).innerHTML = fams.length < 2 ? '' : [`<button class="chip" data-fam="" aria-pressed="${st.fam === ''}">Toutes</button>`, ...fams.map(f => `<button class="chip" data-fam="${esc(f)}" aria-pressed="${st.fam === f}">${esc(f)}</button>`)].join('');
        const q = st.q.trim().toLowerCase();
        const rows = st.entries.filter(e => (!st.fam || e[F.k] === st.fam) && (!q || (String(e.nom) + ' ' + String(e.autresNoms || '')).toLowerCase().includes(q)));
        $('#toc', root).innerHTML = !rows.length ? `<li class="empty">${n ? 'Aucune fiche ne correspond.' : esc(T.sommaireVide)}</li>`
          : rows.map(e => { const no = peutEditer ? obsDe(e.id).length : 0; return `<li><a href="${lien(e.id)}" aria-current="${st.sel === e.id}"><span class="num">${roman(e.numero)}</span><span><span class="nm">${esc(e.nom || 'Sans nom')}</span><span class="fm">${esc(cfg.sousTitre(e))}${peutEditer ? (e.publie ? ' · <span class="pubmark">publiée</span>' : ' · brouillon') : ''}</span></span>${no ? `<span class="obsbadge" title="${no} observation${no > 1 ? 's' : ''} à lire">${no}</span>` : cfg.coin(e)}</a></li>`; }).join('');
      }

      /* ----- Vue joueurs ----- */
      const champsObs = () => `<div class="grid"><input class="in" id="o-perso" placeholder="Personnage" aria-label="Personnage" value="${esc(nomPerso)}"><input class="in" type="date" id="o-date" value="${today()}" aria-label="Date"><textarea class="ta" id="o-texte" rows="3" placeholder="Observation…" aria-label="Observation"></textarea></div><div class="err" id="o-err" hidden></div>`;
      function blocObservation(e) {
        if (st.source !== 'base') return `<form class="obs" id="obsform" data-mode="copie"><h3>Proposer une observation</h3><p>${esc(T.obsIntro)} Le texte est copié pour que vous l’envoyiez au MJ.</p>${champsObs()}<div style="margin-top:8px"><button class="btn primary" type="submit">Copier pour le MJ</button></div></form>`;
        if (!auth.user) return `<div class="obs"><h3>Proposer une observation</h3><p>Connectez-vous pour envoyer au MJ ce que votre personnage a découvert.</p><button class="btn discord" data-shell="login">Se connecter</button></div>`;
        const miennes = obsDe(e.id).filter(o => o.owner === auth.user.id);
        return `<form class="obs" id="obsform"><h3>Proposer une observation</h3><p>${esc(T.obsIntro)} Le MJ la lit et peut l’ajouter ${esc(T.obsDestination)}.</p>${champsObs()}
          <div style="margin-top:8px"><button class="btn primary" type="submit">Envoyer au MJ</button></div>
          ${miennes.length ? `<div class="obsliste"><div class="flabel">EN ATTENTE DE LECTURE PAR LE MJ</div>${miennes.map(o => `<div class="note"><div class="who">${o.date_obs ? esc(fmtDate(o.date_obs)) + ' — ' : ''}<b>${esc(o.perso || 'Anonyme')}</b> <button type="button" class="linkbtn" data-retirer-obs="${o.id}">Retirer</button></div>${para(o.texte)}</div>`).join('')}</div>` : ''}
        </form>`;
      }
      function enTete(e, outils) {
        const meta = [...cfg.metaAffiche(e), e.maj && `<span>Mis à jour le <b>${esc(fmtDate(e.maj))}</b></span>`].filter(Boolean).join('');
        return `<div class="eyebrow">${esc(T.eyebrow)} N° ${roman(e.numero)}</div>
          <h2 class="entry-name">${esc(e.nom || 'Sans nom')}</h2>
          ${e.autresNoms ? `<p class="aka">${esc(e.autresNoms)}</p>` : ''}
          <div class="meta">${meta}</div>
          ${cfg.sousEnTete ? cfg.sousEnTete(e) : ''}
          <div class="tools">${outils}</div>`;
      }
      function renderJoueur(e, apercu = false) {
        const secJ = SJ.filter(s => (e.secJ || []).includes(s.id)), secM = SM.filter(s => (e.secM || []).includes(s.id));
        return `${enTete(e, apercu ? '' : '<button class="btn ghost" data-act="copy">Copier la fiche</button><button class="btn ghost" data-act="to-obs">Proposer une observation</button>')}
          <div class="orn" style="margin-top:28px">${ORN}</div>
          <h2 class="part-title" style="margin-top:4px">I. ${esc(T.partieJ)}</h2>
          ${secJ.length ? secJ.map((s, i) => readSection(s, i + 1, e.j, ctx)).join('') : `<p class="blank" style="text-align:center">${esc(T.muet)}</p>`}
          ${secM.length ? `<div class="mj"><div class="orn">${ORN}</div><h2 class="part-title">II. ${esc(T.partieMRevelee)}</h2><p class="part-sub">ÉPROUVÉ SUR LE TERRAIN</p>${secM.map((s, i) => readSection(s, i + 1, e.m, ctx)).join('')}</div>` : ''}
          ${apercu ? '' : blocObservation(e)}`;
      }

      /* ----- Vue MJ ----- */
      const crayon = (e, s) => `<a class="ed-t" href="${lien(e.id, '/reecrire/' + s.id)}" title="Modifier « ${esc(s.t)} »" aria-label="Modifier ${esc(s.t)}">✎</a>`;
      const remplir = (e, s) => `<p class="blank"><a class="linkbtn" href="${lien(e.id, '/reecrire/' + s.id)}">Page blanche : remplir cette section</a></p>`;
      const badgeVis = (e, s) => { const on = visOf(e.entree, s); return `<button class="vis-t" data-vis="${s.id}" aria-pressed="${on}" title="Cliquer pour ${on ? 'voiler' : 'révéler'} cette section aux joueurs">${on ? 'Visible des joueurs' : 'Voilée'}</button>`; };
      const NR = cfg.noteRapide;
      function renderMJ(e) {
        const bascule = `<div class="vuebar" role="group" aria-label="Affichage"><button class="chip" data-vue="mj" aria-pressed="${!st.vueJoueur}">Vue MJ</button><button class="chip" data-vue="joueur" aria-pressed="${st.vueJoueur}">Ce que voient les joueurs</button></div>`;
        if (st.vueJoueur) {
          const vj = depot.versLecture({ id: e.id, numero: e.numero, publie: e.publie, entree: e.entree, profil: e.profil }, { commeJoueur: true });
          return `${bascule}${e.publie ? '' : '<div class="banner">Brouillon : les joueurs ne voient pas encore cette fiche. Voici ce qu’ils verront une fois publiée.</div>'}${renderJoueur(vj, true)}`;
        }
        const obs = obsDe(e.id);
        const noteForm = `<form class="addnote" id="addnote"><input class="in" type="date" id="n-date" value="${today()}" aria-label="Date"><input class="in" id="n-perso" placeholder="${esc(NR.quiPh)}" aria-label="${esc(NR.quiPh)}"><textarea class="ta" id="n-texte" placeholder="${esc(NR.textePh)}" aria-label="Note"></textarea><button class="btn" type="submit">${esc(NR.bouton)}</button><div class="err" id="n-err" hidden></div></form>`;
        return `${bascule}
          ${enTete(e, `<button class="btn pub" data-act="toggle-pub" aria-pressed="${e.publie}" title="Rendre cette fiche visible des joueurs, ou la repasser en brouillon">${e.publie ? '✦ Publiée aux joueurs' : 'Brouillon : non publiée'}</button>
            <a class="btn" href="${lien(e.id, '/reecrire')}">${esc(T.reecrire)}</a>
            <button class="btn ghost" data-act="copy">Copier pour Discord</button>`)}
          ${obs.length ? `<div class="obsmj"><h3>Observations des joueurs <small>${obs.length}</small></h3>${obs.map(o => `<div class="note"><div class="who">${o.date_obs ? esc(fmtDate(o.date_obs)) + ' — ' : ''}<b>${esc(o.perso || 'Anonyme')}</b></div>${para(o.texte)}
              <div class="row"><button class="mini" data-verser="${o.id}">Verser dans ${esc(T.obsDestinationCourte)}</button><button class="linkbtn" data-ecarter="${o.id}">Écarter</button></div></div>`).join('')}</div>` : ''}
          <div class="orn" style="margin-top:28px">${ORN}</div>
          <h2 class="part-title" style="margin-top:4px">I. ${esc(T.partieJ)}</h2><p class="part-sub">PARTIE JOUEURS</p>
          ${SJ.map((s, i) => readSection(s, i + 1, e.entree, ctx, { badge: crayon(e, s) + badgeVis(e, s), vide: remplir(e, s), voilee: !visOf(e.entree, s), extra: s.id === NR.section ? noteForm : '' })).join('')}
          <div class="mj"><div class="orn">${ORN}</div><h2 class="part-title">II. ${esc(T.partieM)}</h2><p class="part-sub">RÉSERVÉ AU MJ · RÉVÉLEZ SECTION PAR SECTION</p>
          ${SM.map((s, i) => readSection(s, i + 1, e.profil, ctx, { badge: crayon(e, s) + badgeVis(e, s), vide: remplir(e, s), voilee: !visOf(e.entree, s) })).join('')}</div>`;
      }

      /* ----- Formulaire ----- */
      const cleBr = () => st.mode === 'new' ? '__nouvelle' : st.sel;
      const prochainNumero = () => st.entries.reduce((m, e) => Math.max(m, parseInt(e.numero, 10) || 0), 0) + 1;
      function lireFormulaire(form, prec) {
        const vis = {}; $$('[data-vis-in]', form).forEach(i => { vis[i.dataset.visIn] = i.checked; });
        const entree = { nom: $('#f-nom', form).value.trim(), ...collect(form, cfg.entete), vis, maj: today(), createdAt: prec.createdAt || new Date().toISOString(), ...collect(form, champsDe(SJ)) };
        return { numero: parseInt($('#f-numero', form).value, 10) || null, publie: $('#f-publie', form).checked, entree, profil: collect(form, champsDe(SM)) };
      }
      function renderEdit() {
        const isNew = st.mode === 'new';
        const src0 = isNew ? { numero: prochainNumero(), publie: false, entree: { ...(cfg.defauts || {}) }, profil: {} } : st.byId.get(st.sel);
        const br = brouillons.lire(cleBr());
        const src = br || src0;
        const e = { ...src.entree }, p = { ...src.profil };
        return `<form class="sheet edit" id="editform" novalidate>
          ${br ? `<div class="banner">Brouillon non scellé du ${esc(fmtDate(br.le))} restauré. <button type="button" class="linkbtn" data-act="jeter-brouillon">Revenir à la version scellée</button></div>` : ''}
          <div class="eyebrow">${isNew ? esc(T.nouvelle.toUpperCase()) : 'RÉÉCRITURE'} · N° <input class="in num" id="f-numero" inputmode="numeric" value="${esc(src.numero ?? '')}" aria-label="Numéro"></div>
          <div class="field" style="margin-top:14px"><input class="in big" id="f-nom" value="${esc(e.nom)}" placeholder="${esc(T.nomPh)}" aria-label="${esc(T.nomPh)}"><div class="err" id="nom-err" hidden>Donnez au moins un nom.</div></div>
          <div class="entete">${cfg.entete.map(f => editField(f, e, ctx)).join('')}</div>
          <div class="field"><label class="choice"><input type="checkbox" id="f-publie" ${src.publie ? 'checked' : ''}><span>✦ ${esc(T.publier)}</span></label></div>
          <div class="orn" style="margin-top:24px">${ORN}</div>
          <h2 class="part-title" style="margin-top:4px">I. ${esc(T.partieJ)}</h2><p class="part-sub">PARTIE JOUEURS</p>
          ${SJ.map((s, i) => editSection(s, i, e, e, ctx)).join('')}
          <div class="mj"><div class="orn">${ORN}</div><h2 class="part-title">II. ${esc(T.partieM)}</h2><p class="part-sub">RÉSERVÉ AU MJ · COCHEZ CE QUE LES JOUEURS PEUVENT VOIR</p>
          ${SM.map((s, i) => editSection(s, i, p, e, ctx)).join('')}</div>
        </form>
        <div class="savebar" id="savebar"><button class="btn primary" data-act="save">${esc(T.sceller)}</button><button class="btn" data-act="cancel">Abandonner</button><span class="spacer"></span>${isNew ? '' : `<button class="btn danger" data-act="delete">${esc(T.effacer)}</button>`}<div class="err" id="save-err" hidden style="width:100%"></div></div>`;
      }
      function garderBrouillon() {
        const f = $('#editform', root); if (!f || !st.sale) return;
        const prec = st.mode === 'new' ? {} : (st.byId.get(st.sel)?.entree || {});
        brouillons.ecrire(cleBr(), { ...lireFormulaire(f, prec), le: new Date().toISOString() });
      }

      function renderFront() {
        const n = st.entries.length;
        if (peutEditer && !n) return `<div class="sheet front">${cfg.sceau || SIGIL}<h2>${esc(T.vierge)}</h2><p>${esc(T.viergeTexte)}</p>
          <div class="row center">${cfg.importFichier ? `<button class="btn primary" data-act="import-json">${esc(cfg.importFichier.libelle)}</button>` : ''}${cfg.importSauvegarde ? '<button class="btn" data-act="import">Importer une sauvegarde</button>' : ''}<button class="btn${cfg.importFichier ? '' : ' primary'}" data-act="new">${esc(T.premiere)}</button></div></div>`;
        return `<div class="sheet front">${cfg.sceau || SIGIL}
          <h2>${esc(n ? T.ouvert : T.scelle)}</h2>
          <p>${esc(n ? (peutEditer ? T.accueilMJ : T.accueilJoueur) : T.scelleTexte)}</p>
          ${n ? `<p class="count">${n} ${esc(n > 1 ? T.consignees : T.consignee)}</p>` : ''}</div>`;
      }
      function renderMain() {
        const e = st.sel && st.byId.get(st.sel);
        if (st.mode === 'edit' && (!e || !peutEditer)) st.mode = 'read';
        if (st.mode === 'new' && !peutEditer) st.mode = 'read';
        root.classList.toggle('reading', !!e || st.mode === 'new');
        root.classList.toggle('editing', st.mode !== 'read');
        const bandeau = (st.erreur ? `<div class="banner">${esc(st.erreur)}</div>` : '') + (st.alerteMJ ? `<div class="banner">${esc(st.alerteMJ)}</div>` : '');
        let corps;
        if (st.mode !== 'read') corps = `<a class="btn ghost back" href="#/${cfg.id}${st.sel ? '/' + encodeURIComponent(st.sel) : ''}">← Abandonner</a>${renderEdit()}`;
        else if (e) corps = `<a class="btn ghost back" href="#/${cfg.id}">← Sommaire</a><article class="sheet">${peutEditer ? renderMJ(e) : renderJoueur(e)}</article>`;
        else corps = renderFront();
        const pied = st.source === 'fichier' ? `<div class="foot"><span>${st.publishedAt ? 'Dernière mise en ligne le ' + esc(fmtDate(st.publishedAt)) : ''}</span></div>` : '';
        $('#gmain', root).innerHTML = bandeau + corps + pied;
        st.sale = false;
      }
      const render = () => { renderIndex(); renderMain(); };

      /* ----- Actions ----- */
      const remplacer = e => { const i = st.entries.findIndex(x => x.id === e.id); if (i >= 0) st.entries[i] = e; else st.entries.push(e); st.entries.sort(trier); st.byId = new Map(st.entries.map(x => [x.id, x])); const r = Object.values(cfg.refs || {}).find(x => x.depot === 'soi'); if (r) Object.values(ctx.refs).forEach(x => { if (x.base === r.base) x.items.set(e.id, e.nom || 'Sans nom'); }); };
      async function modifier(e, changes, msg) {
        try {
          const r = await depot.enregistrer({ id: e.id, numero: e.numero, publie: changes.publie ?? e.publie, entree: changes.entree || e.entree, profil: changes.profil || e.profil });
          remplacer(r); render(); if (msg) toast(msg); return true;
        } catch (x) { toast('Enregistrement impossible : ' + message(x)); return false; }
      }
      async function sceller() {
        const form = $('#editform', root), err = $('#save-err', root);
        const nom = $('#f-nom', form).value.trim();
        $('#nom-err', form).hidden = !!nom; if (!nom) { $('#f-nom', form).focus(); return; }
        const isNew = st.mode === 'new', prec = isNew ? null : st.byId.get(st.sel);
        const d = lireFormulaire(form, prec?.entree || {});
        if (!d.numero) d.numero = prochainNumero();
        if (prec) d.entree = { ...prec.entree, ...d.entree };   // garde les champs inconnus du formulaire
        const btn = $('[data-act="save"]', root); btn.disabled = true; btn.textContent = 'Scellement…';
        try {
          const r = await depot.enregistrer({ id: prec?.id, ...d });
          brouillons.ecrire(cleBr(), null); remplacer(r); st.sale = false;
          toast(T.scellee); naviguer(lien(r.id)); window.scrollTo(0, 0);
        } catch (x) { btn.disabled = false; btn.textContent = T.sceller; err.textContent = 'Enregistrement impossible : ' + message(x); err.hidden = false; }
      }
      async function importer(lignes, titre) {
        const existants = lignes.filter(l => st.byId.has(l.id));
        const nouveaux = lignes.length - existants.length;
        let choix = 'completer';
        if (existants.length) {
          choix = await new Promise(res => {
            let fait = false;
            const m = modal(`<h3>${esc(titre)}</h3><p>${lignes.length} fiche${lignes.length > 1 ? 's' : ''} dans le fichier : ${nouveaux} nouvelle${nouveaux > 1 ? 's' : ''}, ${existants.length} déjà présente${existants.length > 1 ? 's' : ''} (${existants.map(l => esc(l.entree.nom || l.id)).join(', ')}).</p>
              <p><b>Compléter</b> ajoute les nouvelles fiches et remplit les parties MJ encore vides, sans rien écraser. <b>Remplacer</b> reprend les fiches du fichier telles quelles.</p>
              <div class="row"><button class="btn primary" data-c="completer">Compléter</button><button class="btn" data-c="remplacer">Remplacer</button><button class="btn ghost" data-close>Annuler</button></div>`, { onClose: () => { if (!fait) res(null); } });
            $$('[data-c]', m).forEach(b => b.addEventListener('click', () => { fait = true; res(b.dataset.c); m.close(); }));
          });
          if (!choix) return;
        }
        const envoi = lignes.map(l => {
          const ex = st.byId.get(l.id); if (!ex || choix === 'remplacer') return l;
          return { id: ex.id, numero: ex.numero, publie: ex.publie, entree: ex.entree, profil: Object.keys(ex.profil || {}).every(k => k === 'updatedAt' || isEmpty(ex.profil[k])) ? (l.profil || {}) : ex.profil };
        });
        try { await depot.importer(envoi); await charger(); render(); toast(`Import terminé : ${lignes.length} fiche${lignes.length > 1 ? 's' : ''}`); }
        catch (x) { toast('Import impossible : ' + message(x)); }
      }
      function lireFichier(file) {
        const r = new FileReader();
        r.onload = () => {
          let d = null; try { d = JSON.parse(r.result); } catch (e) {}
          const lignes = d ? cfg.importSauvegarde.convertir(d) : null;
          if (!lignes) { modal(`<h3>Fichier non reconnu</h3><p>${esc(cfg.importSauvegarde.aide)}</p><div class="row"><button class="btn" data-close>Fermer</button></div>`); return; }
          importer(lignes, 'Importer ' + file.name);
        };
        r.readAsText(file);
      }

      root.addEventListener('click', async ev => {
        const t = ev.target.closest('[data-act],[data-fam],[data-vue],[data-vis],[data-add],[data-del-row],[data-verser],[data-ecarter],[data-retirer-obs]'); if (!t) return;
        if (t.dataset.fam !== undefined) { st.fam = t.dataset.fam; renderIndex(); return; }
        if (t.dataset.vue) { st.vueJoueur = t.dataset.vue === 'joueur'; try { localStorage.setItem(`ayesha.${cfg.id}.vueJoueur`, st.vueJoueur ? '1' : '0'); } catch (e) {} renderMain(); return; }
        if (t.dataset.add !== undefined) {
          const f = FIELDS[t.dataset.add]; const box = $(f.t === 'list' ? `[data-list="${f.k}"]` : `[data-rows="${f.k}"]`, root);
          box.insertAdjacentHTML('beforeend', f.t === 'list' ? listRow(f.k) : rowsRow(f, {}, ctx)); const i = box.lastElementChild.querySelector('input,textarea,select'); if (i) i.focus(); st.sale = true; return;
        }
        if (t.hasAttribute('data-del-row')) { t.parentElement.remove(); st.sale = true; return; }
        const e = st.sel && st.byId.get(st.sel);
        if (t.dataset.vis && e) {
          const s = [...SJ, ...SM].find(x => x.id === t.dataset.vis);
          const on = !visOf(e.entree, s);
          modifier(e, { entree: { ...e.entree, vis: { ...(e.entree.vis || {}), [s.id]: on } } }, on ? 'Section visible des joueurs' : 'Section voilée'); return;
        }
        if (t.dataset.verser && e) {
          const o = st.obs.find(x => x.id === t.dataset.verser); if (!o) return;
          const liste = [...(e.entree[NR.champ] || []), NR.ligne(o.date_obs || '', o.perso || '', o.texte)];
          if (await modifier(e, { entree: { ...e.entree, [NR.champ]: liste } })) {
            try { await depot.obs.retirer(o.id); } catch (x) {}
            st.obs = st.obs.filter(x => x.id !== o.id); render(); toast(`Observation versée dans ${T.obsDestinationCourte}`);
          }
          return;
        }
        if (t.dataset.ecarter || t.dataset.retirerObs) {
          const id = t.dataset.ecarter || t.dataset.retirerObs;
          try { await depot.obs.retirer(id); st.obs = st.obs.filter(x => x.id !== id); render(); toast(t.dataset.ecarter ? 'Observation écartée' : 'Observation retirée'); }
          catch (x) { toast('Impossible : ' + message(x)); }
          return;
        }
        switch (t.dataset.act) {
          case 'new': naviguer(base + 'nouvelle'); break;
          case 'cancel': brouillons.ecrire(cleBr(), null); st.sale = false; naviguer(st.sel ? lien(st.sel) : '#/' + cfg.id); break;
          case 'jeter-brouillon': brouillons.ecrire(cleBr(), null); renderMain(); break;
          case 'save': sceller(); break;
          case 'delete':
            if (e && await confirmer({ titre: T.effacer + ' ?', texte: `« ${esc(e.nom)} » et sa partie MJ seront effacés définitivement, pour vous comme pour les joueurs.`, oui: 'Effacer', danger: true })) {
              try { await depot.supprimer(e.id); brouillons.ecrire(cleBr(), null); st.entries = st.entries.filter(x => x.id !== e.id); st.byId.delete(e.id); st.sale = false; toast(T.effacee); naviguer('#/' + cfg.id); }
              catch (x) { toast('Effacement impossible : ' + message(x)); }
            }
            break;
          case 'toggle-pub': if (e) modifier(e, { publie: !e.publie }, !e.publie ? 'Fiche publiée : les joueurs la voient' : 'Fiche repassée en brouillon'); break;
          case 'copy': if (e) copyText(texteDiscord(peutEditer ? depot.versLecture({ id: e.id, numero: e.numero, entree: e.entree, profil: e.profil }, { commeJoueur: true }) : e), 'Fiche copiée', 'Fiche à copier'); break;
          case 'to-obs': { const f = $('#obsform', root); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); const ta = $('#o-texte', root); if (ta) ta.focus({ preventScroll: true }); } break; }
          case 'import': $('#impfile', root).click(); break;
          case 'import-json':
            try { const lignes = await cfg.importFichier.charger(); await importer(lignes, cfg.importFichier.libelle); }
            catch (x) { toast('Import impossible : ' + message(x)); }
            break;
        }
      });
      function texteDiscord(e) {
        const L = [`**${e.nom || 'Sans nom'}** · ${cfg.titre}, ${T.eyebrow.toLowerCase()} n° ${roman(e.numero)}`];
        if (e.autresNoms) L.push(`*${e.autresNoms}*`);
        L.push(cfg.ligneDiscord(e));
        SJ.filter(s => (e.secJ || []).includes(s.id)).forEach(s => {
          const parts = [];
          s.f.forEach(f => {
            const v = e.j[f.k]; if (isEmpty(v)) return;
            let t;
            if (!Array.isArray(v)) t = v;
            else if (f.t === 'checks') t = v.join(', ');
            else if (f.t === 'rows') t = v.map(r => '• ' + f.cols.map(c => c.type === 'ref' ? (ctx.refs[c.source]?.items.get(r[c.k]) || '') : c.type === 'date' ? fmtDate(r[c.k]) : r[c.k]).filter(Boolean).join(' — ')).join('\n');
            else t = v.map(x => '• ' + x).join('\n');
            parts.push(f.l ? `${f.l} : ${t}` : t);
          });
          if (parts.length) L.push('', `__${s.t}__`, ...parts);
        });
        return L.join('\n');
      }
      root.addEventListener('change', ev => { if (ev.target.id === 'impfile') { const f = ev.target.files[0]; if (f) lireFichier(f); ev.target.value = ''; } });
      root.addEventListener('submit', async ev => {
        ev.preventDefault();
        const e = st.sel && st.byId.get(st.sel); if (!e) return;
        if (ev.target.id === 'addnote') {
          const texte = $('#n-texte', root).value.trim(), er = $('#n-err', root);
          if (!texte) { er.textContent = 'Écrivez la note avant de la consigner.'; er.hidden = false; return; }
          const liste = [...(e.entree[NR.champ] || []), NR.ligne($('#n-date', root).value, $('#n-perso', root).value.trim(), texte)];
          modifier(e, { entree: { ...e.entree, [NR.champ]: liste } }, 'Note consignée');
          return;
        }
        if (ev.target.id === 'obsform') {
          const texte = $('#o-texte', root).value.trim(), err = $('#o-err', root);
          if (!texte) { err.textContent = "Écrivez l'observation avant de l'envoyer."; err.hidden = false; return; }
          err.hidden = true;
          const perso = $('#o-perso', root).value.trim(), date = $('#o-date', root).value;
          if (ev.target.dataset.mode === 'copie') { copyText(`📜 Observation — ${e.nom} (n° ${roman(e.numero)})\n${date ? fmtDate(date) + ' — ' : ''}${perso || 'Anonyme'} : ${texte}`, 'Observation copiée : envoyez-la au MJ', 'Observation à envoyer au MJ'); return; }
          const b = ev.target.querySelector('button[type=submit]'); b.disabled = true;
          try { const o = await depot.obs.proposer({ entree_id: e.id, perso, date_obs: date, texte }); st.obs.push(o); renderMain(); toast('Observation envoyée au MJ'); }
          catch (x) { b.disabled = false; err.textContent = 'Envoi impossible : ' + message(x); err.hidden = false; }
        }
      });
      root.addEventListener('input', ev => {
        if (ev.target.id === 'q') { st.q = ev.target.value; renderIndex(); return; }
        if (ev.target.closest('#editform')) st.sale = true;
      });
      root.addEventListener('change', ev => { if (ev.target.closest('#editform')) st.sale = true; });
      const avantDepart = ev => { if (st.sale) { garderBrouillon(); ev.preventDefault(); ev.returnValue = ''; } };
      window.addEventListener('beforeunload', avantDepart);

      function allerCible() {
        const c = st.cible && $('#ed-' + st.cible, root);
        if (!c) { window.scrollTo(0, 0); return; }
        c.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80);
        const champ = c.querySelector('input:not([type=checkbox]):not([type=radio]),textarea,select'); if (champ) champ.focus({ preventScroll: true });
        c.classList.add('cible'); setTimeout(() => c.classList.remove('cible'), 1600);
      }
      render(); requestAnimationFrame(allerCible);
      if (st.sel && !st.byId.has(st.sel) && !st.erreur) toast('Cette fiche n’existe pas ou plus.');

      return {
        update(p) { garderBrouillon(); route(p); render(); allerCible(); },
        unmount() { garderBrouillon(); window.removeEventListener('beforeunload', avantDepart); },
      };
    },
  };
}
