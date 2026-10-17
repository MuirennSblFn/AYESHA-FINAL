/* =====================================================================
   Module Grimoire de la Brume — exemplaire des Gris (public)
   Le contenu vient de grimoire.json, à remplacer par le code copié depuis
   le bouton « Publier pour les joueurs » du Grimoire du Maître.
   Adresse d'une entrée : #/grimoire/<id>
   ===================================================================== */
import { $, esc, para, today, fmtDate, toast, copyText, ORN, SIGIL } from '../core/ui.js';
import { personnage } from '../shared/personnage.js';

const FAMILLES = ['Fée / petit peuple', 'Mort-vivant', 'Métamorphe', 'Démon', 'Esprit / fantôme', 'Bête mythique', 'Autre'];
const CONNAISSANCE = ['Rumeur', 'Partiel', 'Documenté', 'Complet'];
const STATS = ['INT', 'DEX', 'FOR', 'PER', 'CHA'];
const EXTRA = [{ k: 'pv', l: 'PV' }, { k: 'armure', l: 'Armure', hint: 'réduction / coup' }, { k: 'pm', l: 'PM' }, { k: 'volonte', l: 'Volonté', hint: '/20' }];

const SECTIONS_J = [
  { id: 'desc', t: 'Description', f: [{ k: 'apparence', l: 'Apparence réelle', t: 'area' }, { k: 'taille', l: 'Taille / carrure', t: 'text' }] },
  { id: 'brume', t: 'Sous la Brume', f: [{ k: 'percu', l: 'Ce que perçoivent les humains', t: 'area' }, { k: 'explication', l: 'Explication rationnelle habituelle', t: 'area' }] },
  { id: 'origines', t: 'Origines & mythologie', f: [{ k: 'origines', t: 'area' }] },
  { id: 'habitat', t: 'Habitat & territoire', f: [{ k: 'milieux', l: 'Milieu', t: 'checks' }, { k: 'lieux', l: 'Lieux typiques', t: 'area' }] },
  { id: 'moeurs', t: 'Mœurs & comportement', f: [{ k: 'activite', l: 'Activité', t: 'text' }, { k: 'social', l: 'Solitaire, meute ou société organisée', t: 'text' }, { k: 'alimentation', l: 'Alimentation / besoins', t: 'text' }, { k: 'communication', l: 'Communication', t: 'text' }] },
  { id: 'equilibre', t: "Rapport à l'équilibre", f: [{ k: 'attitude', l: 'Attitude envers les humains', t: 'radio' }, { k: 'bascule', l: "Ce qui la fait basculer hors de l'équilibre", t: 'area' }] },
  { id: 'signes', t: 'Signes de présence', s: "indices d'enquête", f: [{ k: 'signes', t: 'list' }] },
  { id: 'faiblesses', t: 'Faiblesses connues', f: [{ k: 'faiblesses', t: 'area' }] },
  { id: 'protections', t: 'Protections & remèdes', f: [{ k: 'prevenir', l: "Pour s'en prémunir", t: 'area' }, { k: 'repousser', l: "Pour la repousser, l'apaiser ou la neutraliser", t: 'area' }] },
  { id: 'rumeurs', t: 'Rumeurs non vérifiées', f: [{ k: 'rumeurs', t: 'area' }] },
  { id: 'notes', t: 'Notes des Gris', s: 'ajoutées en fin de scénario', f: [{ k: 'notes', t: 'rows', cols: [{ k: 'date', l: 'Date' }, { k: 'perso', l: 'Personnage' }, { k: 'texte', l: 'Note' }] }] },
];
const SECTIONS_MJ = [
  { id: 'stats', t: 'Caractéristiques', s: 'sur 1d100', f: [{ k: 'stats', t: 'stats' }] },
  { id: 'attaques', t: 'Attaques', f: [{ k: 'attaques', t: 'rows', cols: [{ k: 'nom', l: 'Nom' }, { k: 'stat', l: 'Stat testée' }, { k: 'degats', l: 'Dégâts' }, { k: 'effets', l: 'Effets supplémentaires' }] }] },
  { id: 'reactions', t: 'Réactions privilégiées', f: [{ k: 'reactions', t: 'checks' }, { k: 'reactionAutre', l: 'Autre réaction', t: 'text' }] },
  { id: 'pouvoirs', t: 'Pouvoirs & capacités spéciales', f: [{ k: 'pouvoirs', t: 'area' }] },
  { id: 'vuln', t: 'Vulnérabilités', f: [{ k: 'vArmes', l: 'Armes / matériaux efficaces', t: 'text' }, { k: 'vInefficaces', l: 'Armes inefficaces', t: 'text' }, { k: 'vMots', l: "Mots de l'ancien langage efficaces", t: 'text' }, { k: 'vAutres', l: 'Autres (lieux, objets, rituels, conditions)', t: 'area' }] },
  { id: 'resist', t: 'Résistances & immunités', f: [{ k: 'resistances', t: 'area' }] },
  { id: 'sante', t: 'Perte de Santé mentale', f: [{ k: 'smRencontre', l: 'À la première rencontre', t: 'text' }, { k: 'smPouvoirs', l: 'Face à ses pouvoirs / sa vraie forme', t: 'text' }] },
  { id: 'butin', t: 'Butin & artefacts', s: "pour l'armurerie", f: [{ k: 'butin', t: 'area' }] },
  { id: 'mots', t: "Mots de l'ancien langage à apprendre", f: [{ k: 'motsApprendre', t: 'area' }] },
  { id: 'secrets', t: 'Secrets du MJ', s: 'ce que le Grimoire ignore ou déforme', f: [{ k: 'secrets', t: 'area' }] },
];

const isEmpty = v => v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isEmpty));
function roman(n) { n = parseInt(n, 10); if (!n || n < 1) return '—'; if (n > 3999) return String(n); const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let r = ''; for (const [v, s] of m) { while (n >= v) { r += s; n -= v; } } return r; }
const pips = c => { const i = CONNAISSANCE.indexOf(c); return `<span class="kpips" title="Connaissance : ${esc(c || 'non précisée')}">${CONNAISSANCE.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span>`; };
const famLabel = e => e.famille === 'Autre' ? (e.familleAutre || 'Autre') : (e.famille || '');

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
function readSection(s, num, d) {
  const inner = s.f.map(f => readField(f, d || {})).join('');
  return `<section class="sec"><h3><span class="rn">${roman(num)}.</span>${esc(s.t)}${s.s ? `<span class="sub">${esc(s.s)}</span>` : ''}</h3>${inner || '<p class="blank">Page blanche.</p>'}</section>`;
}
function playerText(e) {
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

/* Le contenu est chargé une fois par visite */
let DATA = null, CHARGEMENT = null;
async function chargerGrimoire() {
  if (DATA) return DATA;
  if (!CHARGEMENT) CHARGEMENT = fetch('grimoire.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('introuvable'); return r.json(); })
    .then(d => { DATA = d; return d; }).finally(() => { CHARGEMENT = null; });
  return CHARGEMENT;
}

export default {
  id: 'grimoire',
  titre: 'Grimoire de la Brume',
  acces: 'public',
  nav: { label: 'Grimoire', ordre: 10 },
  carte: { titre: 'Grimoire de la Brume', texte: 'Le bestiaire des Gris : ce que l’on sait des entités de la Brume.' },

  async mount(root, { auth, params, naviguer }) {
    const st = { sel: params[0] || null, q: '', fam: '' };
    let ENTRIES = [], BY_ID = new Map(), nomPerso = '';
    root.innerHTML = '<div class="loading">Ouverture du grimoire…</div>';
    let erreur = false;
    try {
      const d = await chargerGrimoire();
      ENTRIES = (d.entries || []).slice().sort((a, b) => (+a.numero || 1e9) - (+b.numero || 1e9) || String(a.nom).localeCompare(String(b.nom), 'fr'));
      BY_ID = new Map(ENTRIES.map(e => [e.id, e]));
    } catch (e) { erreur = true; }
    if (auth.user) personnage.charger().then(p => { nomPerso = p?.data?.nom || ''; const i = $('#o-perso', root); if (i && !i.value) i.value = nomPerso; }).catch(() => {});

    root.innerHTML = `<div class="layout">
      <aside class="index" aria-label="Sommaire du grimoire">
        <h2>SOMMAIRE <span id="count"></span></h2>
        <input class="search" id="q" type="search" placeholder="Chercher un nom…" autocomplete="off">
        <div class="famfilter" id="famfilter"></div>
        <ul class="toc" id="toc"></ul>
      </aside>
      <main id="gmain"></main>
    </div>`;

    function renderIndex() {
      $('#count', root).textContent = ENTRIES.length + (ENTRIES.length > 1 ? ' entrées' : ' entrée');
      const fams = FAMILLES.filter(f => ENTRIES.some(e => e.famille === f));
      $('#famfilter', root).innerHTML = fams.length < 2 ? '' : [`<button class="chip" data-fam="" aria-pressed="${st.fam === ''}">Toutes</button>`, ...fams.map(f => `<button class="chip" data-fam="${esc(f)}" aria-pressed="${st.fam === f}">${esc(f)}</button>`)].join('');
      const q = st.q.trim().toLowerCase();
      const rows = ENTRIES.filter(e => (!st.fam || e.famille === st.fam) && (!q || (String(e.nom) + ' ' + String(e.autresNoms || '')).toLowerCase().includes(q)));
      $('#toc', root).innerHTML = !rows.length ? `<li class="empty">${ENTRIES.length ? 'Aucune entrée ne correspond.' : "Aucune entité consignée pour l'instant."}</li>`
        : rows.map(e => `<li><a href="#/grimoire/${encodeURIComponent(e.id)}" aria-current="${st.sel === e.id}"><span class="num">${roman(e.numero)}</span><span><span class="nm">${esc(e.nom || 'Sans nom')}</span><span class="fm">${esc(famLabel(e))}</span></span>${pips(e.connaissance)}</a></li>`).join('');
    }
    function renderEntry(e) {
      const secJ = SECTIONS_J.filter(s => (e.secJ || []).includes(s.id));
      const secM = SECTIONS_MJ.filter(s => (e.secM || []).includes(s.id));
      const meta = [
        famLabel(e) && `<span>Famille <b>${esc(famLabel(e))}</b></span>`,
        `<span>Connaissance ${pips(e.connaissance)} <b>${esc(e.connaissance || 'non précisée')}</b></span>`,
        e.redacteur && `<span>Rédigé par <b>${esc(e.redacteur)}</b></span>`,
        e.maj && `<span>Mis à jour le <b>${esc(fmtDate(e.maj))}</b></span>`,
      ].filter(Boolean).join('');
      return `<a class="btn ghost back" href="#/grimoire">← Sommaire</a>
      <article class="sheet">
        <div class="eyebrow">ENTRÉE N° ${roman(e.numero)}</div>
        <h2 class="entry-name">${esc(e.nom || 'Sans nom')}</h2>
        ${e.autresNoms ? `<p class="aka">${esc(e.autresNoms)}</p>` : ''}
        <div class="meta">${meta}</div>
        <div class="tools"><button class="btn ghost" data-act="copy">Copier la fiche</button><button class="btn ghost" data-act="to-obs">Proposer une observation</button></div>
        <div class="orn" style="margin-top:28px">${ORN}</div>
        <h2 class="part-title" style="margin-top:4px">I. Ce que dit le Grimoire</h2>
        ${secJ.length ? secJ.map((s, i) => readSection(s, i + 1, e.j)).join('') : '<p class="blank" style="text-align:center">Le Grimoire est encore muet sur cette entité.</p>'}
        ${secM.length ? `<div class="mj"><div class="orn">${ORN}</div><h2 class="part-title">II. Ce que le Maître a révélé</h2><p class="part-sub">ÉPROUVÉ SUR LE TERRAIN</p>${secM.map((s, i) => readSection(s, i + 1, e.m)).join('')}</div>` : ''}
        <form class="obs" id="obsform">
          <h3>Proposer une observation</h3>
          <p>Ce que votre personnage a vu, appris ou subi face à cette entité. Le texte est copié pour que vous l'envoyiez au MJ, qui l'ajoutera aux Notes des Gris.</p>
          <div class="grid"><input class="in" id="o-perso" placeholder="Personnage" aria-label="Personnage" value="${esc(nomPerso)}"><input class="in" type="date" id="o-date" value="${today()}" aria-label="Date"><textarea class="ta" id="o-texte" rows="3" placeholder="Observation…" aria-label="Observation"></textarea></div>
          <div class="err" id="o-err" hidden></div>
          <div style="margin-top:8px"><button class="btn primary" type="submit">Copier pour le MJ</button></div>
        </form>
      </article>`;
    }
    function renderFront() {
      const n = ENTRIES.length;
      return `<div class="sheet front">${SIGIL}
        <h2>${n ? 'Le Grimoire est ouvert' : 'Le Grimoire est encore scellé'}</h2>
        <p>${n ? 'Choisissez une entité dans le sommaire pour lire ce que les Gris en savent.' : "Aucune entité n'y a encore été consignée. Le MJ y ajoutera les créatures au fil des scénarios."}</p>
        ${n ? `<p class="count">${n} ${n > 1 ? 'ENTITÉS CONSIGNÉES' : 'ENTITÉ CONSIGNÉE'}</p>` : ''}</div>`;
    }
    function renderMain() {
      const e = st.sel && BY_ID.get(st.sel);
      root.classList.toggle('reading', !!e);
      $('#gmain', root).innerHTML = (erreur ? `<div class="banner">Le fichier grimoire.json est introuvable ou mal formé. Vérifiez qu'il se trouve à côté de index.html et qu'il contient bien le code copié depuis le Grimoire du Maître.</div>` : '')
        + (e ? renderEntry(e) : renderFront())
        + `<div class="foot"><span>${DATA?.publishedAt ? 'Dernière mise en ligne le ' + esc(fmtDate(DATA.publishedAt)) : 'Pas encore mis en ligne'}</span></div>`;
    }
    const render = () => { renderIndex(); renderMain(); };

    root.addEventListener('click', ev => {
      const t = ev.target.closest('[data-act],[data-fam]'); if (!t) return;
      if (t.dataset.fam !== undefined) { st.fam = t.dataset.fam; renderIndex(); return; }
      const e = st.sel && BY_ID.get(st.sel);
      if (t.dataset.act === 'copy' && e) copyText(playerText(e), 'Fiche copiée', 'Fiche à copier');
      if (t.dataset.act === 'to-obs') { $('#obsform', root).scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#o-texte', root).focus({ preventScroll: true }); }
    });
    root.addEventListener('submit', ev => {
      ev.preventDefault();
      const e = BY_ID.get(st.sel); if (!e) return;
      const texte = $('#o-texte', root).value.trim(), err = $('#o-err', root);
      if (!texte) { err.textContent = "Écrivez l'observation avant de la copier."; err.hidden = false; return; }
      err.hidden = true;
      const perso = $('#o-perso', root).value.trim() || 'Anonyme', date = $('#o-date', root).value;
      copyText(`📜 Observation pour le Grimoire — ${e.nom} (n° ${roman(e.numero)})\n${date ? fmtDate(date) + ' — ' : ''}${perso} : ${texte}`, 'Observation copiée : envoyez-la au MJ', 'Observation à envoyer au MJ');
    });
    root.addEventListener('input', ev => { if (ev.target.id === 'q') { st.q = ev.target.value; renderIndex(); } });

    render();
    if (st.sel && !BY_ID.has(st.sel) && !erreur) toast('Cette entrée n’existe pas ou plus.');

    return {
      update(p) { st.sel = p[0] || null; render(); window.scrollTo(0, 0); },
    };
  },
};
