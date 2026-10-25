/* =====================================================================
   Module Grimoire de la Brume
   ---------------------------------------------------------------------
   Joueurs (et visiteurs) : lisent les entrées publiées, la partie que le MJ
   a rendue visible ; proposent des observations au MJ.
   MJ : l'exemplaire complet (ex-« Grimoire du Maître ») sur la même page :
   nouvelle entrée, réécriture, profil technique, visibilité section par
   section, publication, Notes des Gris, observations des joueurs, import.
   Adresses : #/grimoire/<id>   #/grimoire/<id>/reecrire   #/grimoire/nouvelle
   ===================================================================== */
import { $, $$, esc, para, today, fmtDate, toast, copyText, modal, confirmer, ORN, SIGIL } from '../core/ui.js';
import { personnage } from '../shared/personnage.js';
import { message } from '../shared/banque.js';
import { FAMILLES, CONNAISSANCE, STATS, EXTRA, SECTIONS_J, SECTIONS_MJ, FIELDS, isEmpty, visOf, versLecture, depuisPublication, grimoire, observations } from '../shared/grimoire.js';

function roman(n) { n = parseInt(n, 10); if (!n || n < 1) return '—'; if (n > 3999) return String(n); const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let r = ''; for (const [v, s] of m) { while (n >= v) { r += s; n -= v; } } return r; }
const pips = c => { const i = CONNAISSANCE.indexOf(c); return `<span class="kpips" title="Connaissance : ${esc(c || 'non précisée')}">${CONNAISSANCE.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span>`; };
const famLabel = e => e.famille === 'Autre' ? (e.familleAutre || 'Autre') : (e.famille || '');

/* ---------- Lecture ---------- */
function readStats(d) {
  const s = d.stats || {}; if (isEmpty(s)) return '';
  const grid = `<div class="statgrid">${STATS.map(k => `<div><div class="k">${k}</div><div class="v">${esc(s[k] || '—')}</div></div>`).join('')}</div>`;
  const ex = EXTRA.filter(x => !isEmpty(s[x.k])).map(x => `<span>${x.l} <b>${esc(s[x.k])}</b>${x.hint ? ` <small>${x.hint}</small>` : ''}</span>`).join('');
  return `<div class="field">${grid}${ex ? `<div class="statline">${ex}</div>` : ''}</div>`;
}
function readField(f, d) {
  if (f.t === 'stats') return readStats(d);
  const v = d[f.k]; if (isEmpty(v)) return '';
  let b = '';
  if (f.t === 'text' || f.t === 'area') b = para(v);
  else if (f.t === 'radio') b = `<p>${esc(v)}</p>`;
  else if (f.t === 'checks') b = `<p class="tags">${v.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</p>`;
  else if (f.t === 'list') b = `<ul class="signs">${v.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  else if (f.t === 'rows' && f.k === 'notes') b = `<div class="notes">${v.map(n => `<div class="note"><div class="who">${n.date ? esc(fmtDate(n.date)) + ' — ' : ''}<b>${esc(n.perso || 'Anonyme')}</b></div>${para(n.texte)}</div>`).join('')}</div>`;
  else if (f.t === 'rows') b = `<div class="tablewrap"><table class="atk"><thead><tr>${f.cols.map(c => `<th>${esc(c.l)}</th>`).join('')}</tr></thead><tbody>${v.map(r => `<tr>${f.cols.map(c => `<td>${esc(r[c.k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="field">${f.l ? `<div class="flabel">${esc(f.l)}</div>` : ''}<div class="fval">${b}</div></div>`;
}
function readSection(s, num, d, o = {}) {
  const inner = s.f.map(f => readField(f, d || {})).join('');
  return `<section class="sec${o.voilee ? ' veiled' : ''}"><h3><span class="rn">${roman(num)}.</span>${esc(s.t)}${s.s ? `<span class="sub">${esc(s.s)}</span>` : ''}${o.badge || ''}</h3>${inner || o.vide || '<p class="blank">Page blanche.</p>'}${o.extra || ''}</section>`;
}
function texteDiscord(e) {
  const j = e.j || {};
  const L = [`**${e.nom || 'Sans nom'}** · Grimoire de la Brume, entrée n° ${roman(e.numero)}`];
  if (e.autresNoms) L.push(`*${e.autresNoms}*`);
  L.push(`Famille : ${famLabel(e) || '—'} · Connaissance : ${e.connaissance || '—'}`);
  SECTIONS_J.filter(s => (e.secJ || []).includes(s.id)).forEach(s => {
    const parts = [];
    s.f.forEach(f => {
      const v = j[f.k]; if (isEmpty(v)) return;
      const t = Array.isArray(v) ? (f.t === 'checks' ? v.join(', ') : f.k === 'notes' ? v.map(n => `> ${n.date ? fmtDate(n.date) + ' — ' : ''}${n.perso || 'Anonyme'} : ${n.texte}`).join('\n') : v.map(x => '• ' + x).join('\n')) : v;
      parts.push(f.l ? `${f.l} : ${t}` : t);
    });
    if (parts.length) L.push('', `__${s.t}__`, ...parts);
  });
  return L.join('\n');
}

/* ---------- Édition (formulaire repris du Grimoire du Maître) ---------- */
let rowSeq = 0;
const colsTpl = f => f.cols.map(c => c.w.includes('fr') ? 'minmax(0,' + c.w + ')' : c.w).join(' ') + ' 34px';
function listRow(k, val = '') { return `<div class="lrow"><input class="in li" id="f-${k}-${rowSeq++}" value="${esc(val)}" aria-label="Élément"><button type="button" class="x" data-del-row aria-label="Retirer">×</button></div>`; }
function rowsRow(f, r = {}) {
  const n = rowSeq++;
  return `<div class="rrow" style="grid-template-columns:${colsTpl(f)}">${f.cols.map(c => c.k === 'texte' || c.k === 'effets'
    ? `<textarea class="ta" rows="2" data-c="${c.k}" id="f-${f.k}-${n}-${c.k}" aria-label="${esc(c.l)}" placeholder="${esc(c.l)}">${esc(r[c.k])}</textarea>`
    : `<input class="in" ${c.type ? `type="${c.type}"` : ''} data-c="${c.k}" id="f-${f.k}-${n}-${c.k}" value="${esc(r[c.k])}" aria-label="${esc(c.l)}" placeholder="${esc(c.l)}">`).join('')}<button type="button" class="x" data-del-row aria-label="Retirer">×</button></div>`;
}
function editField(f, d) {
  const v = d[f.k], id = 'f-' + f.k;
  const lab = f.l ? `<label class="flabel" for="${id}">${esc(f.l)}</label>` : '';
  let c = '';
  switch (f.t) {
    case 'text': c = `<input class="in" id="${id}" name="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">`; break;
    case 'area': c = `<textarea class="ta" id="${id}" name="${f.k}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`; break;
    case 'radio': c = `<div class="choices" role="radiogroup">${['', ...f.o].map((o, j) => `<label class="choice"><input type="radio" id="${id}-${j}" name="${f.k}" value="${esc(o)}" ${(v || '') === o ? 'checked' : ''}><span>${o ? esc(o) : 'Non précisé'}</span></label>`).join('')}</div>`; break;
    case 'checks': c = `<div class="choices">${f.o.map((o, j) => `<label class="choice"><input type="checkbox" id="${id}-${j}" name="${f.k}" value="${esc(o)}" ${(v || []).includes(o) ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`; break;
    case 'list': c = `<div data-list="${f.k}">${(v && v.length ? v : ['']).map(x => listRow(f.k, x)).join('')}</div><button type="button" class="add" data-add="${f.k}">＋ ${esc(f.add)}</button>`; break;
    case 'rows': c = `<div class="rrow colhead" style="grid-template-columns:${colsTpl(f)}">${f.cols.map(x => `<span>${esc(x.l)}</span>`).join('')}<span></span></div><div data-rows="${f.k}">${(v && v.length ? v : []).map(r => rowsRow(f, r)).join('')}</div><button type="button" class="add" data-add="${f.k}">＋ ${esc(f.add)}</button>`; break;
    case 'stats': { const s = v || {}; c = `<div class="statedit">${STATS.map(k => `<label for="f-s-${k}">${k}<input class="in num" id="f-s-${k}" data-stat="${k}" inputmode="numeric" value="${esc(s[k])}"></label>`).join('')}</div>
      <div class="statedit" style="margin-top:12px">${EXTRA.map(x => `<label for="f-s-${x.k}">${x.l}${x.hint ? ' (' + x.hint + ')' : ''}<input class="in num" id="f-s-${x.k}" data-stat="${x.k}" value="${esc(s[x.k])}"></label>`).join('')}</div>`; break; }
  }
  return `<div class="field">${lab}${c}</div>`;
}
function editSection(s, i, d, e) {
  return `<section class="sec" id="ed-${s.id}"><h3><span class="rn">${roman(i + 1)}.</span>${esc(s.t)}${s.s ? `<span class="sub">${esc(s.s)}</span>` : ''}<label class="choice vis"><input type="checkbox" id="v-${s.id}" data-vis-in="${s.id}" ${visOf(e, s) ? 'checked' : ''}><span>Visible des joueurs</span></label></h3>${s.f.map(f => editField(f, d)).join('')}</section>`;
}
function collect(form, sections) {
  const out = {};
  sections.forEach(s => s.f.forEach(f => {
    const k = f.k;
    if (f.t === 'text' || f.t === 'area') out[k] = form.querySelector(`[name="${k}"]`).value.trim();
    else if (f.t === 'radio') out[k] = (form.querySelector(`input[name="${k}"]:checked`) || {}).value || '';
    else if (f.t === 'checks') out[k] = $$(`input[name="${k}"]:checked`, form).map(i => i.value);
    else if (f.t === 'list') out[k] = $$(`[data-list="${k}"] .li`, form).map(i => i.value.trim()).filter(Boolean);
    else if (f.t === 'rows') out[k] = $$(`[data-rows="${k}"] .rrow`, form).map(r => { const o = {}; f.cols.forEach(c => { o[c.k] = r.querySelector(`[data-c="${c.k}"]`).value.trim(); }); return o; }).filter(o => Object.values(o).some(Boolean));
    else if (f.t === 'stats') { const o = {}; $$('[data-stat]', form).forEach(i => { o[i.dataset.stat] = i.value.trim(); }); out[k] = o; }
  }));
  return out;
}
/* Ce que contient le formulaire, sous la forme d'une ligne de la table */
function lireFormulaire(form, prec) {
  const vis = {}; $$('[data-vis-in]', form).forEach(i => { vis[i.dataset.visIn] = i.checked; });
  const entree = {
    nom: $('#f-nom', form).value.trim(), autresNoms: $('#f-autresNoms', form).value.trim(),
    famille: (form.querySelector('input[name="famille"]:checked') || {}).value || '',
    familleAutre: $('#f-familleAutre', form).value.trim(),
    connaissance: (form.querySelector('input[name="connaissance"]:checked') || {}).value || '',
    redacteur: $('#f-redacteur', form).value.trim(),
    vis, maj: today(), createdAt: prec.createdAt || new Date().toISOString(),
    ...collect(form, SECTIONS_J),
  };
  return { numero: parseInt($('#f-numero', form).value, 10) || null, publie: $('#f-publie', form).checked, entree, profil: collect(form, SECTIONS_MJ) };
}

/* Brouillons d'édition non scellés (gardés sur l'appareil) */
const CLE_BR = 'ayesha.grimoire.brouillons';
const brouillons = {
  tous() { try { return JSON.parse(localStorage.getItem(CLE_BR) || '{}'); } catch (e) { return {}; } },
  lire(k) { return this.tous()[k] || null; },
  ecrire(k, v) { const t = this.tous(); if (v) t[k] = v; else delete t[k]; try { Object.keys(t).length ? localStorage.setItem(CLE_BR, JSON.stringify(t)) : localStorage.removeItem(CLE_BR); } catch (e) {} },
};

export default {
  id: 'grimoire',
  titre: 'Grimoire de la Brume',
  acces: 'public',
  nav: { label: 'Grimoire', ordre: 10 },
  carte: { titre: 'Grimoire de la Brume', texte: 'Le bestiaire des Gris : ce que l’on sait des entités de la Brume.' },

  async mount(root, { auth, params, naviguer }) {
    const MJ = auth.isMJ;
    const st = { sel: null, mode: 'read', q: '', fam: '', vueJoueur: false, entries: [], byId: new Map(), obs: [], source: 'base', publishedAt: null, erreur: null, alerteMJ: null, sale: false };
    let nomPerso = '';
    const route = p => { st.mode = p[0] === 'nouvelle' ? 'new' : p[1] === 'reecrire' ? 'edit' : 'read'; st.sel = p[0] === 'nouvelle' ? null : (p[0] || null); st.cible = st.mode === 'edit' ? (p[2] || null) : null; };
    route(params);
    try { st.vueJoueur = localStorage.getItem('ayesha.grimoire.vueJoueur') === '1'; } catch (e) {}
    root.innerHTML = '<div class="loading">Ouverture du grimoire…</div>';

    async function charger() {
      st.erreur = null; st.alerteMJ = null;
      if (MJ) {
        try { st.entries = await grimoire.lireMJ(); st.source = 'base'; }
        catch (e) { st.alerteMJ = 'La base du Grimoire n’est pas encore prête : relancez supabase/schema.sql dans Supabase. En attendant, voici la version des joueurs, en lecture seule.'; }
      }
      if (!MJ || st.alerteMJ) {
        try { const d = await grimoire.lirePublic(); st.entries = d.entries; st.source = d.source; st.publishedAt = d.publishedAt || null; }
        catch (e) { st.erreur = 'Le grimoire est momentanément illisible : ' + message(e); st.entries = []; }
      }
      st.byId = new Map(st.entries.map(e => [e.id, e]));
      st.obs = auth.user && st.source === 'base' ? await observations.lister() : [];
    }
    await charger();
    const peutEditer = MJ && !st.alerteMJ;
    if (auth.user) personnage.charger().then(p => { nomPerso = p?.data?.nom || ''; const i = $('#o-perso', root); if (i && !i.value) i.value = nomPerso; }).catch(() => {});

    root.innerHTML = `<div class="layout">
      <aside class="index" aria-label="Sommaire du grimoire">
        <h2>SOMMAIRE <span id="count"></span></h2>
        ${peutEditer ? '<button class="btn primary" data-act="new">＋ Nouvelle entrée</button>' : ''}
        <input class="search" id="q" type="search" placeholder="Chercher un nom…" autocomplete="off">
        <div class="famfilter" id="famfilter"></div>
        <ul class="toc" id="toc"></ul>
        ${peutEditer ? `<div class="mjfoot"><button class="linkbtn" data-act="import">Importer une sauvegarde du Grimoire du Maître</button><input type="file" id="impfile" accept=".json,application/json" hidden></div>` : ''}
      </aside>
      <div id="gmain"></div>
    </div>`;

    const obsDe = id => st.obs.filter(o => o.entree_id === id);

    function renderIndex() {
      const n = st.entries.length, pub = st.entries.filter(e => e.publie).length;
      $('#count', root).textContent = peutEditer ? `${n} · ${pub} publiée${pub > 1 ? 's' : ''}` : n + (n > 1 ? ' entrées' : ' entrée');
      const fams = FAMILLES.filter(f => st.entries.some(e => e.famille === f));
      $('#famfilter', root).innerHTML = fams.length < 2 ? '' : [`<button class="chip" data-fam="" aria-pressed="${st.fam === ''}">Toutes</button>`, ...fams.map(f => `<button class="chip" data-fam="${esc(f)}" aria-pressed="${st.fam === f}">${esc(f)}</button>`)].join('');
      const q = st.q.trim().toLowerCase();
      const rows = st.entries.filter(e => (!st.fam || e.famille === st.fam) && (!q || (String(e.nom) + ' ' + String(e.autresNoms || '')).toLowerCase().includes(q)));
      $('#toc', root).innerHTML = !rows.length ? `<li class="empty">${n ? 'Aucune entrée ne correspond.' : "Aucune entité consignée pour l'instant."}</li>`
        : rows.map(e => { const no = peutEditer ? obsDe(e.id).length : 0; return `<li><a href="#/grimoire/${encodeURIComponent(e.id)}" aria-current="${st.sel === e.id}"><span class="num">${roman(e.numero)}</span><span><span class="nm">${esc(e.nom || 'Sans nom')}</span><span class="fm">${esc(famLabel(e))}${peutEditer ? (e.publie ? ' · <span class="pubmark">publiée</span>' : ' · brouillon') : ''}</span></span>${no ? `<span class="obsbadge" title="${no} observation${no > 1 ? 's' : ''} à lire">${no}</span>` : pips(e.connaissance)}</a></li>`; }).join('');
    }

    /* ----- Vue joueurs d'une entrée ----- */
    function blocObservation(e) {
      if (st.source !== 'base') return `<form class="obs" id="obsform" data-mode="copie"><h3>Proposer une observation</h3><p>Ce que votre personnage a vu, appris ou subi face à cette entité. Le texte est copié pour que vous l’envoyiez au MJ.</p>
        <div class="grid"><input class="in" id="o-perso" placeholder="Personnage" aria-label="Personnage" value="${esc(nomPerso)}"><input class="in" type="date" id="o-date" value="${today()}" aria-label="Date"><textarea class="ta" id="o-texte" rows="3" placeholder="Observation…" aria-label="Observation"></textarea></div>
        <div class="err" id="o-err" hidden></div><div style="margin-top:8px"><button class="btn primary" type="submit">Copier pour le MJ</button></div></form>`;
      if (!auth.user) return `<div class="obs"><h3>Proposer une observation</h3><p>Connectez-vous pour envoyer au MJ ce que votre personnage a découvert sur cette entité.</p><button class="btn discord" data-shell="login">Se connecter</button></div>`;
      const miennes = obsDe(e.id).filter(o => o.owner === auth.user.id);
      return `<form class="obs" id="obsform"><h3>Proposer une observation</h3>
        <p>Ce que votre personnage a vu, appris ou subi face à cette entité. Le MJ la lit et peut l’ajouter aux Notes des Gris.</p>
        <div class="grid"><input class="in" id="o-perso" placeholder="Personnage" aria-label="Personnage" value="${esc(nomPerso)}"><input class="in" type="date" id="o-date" value="${today()}" aria-label="Date"><textarea class="ta" id="o-texte" rows="3" placeholder="Observation…" aria-label="Observation"></textarea></div>
        <div class="err" id="o-err" hidden></div>
        <div style="margin-top:8px"><button class="btn primary" type="submit">Envoyer au MJ</button></div>
        ${miennes.length ? `<div class="obsliste"><div class="flabel">EN ATTENTE DE LECTURE PAR LE MJ</div>${miennes.map(o => `<div class="note"><div class="who">${o.date_obs ? esc(fmtDate(o.date_obs)) + ' — ' : ''}<b>${esc(o.perso || 'Anonyme')}</b> <button type="button" class="linkbtn" data-retirer-obs="${o.id}">Retirer</button></div>${para(o.texte)}</div>`).join('')}</div>` : ''}
      </form>`;
    }
    function enTeteEntree(e, outils) {
      const meta = [
        famLabel(e) && `<span>Famille <b>${esc(famLabel(e))}</b></span>`,
        `<span>Connaissance ${pips(e.connaissance)} <b>${esc(e.connaissance || 'non précisée')}</b></span>`,
        e.redacteur && `<span>Rédigé par <b>${esc(e.redacteur)}</b></span>`,
        e.maj && `<span>Mis à jour le <b>${esc(fmtDate(e.maj))}</b></span>`,
      ].filter(Boolean).join('');
      return `<div class="eyebrow">ENTRÉE N° ${roman(e.numero)}</div>
        <h2 class="entry-name">${esc(e.nom || 'Sans nom')}</h2>
        ${e.autresNoms ? `<p class="aka">${esc(e.autresNoms)}</p>` : ''}
        <div class="meta">${meta}</div>
        <div class="tools">${outils}</div>`;
    }
    function renderJoueur(e, apercu = false) {
      const secJ = SECTIONS_J.filter(s => (e.secJ || []).includes(s.id));
      const secM = SECTIONS_MJ.filter(s => (e.secM || []).includes(s.id));
      return `${enTeteEntree(e, apercu ? '' : '<button class="btn ghost" data-act="copy">Copier la fiche</button><button class="btn ghost" data-act="to-obs">Proposer une observation</button>')}
        <div class="orn" style="margin-top:28px">${ORN}</div>
        <h2 class="part-title" style="margin-top:4px">I. Ce que dit le Grimoire</h2>
        ${secJ.length ? secJ.map((s, i) => readSection(s, i + 1, e.j)).join('') : '<p class="blank" style="text-align:center">Le Grimoire est encore muet sur cette entité.</p>'}
        ${secM.length ? `<div class="mj"><div class="orn">${ORN}</div><h2 class="part-title">II. Ce que le Maître a révélé</h2><p class="part-sub">ÉPROUVÉ SUR LE TERRAIN</p>${secM.map((s, i) => readSection(s, i + 1, e.m)).join('')}</div>` : ''}
        ${apercu ? '' : blocObservation(e)}`;
    }

    /* ----- Vue MJ d'une entrée ----- */
    const crayon = (e, s) => `<a class="ed-t" href="#/grimoire/${encodeURIComponent(e.id)}/reecrire/${s.id}" title="Modifier « ${esc(s.t)} »" aria-label="Modifier ${esc(s.t)}">✎</a>`;
    const remplir = (e, s) => `<p class="blank"><a class="linkbtn" href="#/grimoire/${encodeURIComponent(e.id)}/reecrire/${s.id}">Page blanche : remplir cette section</a></p>`;
    const badgeVis = (e, s) => { const on = visOf(e.entree, s); return `<button class="vis-t" data-vis="${s.id}" aria-pressed="${on}" title="Cliquer pour ${on ? 'voiler' : 'révéler'} cette section aux joueurs">${on ? 'Visible des joueurs' : 'Voilée'}</button>`; };
    function renderMJ(e) {
      const bascule = `<div class="vuebar" role="group" aria-label="Affichage"><button class="chip" data-vue="mj" aria-pressed="${!st.vueJoueur}">Vue MJ</button><button class="chip" data-vue="joueur" aria-pressed="${st.vueJoueur}">Ce que voient les joueurs</button></div>`;
      if (st.vueJoueur) {
        const vj = versLecture({ id: e.id, numero: e.numero, publie: e.publie, entree: e.entree, profil: e.profil }, { commeJoueur: true });
        return `${bascule}${e.publie ? '' : '<div class="banner">Brouillon : les joueurs ne voient pas encore cette entrée. Voici ce qu’ils verront une fois publiée.</div>'}${renderJoueur(vj, true)}`;
      }
      const obs = obsDe(e.id);
      const noteForm = `<form class="addnote" id="addnote"><input class="in" type="date" id="n-date" value="${today()}" aria-label="Date"><input class="in" id="n-perso" placeholder="Personnage" aria-label="Personnage"><textarea class="ta" id="n-texte" placeholder="Ce que la table a découvert…" aria-label="Note"></textarea><button class="btn" type="submit">Consigner la note</button><div class="err" id="n-err" hidden></div></form>`;
      return `${bascule}
        ${enTeteEntree(e, `<button class="btn pub" data-act="toggle-pub" aria-pressed="${e.publie}" title="Rendre cette entité visible des joueurs, ou la repasser en brouillon">${e.publie ? '✦ Publiée aux joueurs' : 'Brouillon : non publiée'}</button>
          <a class="btn" href="#/grimoire/${encodeURIComponent(e.id)}/reecrire">Réécrire l’entrée</a>
          <button class="btn ghost" data-act="copy">Copier pour Discord</button>`)}
        ${obs.length ? `<div class="obsmj"><h3>Observations des joueurs <small>${obs.length}</small></h3>${obs.map(o => `<div class="note"><div class="who">${o.date_obs ? esc(fmtDate(o.date_obs)) + ' — ' : ''}<b>${esc(o.perso || 'Anonyme')}</b></div>${para(o.texte)}
            <div class="row"><button class="mini" data-verser="${o.id}">Verser dans les Notes des Gris</button><button class="linkbtn" data-ecarter="${o.id}">Écarter</button></div></div>`).join('')}</div>` : ''}
        <div class="orn" style="margin-top:28px">${ORN}</div>
        <h2 class="part-title" style="margin-top:4px">I. Ce que dit le Grimoire</h2><p class="part-sub">PARTIE JOUEURS</p>
        ${SECTIONS_J.map((s, i) => readSection(s, i + 1, e.entree, { badge: crayon(e, s) + badgeVis(e, s), vide: remplir(e, s), voilee: !visOf(e.entree, s), extra: s.id === 'notes' ? noteForm : '' })).join('')}
        <div class="mj"><div class="orn">${ORN}</div><h2 class="part-title">II. Profil technique</h2><p class="part-sub">RÉSERVÉ AU MJ · RÉVÉLEZ SECTION PAR SECTION</p>
        ${SECTIONS_MJ.map((s, i) => readSection(s, i + 1, e.profil, { badge: crayon(e, s) + badgeVis(e, s), vide: remplir(e, s), voilee: !visOf(e.entree, s) })).join('')}</div>`;
    }

    /* ----- Formulaire ----- */
    const cleBr = () => st.mode === 'new' ? '__nouvelle' : st.sel;
    function prochainNumero() { return st.entries.reduce((m, e) => Math.max(m, parseInt(e.numero, 10) || 0), 0) + 1; }
    function renderEdit() {
      const isNew = st.mode === 'new';
      const base = isNew ? { numero: prochainNumero(), publie: false, entree: { connaissance: 'Rumeur' }, profil: {} } : st.byId.get(st.sel);
      const br = brouillons.lire(cleBr());
      const src = br || base;
      const e = { ...src.entree }, p = { ...src.profil };
      return `<form class="sheet edit" id="editform" novalidate>
        ${br ? `<div class="banner">Brouillon non scellé du ${esc(fmtDate(br.le))} restauré. <button type="button" class="linkbtn" data-act="jeter-brouillon">Revenir à la version scellée</button></div>` : ''}
        <div class="eyebrow">${isNew ? 'NOUVELLE ENTRÉE' : 'RÉÉCRITURE'} · N° <input class="in num" id="f-numero" inputmode="numeric" value="${esc(src.numero ?? '')}" aria-label="Numéro d'entrée"></div>
        <div class="field" style="margin-top:14px"><input class="in big" id="f-nom" value="${esc(e.nom)}" placeholder="Nom commun" aria-label="Nom commun"><div class="err" id="nom-err" hidden>Donnez au moins un nom à l'entité.</div></div>
        <div class="field"><label class="flabel" for="f-autresNoms">Autres noms (folklore, régions, langue ancienne)</label><input class="in" id="f-autresNoms" value="${esc(e.autresNoms)}"></div>
        <div class="field"><span class="flabel">Famille</span><div class="choices" role="radiogroup">${FAMILLES.map((o, j) => `<label class="choice"><input type="radio" name="famille" id="f-fam-${j}" value="${esc(o)}" ${e.famille === o ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>
          <input class="in" id="f-familleAutre" value="${esc(e.familleAutre)}" placeholder="Si « Autre » : laquelle ?" style="margin-top:6px" aria-label="Autre famille"></div>
        <div class="grid2">
          <div class="field"><span class="flabel">Niveau de connaissance</span><div class="choices" role="radiogroup">${CONNAISSANCE.map((o, j) => `<label class="choice"><input type="radio" name="connaissance" id="f-con-${j}" value="${o}" ${e.connaissance === o ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div></div>
          <div class="field"><label class="flabel" for="f-redacteur">Rédigé par</label><input class="in" id="f-redacteur" value="${esc(e.redacteur)}"></div>
        </div>
        <div class="field"><label class="choice"><input type="checkbox" id="f-publie" ${src.publie ? 'checked' : ''}><span>✦ Publier cette entité dans le Grimoire des joueurs</span></label></div>
        <div class="orn" style="margin-top:24px">${ORN}</div>
        <h2 class="part-title" style="margin-top:4px">I. Ce que dit le Grimoire</h2><p class="part-sub">PARTIE JOUEURS</p>
        ${SECTIONS_J.map((s, i) => editSection(s, i, e, e)).join('')}
        <div class="mj"><div class="orn">${ORN}</div><h2 class="part-title">II. Profil technique</h2><p class="part-sub">RÉSERVÉ AU MJ · COCHEZ CE QUE LES JOUEURS PEUVENT VOIR</p>
        ${SECTIONS_MJ.map((s, i) => editSection(s, i, p, e)).join('')}</div>
      </form>
      <div class="savebar" id="savebar">${barre(isNew)}</div>`;
    }
    const barre = isNew => `<button class="btn primary" data-act="save">Sceller l'entrée</button><button class="btn" data-act="cancel">Abandonner</button><span class="spacer"></span>${isNew ? '' : '<button class="btn danger" data-act="delete">Effacer l\'entrée</button>'}<div class="err" id="save-err" hidden style="width:100%"></div>`;
    function garderBrouillon() {
      const f = $('#editform', root); if (!f || !st.sale) return;
      const prec = st.mode === 'new' ? {} : (st.byId.get(st.sel)?.entree || {});
      brouillons.ecrire(cleBr(), { ...lireFormulaire(f, prec), le: new Date().toISOString() });
    }

    function renderFront() {
      const n = st.entries.length;
      if (peutEditer && !n) return `<div class="sheet front">${SIGIL}<h2>Le Grimoire est vierge</h2>
        <p>Aucune entité n’est encore consignée dans la base. Vous pouvez reprendre les entrées déjà publiées sur le site (fichier grimoire.json), importer une sauvegarde du Grimoire du Maître, ou inscrire une première entité.</p>
        <div class="row center"><button class="btn primary" data-act="import-json">Reprendre les entrées publiées</button><button class="btn" data-act="import">Importer une sauvegarde</button><button class="btn" data-act="new">Inscrire une entité</button></div></div>`;
      return `<div class="sheet front">${SIGIL}
        <h2>${n ? 'Le Grimoire est ouvert' : 'Le Grimoire est encore scellé'}</h2>
        <p>${n ? (peutEditer ? 'Choisissez une entité dans le sommaire, ou inscrivez-en une nouvelle. Ce que vous publiez est visible des joueurs immédiatement.' : 'Choisissez une entité dans le sommaire pour lire ce que les Gris en savent.') : "Aucune entité n'y a encore été consignée. Le MJ y ajoutera les créatures au fil des scénarios."}</p>
        ${n ? `<p class="count">${n} ${n > 1 ? 'ENTITÉS CONSIGNÉES' : 'ENTITÉ CONSIGNÉE'}</p>` : ''}</div>`;
    }
    function renderMain() {
      const e = st.sel && st.byId.get(st.sel);
      if (st.mode === 'edit' && (!e || !peutEditer)) st.mode = 'read';
      if (st.mode === 'new' && !peutEditer) st.mode = 'read';
      root.classList.toggle('reading', !!e || st.mode === 'new');
      root.classList.toggle('editing', st.mode !== 'read');
      const bandeau = (st.erreur ? `<div class="banner">${esc(st.erreur)}</div>` : '') + (st.alerteMJ ? `<div class="banner">${esc(st.alerteMJ)}</div>` : '');
      let corps;
      if (st.mode !== 'read') corps = `<a class="btn ghost back" href="#/grimoire${st.sel ? '/' + encodeURIComponent(st.sel) : ''}">← Abandonner</a>${renderEdit()}`;
      else if (e) corps = `<a class="btn ghost back" href="#/grimoire">← Sommaire</a><article class="sheet">${peutEditer ? renderMJ(e) : renderJoueur(e)}</article>`;
      else corps = renderFront();
      const pied = st.source === 'fichier' ? `<div class="foot"><span>${st.publishedAt ? 'Dernière mise en ligne le ' + esc(fmtDate(st.publishedAt)) : ''}</span></div>` : '';
      $('#gmain', root).innerHTML = bandeau + corps + pied;
      st.sale = false;
    }
    const render = () => { renderIndex(); renderMain(); };

    /* ----- Actions ----- */
    const remplacer = e => { const i = st.entries.findIndex(x => x.id === e.id); if (i >= 0) st.entries[i] = e; else st.entries.push(e); st.entries.sort((a, b) => (+a.numero || 1e9) - (+b.numero || 1e9) || String(a.nom).localeCompare(String(b.nom), 'fr')); st.byId = new Map(st.entries.map(x => [x.id, x])); };
    async function modifier(e, changes, msg) {
      try {
        const r = await grimoire.enregistrer({ id: e.id, numero: e.numero, publie: changes.publie ?? e.publie, entree: changes.entree || e.entree, profil: changes.profil || e.profil });
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
        const r = await grimoire.enregistrer({ id: prec?.id, ...d });
        brouillons.ecrire(cleBr(), null); remplacer(r); st.sale = false;
        toast('Entrée scellée'); naviguer('#/grimoire/' + encodeURIComponent(r.id)); window.scrollTo(0, 0);
      } catch (x) { btn.disabled = false; btn.textContent = "Sceller l'entrée"; err.textContent = 'Enregistrement impossible : ' + message(x); err.hidden = false; }
    }
    async function importer(lignes, titre) {
      const existants = lignes.filter(l => st.byId.has(l.id));
      const nouveaux = lignes.length - existants.length;
      let choix = 'completer';
      if (existants.length) {
        choix = await new Promise(res => {
          let fait = false;
          const m = modal(`<h3>${esc(titre)}</h3><p>${lignes.length} entité${lignes.length > 1 ? 's' : ''} dans le fichier : ${nouveaux} nouvelle${nouveaux > 1 ? 's' : ''}, ${existants.length} déjà dans le Grimoire (${existants.map(l => esc(l.entree.nom || l.id)).join(', ')}).</p>
            <p><b>Compléter</b> ajoute les nouvelles entités et remplit les profils techniques encore vides, sans rien écraser. <b>Remplacer</b> reprend les entités du fichier telles quelles.</p>
            <div class="row"><button class="btn primary" data-c="completer">Compléter</button><button class="btn" data-c="remplacer">Remplacer</button><button class="btn ghost" data-close>Annuler</button></div>`, { onClose: () => { if (!fait) res(null); } });
          $$('[data-c]', m).forEach(b => b.addEventListener('click', () => { fait = true; res(b.dataset.c); m.close(); }));
        });
        if (!choix) return;
      }
      const envoi = lignes.map(l => {
        const ex = st.byId.get(l.id); if (!ex || choix === 'remplacer') return l;
        return { id: ex.id, numero: ex.numero, publie: ex.publie, entree: ex.entree, profil: isEmpty(ex.profil) || Object.keys(ex.profil).every(k => k === 'updatedAt' || isEmpty(ex.profil[k])) ? (l.profil || {}) : ex.profil };
      });
      try {
        await grimoire.importer(envoi); await charger(); render();
        toast(`Import terminé : ${lignes.length} entité${lignes.length > 1 ? 's' : ''}`);
      } catch (x) { toast('Import impossible : ' + message(x)); }
    }
    function lireFichier(file) {
      const r = new FileReader();
      r.onload = () => {
        let d = null; try { d = JSON.parse(r.result); } catch (e) {}
        let lignes = null;
        if (d && d.format === 'grimoire-mj-v1') {
          lignes = Object.entries(d.entries || {}).map(([id, e]) => {
            const { publie, numero, updatedAt, ...entree } = e;
            return { id, numero: parseInt(numero, 10) || null, publie: !!publie, entree, profil: (d.profils || {})[id] || {} };
          });
        } else if (d && d.format === 'grimoire-brume-v1') lignes = (d.entries || []).map(depuisPublication);
        if (!lignes) { modal(`<h3>Fichier non reconnu</h3><p>Choisissez une sauvegarde du Grimoire du Maître (« grimoire-du-maitre-….json », bouton « Sauvegarder ») ou un fichier grimoire.json.</p><div class="row"><button class="btn" data-close>Fermer</button></div>`); return; }
        importer(lignes, 'Importer ' + file.name);
      };
      r.readAsText(file);
    }

    root.addEventListener('click', async ev => {
      const t = ev.target.closest('[data-act],[data-fam],[data-vue],[data-vis],[data-add],[data-del-row],[data-verser],[data-ecarter],[data-retirer-obs]'); if (!t) return;
      if (t.dataset.fam !== undefined) { st.fam = t.dataset.fam; renderIndex(); return; }
      if (t.dataset.vue) { st.vueJoueur = t.dataset.vue === 'joueur'; try { localStorage.setItem('ayesha.grimoire.vueJoueur', st.vueJoueur ? '1' : '0'); } catch (e) {} renderMain(); return; }
      if (t.dataset.add !== undefined) {
        const f = FIELDS[t.dataset.add]; const box = $(f.t === 'list' ? `[data-list="${f.k}"]` : `[data-rows="${f.k}"]`, root);
        box.insertAdjacentHTML('beforeend', f.t === 'list' ? listRow(f.k) : rowsRow(f)); const i = box.lastElementChild.querySelector('input,textarea'); if (i) i.focus(); st.sale = true; return;
      }
      if (t.hasAttribute('data-del-row')) { t.parentElement.remove(); st.sale = true; return; }
      const e = st.sel && st.byId.get(st.sel);
      if (t.dataset.vis && e) {
        const s = [...SECTIONS_J, ...SECTIONS_MJ].find(x => x.id === t.dataset.vis);
        const on = !visOf(e.entree, s);
        modifier(e, { entree: { ...e.entree, vis: { ...(e.entree.vis || {}), [s.id]: on } } }, on ? 'Section visible des joueurs' : 'Section voilée'); return;
      }
      if (t.dataset.verser && e) {
        const o = st.obs.find(x => x.id === t.dataset.verser); if (!o) return;
        const notes = [...(e.entree.notes || []), { date: o.date_obs || '', perso: o.perso || '', texte: o.texte }];
        if (await modifier(e, { entree: { ...e.entree, notes } })) {
          try { await observations.retirer(o.id); } catch (x) {}
          st.obs = st.obs.filter(x => x.id !== o.id); render(); toast('Observation versée dans les Notes des Gris');
        }
        return;
      }
      if (t.dataset.ecarter || t.dataset.retirerObs) {
        const id = t.dataset.ecarter || t.dataset.retirerObs;
        try { await observations.retirer(id); st.obs = st.obs.filter(x => x.id !== id); render(); toast(t.dataset.ecarter ? 'Observation écartée' : 'Observation retirée'); }
        catch (x) { toast('Impossible : ' + message(x)); }
        return;
      }
      switch (t.dataset.act) {
        case 'new': naviguer('#/grimoire/nouvelle'); break;
        case 'cancel': brouillons.ecrire(cleBr(), null); st.sale = false; naviguer(st.sel ? '#/grimoire/' + encodeURIComponent(st.sel) : '#/grimoire'); break;
        case 'jeter-brouillon': brouillons.ecrire(cleBr(), null); renderMain(); break;
        case 'save': sceller(); break;
        case 'delete':
          if (e && await confirmer({ titre: 'Effacer cette entrée ?', texte: `« ${esc(e.nom)} » et son profil technique seront effacés définitivement, pour vous comme pour les joueurs.`, oui: 'Effacer', danger: true })) {
            try { await grimoire.supprimer(e.id); brouillons.ecrire(cleBr(), null); st.entries = st.entries.filter(x => x.id !== e.id); st.byId.delete(e.id); st.sale = false; toast('Entrée effacée'); naviguer('#/grimoire'); }
            catch (x) { toast('Effacement impossible : ' + message(x)); }
          }
          break;
        case 'toggle-pub': if (e) modifier(e, { publie: !e.publie }, !e.publie ? 'Entité publiée : les joueurs la voient' : 'Entité repassée en brouillon'); break;
        case 'copy': if (e) copyText(texteDiscord(peutEditer ? versLecture({ id: e.id, numero: e.numero, entree: e.entree, profil: e.profil }, { commeJoueur: true }) : e), 'Fiche copiée', 'Fiche à copier'); break;
        case 'to-obs': { const f = $('#obsform', root); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); const ta = $('#o-texte', root); if (ta) ta.focus({ preventScroll: true }); } break; }
        case 'import': $('#impfile', root).click(); break;
        case 'import-json':
          try { const r = await fetch('grimoire.json', { cache: 'no-store' }); const d = await r.json(); await importer((d.entries || []).map(depuisPublication), 'Reprendre grimoire.json'); }
          catch (x) { toast('grimoire.json illisible : ' + message(x)); }
          break;
      }
    });
    root.addEventListener('change', ev => { if (ev.target.id === 'impfile') { const f = ev.target.files[0]; if (f) lireFichier(f); ev.target.value = ''; } });
    root.addEventListener('submit', async ev => {
      ev.preventDefault();
      const e = st.sel && st.byId.get(st.sel); if (!e) return;
      if (ev.target.id === 'addnote') {
        const texte = $('#n-texte', root).value.trim(), er = $('#n-err', root);
        if (!texte) { er.textContent = 'Écrivez la note avant de la consigner.'; er.hidden = false; return; }
        const notes = [...(e.entree.notes || []), { date: $('#n-date', root).value, perso: $('#n-perso', root).value.trim(), texte }];
        modifier(e, { entree: { ...e.entree, notes } }, 'Note consignée');
        return;
      }
      if (ev.target.id === 'obsform') {
        const texte = $('#o-texte', root).value.trim(), err = $('#o-err', root);
        if (!texte) { err.textContent = "Écrivez l'observation avant de l'envoyer."; err.hidden = false; return; }
        err.hidden = true;
        const perso = $('#o-perso', root).value.trim(), date = $('#o-date', root).value;
        if (ev.target.dataset.mode === 'copie') { copyText(`📜 Observation pour le Grimoire — ${e.nom} (n° ${roman(e.numero)})\n${date ? fmtDate(date) + ' — ' : ''}${perso || 'Anonyme'} : ${texte}`, 'Observation copiée : envoyez-la au MJ', 'Observation à envoyer au MJ'); return; }
        const b = ev.target.querySelector('button[type=submit]'); b.disabled = true;
        try { const o = await observations.proposer({ entree_id: e.id, perso, date_obs: date, texte }); st.obs.push(o); renderMain(); toast('Observation envoyée au MJ'); }
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
      const champ = c.querySelector('input:not([type=checkbox]):not([type=radio]),textarea'); if (champ) champ.focus({ preventScroll: true });
      c.classList.add('cible'); setTimeout(() => c.classList.remove('cible'), 1600);
    }
    render(); requestAnimationFrame(allerCible);
    if (st.sel && !st.byId.has(st.sel) && !st.erreur) toast('Cette entrée n’existe pas ou plus.');

    return {
      update(p) { garderBrouillon(); route(p); render(); allerCible(); },
      unmount() { garderBrouillon(); window.removeEventListener('beforeunload', avantDepart); },
    };
  },
};
