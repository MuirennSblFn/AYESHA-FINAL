/* =====================================================================
   Module « La table » (MJ) : fiches de tous les joueurs, en lecture seule
   #/table          → liste des joueurs
   #/table/<id>     → fiche d'un joueur
   ===================================================================== */
import { $, esc, toast, fmtDateHeure, downloadFile, slug, SIGIL_SMALL } from '../core/ui.js';
import { CLASSES, JAUGES } from '../shared/regles.js';
import { personnage, niveau, maxEffectifs, actuel } from '../shared/personnage.js';
import { creerFiche } from './fiche/sheet.js';
import { ficheImprimable } from './fiche/print.js';

export default {
  id: 'table',
  titre: 'La table',
  acces: 'mj',
  nav: { label: 'La table', ordre: 90 },
  carte: { titre: 'La table', texte: 'Consulter les fiches de tous les joueurs.' },

  async mount(root, { params }) {
    let cleanup = null;

    async function liste() {
      root.classList.remove('preview');
      root.innerHTML = '<div class="loading">Chargement des fiches…</div>';
      let joueurs;
      try { joueurs = (await personnage.tousLesJoueurs()).filter(j => j.role !== 'mj' || j.perso); }
      catch (e) { root.innerHTML = `<div class="panel center"><h2>Chargement impossible</h2><p>${esc(e.message || e)}</p></div>`; return; }
      const cartes = joueurs.map(j => {
        const C = j.perso;
        const gauges = C ? (() => { const M = maxEffectifs(C); return JAUGES.map(([k, ab]) => M[k] == null ? '' : `<span class="g ${k}">${ab} <b>${actuel(C, k, M[k])}</b>/${M[k]}</span>`).join(''); })() : '';
        return `<a class="pcard${C ? '' : ' empty'}" href="#/table/${encodeURIComponent(j.id)}">
          <div class="pp">${C?.portrait ? `<img src="${esc(C.portrait)}" alt="">` : j.avatar ? `<img src="${esc(j.avatar)}" alt="" referrerpolicy="no-referrer">` : SIGIL_SMALL}</div>
          <div class="pi">
            <div class="pn">${esc(C?.nom || (C ? 'Personnage sans nom' : 'Pas encore de fiche'))}</div>
            <div class="pj">${esc(j.nom || 'Joueur')}${j.role === 'mj' ? ' · MJ' : ''}</div>
            ${C ? `<div class="pc">${C.classe ? esc(CLASSES[C.classe]?.nom || '') + ' · ' : ''}niveau ${niveau(C)}</div><div class="pg">${gauges}</div>` : ''}
            ${j.updatedAt ? `<div class="pd">Modifiée le ${esc(fmtDateHeure(j.updatedAt))}</div>` : ''}
          </div></a>`;
      }).join('');
      root.innerHTML = `<div class="tablehead"><div><h2>La table</h2><p>${joueurs.length} joueur${joueurs.length > 1 ? 's' : ''} inscrit${joueurs.length > 1 ? 's' : ''}. Les fiches sont en lecture seule : seul le joueur peut modifier la sienne.</p></div><button class="btn" data-t="refresh">Actualiser</button></div>
        <div class="pcards">${cartes || '<p class="none">Aucun joueur ne s’est encore connecté.</p>'}</div>`;
    }

    async function detail(id) {
      root.classList.remove('preview');
      root.innerHTML = '<div class="loading">Ouverture de la fiche…</div>';
      let j;
      try { j = await personnage.ficheDe(id); }
      catch (e) { root.innerHTML = `<div class="panel center"><h2>Chargement impossible</h2><p>${esc(e.message || e)}</p></div>`; return; }
      if (!j) { root.innerHTML = '<div class="panel center"><h2>Joueur introuvable</h2><a class="btn" href="#/table">← Retour à la table</a></div>'; return; }
      if (!j.perso) { root.innerHTML = `<div class="panel center"><h2>${esc(j.nom)}</h2><p>Ce joueur n'a pas encore créé de fiche.</p><a class="btn" href="#/table">← Retour à la table</a></div>`; return; }
      root.innerHTML = `<div class="fichebar">
          <a class="btn ghost" href="#/table">← La table</a>
          <span class="statut ok">Fiche de ${esc(j.nom)} · lecture seule${j.updatedAt ? ' · modifiée le ' + esc(fmtDateHeure(j.updatedAt)) : ''}</span>
          <span class="spacer"></span>
          <button class="btn ghost" data-t="refresh-one">Actualiser</button>
          <button class="btn ghost" data-t="export">Télécharger</button>
          <button class="btn ghost" data-t="preview" id="previewBtn">Aperçu impression</button>
          <button class="btn primary" data-t="print">Imprimer</button>
        </div>
        <div id="fiche"></div><div id="ps"></div>`;
      creerFiche($('#fiche', root), j.perso, { lectureSeule: true });
      document.body.classList.add('has-ps');
      const bp = () => { $('#ps', root).innerHTML = ficheImprimable(j.perso); };
      window.addEventListener('beforeprint', bp);
      cleanup = () => { window.removeEventListener('beforeprint', bp); document.body.classList.remove('has-ps'); };
      root.dataset.joueur = id;
      root._perso = j.perso;
    }

    async function afficher(p) {
      if (cleanup) { cleanup(); cleanup = null; }
      if (p[0]) await detail(p[0]); else await liste();
      window.scrollTo(0, 0);
    }

    root.addEventListener('click', e => {
      const t = e.target.closest('[data-t]'); if (!t) return;
      const C = root._perso;
      switch (t.dataset.t) {
        case 'refresh': liste(); break;
        case 'refresh-one': afficher([root.dataset.joueur]).then(() => toast('Fiche actualisée')); break;
        case 'export': if (C) downloadFile(`fiche-${slug(C.nom)}.json`, JSON.stringify(C, null, 1)); break;
        case 'preview': {
          const on = !root.classList.contains('preview'); root.classList.toggle('preview', on);
          if (on) $('#ps', root).innerHTML = ficheImprimable(C);
          t.textContent = on ? 'Revenir à la fiche' : 'Aperçu impression'; window.scrollTo(0, 0); break;
        }
        case 'print': $('#ps', root).innerHTML = ficheImprimable(C); window.print(); break;
      }
    });

    await afficher(params);
    return {
      update: p => afficher(p),
      unmount() { if (cleanup) cleanup(); },
    };
  },
};
