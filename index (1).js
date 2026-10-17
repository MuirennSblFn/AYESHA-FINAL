/* =====================================================================
   Module « Ma fiche » : la fiche du joueur connecté, enregistrée en ligne
   ===================================================================== */
import { $, esc, toast, modal, confirmer, downloadFile, slug, fmtDateHeure } from '../../core/ui.js';
import { CLASSES } from '../../shared/regles.js';
import { personnage, vierge, normaliser, FORMAT } from '../../shared/personnage.js';
import { creerFiche } from './sheet.js';
import { ficheImprimable } from './print.js';

const STATUTS = {
  ok: ['ok', 'Enregistré'],
  attente: ['wait', 'Modifications en cours…'],
  envoi: ['wait', 'Enregistrement…'],
  erreur: ['err', 'Hors ligne : copie gardée sur cet appareil, nouvel essai automatique'],
  conflit: ['err', 'Fiche modifiée sur un autre appareil'],
};

export default {
  id: 'fiche',
  titre: 'Ma fiche',
  acces: 'joueur',
  nav: { label: 'Ma fiche', ordre: 20 },
  carte: { titre: 'Ma fiche de personnage', texte: 'Créer, remplir et imprimer sa fiche. Dés en ligne ou saisie à la main.' },

  async mount(root, { auth }) {
    root.innerHTML = '<div class="loading">Ouverture de votre fiche…</div>';
    let p = await personnage.charger({ forcer: true });
    let fiche = null;
    const nettoyages = [];

    /* ---------- Modifications non envoyées lors d'une visite précédente ---------- */
    const br = personnage.brouillon();
    if (br && br.data) {
      const memeBase = (br.base || null) === (p?.updatedAt || null);
      const differe = !p || JSON.stringify(normaliser(br.data)) !== JSON.stringify(p.data);
      if (differe && (memeBase || await confirmer({
        titre: 'Récupérer des modifications ?',
        texte: `Des modifications faites sur cet appareil${br.data.updatedAt ? ' (' + esc(fmtDateHeure(br.data.updatedAt)) + ')' : ''} n'ont pas été enregistrées en ligne, et la fiche en ligne a changé depuis. Les récupérer remplacera la version en ligne.`,
        oui: 'Récupérer mes modifications', non: 'Garder la version en ligne',
      }))) {
        await personnage.remplacer(br.data, { ecraser: true });
        p = { data: (await personnage.charger()).data };
        toast('Modifications récupérées');
      } else personnage.oublierBrouillon();
    }

    /* ---------- Première visite : créer la fiche ---------- */
    if (!p) {
      const data = await choisirDepart(root, auth);
      if (!data) return;
      if (!data.joueur) data.joueur = auth.nom;
      await personnage.remplacer(data);
      p = await personnage.charger();
    }

    /* ---------- Affichage ---------- */
    root.innerHTML = `
      <div class="fichebar">
        <span class="statut" id="statut" role="status"></span>
        <span class="spacer"></span>
        <button class="btn ghost" id="readBtn" data-f="read" aria-pressed="false">Lecture</button>
        <button class="btn ghost" data-f="import">Importer un fichier</button>
        <button class="btn ghost" data-f="export">Télécharger</button>
        <button class="btn ghost" data-f="preview" id="previewBtn" aria-pressed="false">Aperçu impression</button>
        <button class="btn primary" data-f="print">Imprimer</button>
      </div>
      <div id="fiche"></div>
      <div id="ps"></div>
      <div class="foot"><span>Votre fiche est enregistrée en ligne sur votre compte. Le MJ peut la consulter.</span><button class="mini" data-f="reset">Repartir d'une fiche vierge</button></div>
      <input type="file" id="file-open" accept=".json,application/json" hidden>`;

    let reading = false;
    try { reading = localStorage.getItem('ayesha.lecture') === '1'; } catch (e) {}
    fiche = creerFiche($('#fiche', root), p.data, { onChange: C => personnage.modifie(C) });
    if (p.data._converti) { delete p.data._converti; personnage.modifie(p.data); }   // ancienne fiche : enregistrer le nouveau format
    fiche.lecture(reading);
    const majLecture = () => { const b = $('#readBtn', root); b.setAttribute('aria-pressed', String(reading)); b.textContent = reading ? 'Modifier' : 'Lecture'; };
    majLecture();
    document.body.classList.add('has-ps');

    const majStatut = s => {
      const [cls, txt] = STATUTS[s] || STATUTS.ok;
      const el = $('#statut', root); if (!el) return;
      el.className = 'statut ' + cls;
      el.textContent = s === 'ok' && personnage.updatedAt ? `${txt} · ${fmtDateHeure(personnage.updatedAt)}` : txt;
    };
    majStatut(personnage.statut);
    nettoyages.push(personnage.surStatut(majStatut));

    personnage.surConflit(enLigne => {
      if (!enLigne) { personnage.garderLaMienne(null); return; }
      const m = modal(`<h3>Fiche modifiée ailleurs</h3>
        <p>Votre fiche a été modifiée depuis un autre appareil (${esc(fmtDateHeure(enLigne.updatedAt))}) pendant que vous la remplissiez ici. Quelle version garder ?</p>
        <div class="row"><button class="btn primary" data-k="online">Charger la version en ligne</button><button class="btn" data-k="mine">Garder celle de cet appareil</button></div>`);
      m.addEventListener('click', e => {
        const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
        if (k === 'online') { fiche.setData(personnage.prendreEnLigne(enLigne)); toast('Version en ligne chargée'); }
        else { personnage.garderLaMienne(enLigne); toast('Votre version a été enregistrée'); }
        m.close();
      });
    });
    nettoyages.push(() => personnage.surConflit(null));

    // Envoyer sans attendre si on quitte la page, vérifier les nouveautés au retour
    const onHide = () => { if (document.visibilityState === 'hidden' && personnage.statut === 'attente') personnage.envoyer(); };
    const onShow = async () => {
      if (document.visibilityState !== 'visible' || personnage.statut !== 'ok') return;
      const avant = personnage.updatedAt;
      try { const n = await personnage.charger({ forcer: true }); if (n && n.updatedAt !== avant && personnage.statut === 'ok') { fiche.setData(n.data); toast('Fiche mise à jour depuis un autre appareil'); } } catch (e) {}
    };
    document.addEventListener('visibilitychange', onHide);
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pagehide', onHide);
    nettoyages.push(() => { document.removeEventListener('visibilitychange', onHide); document.removeEventListener('visibilitychange', onShow); window.removeEventListener('pagehide', onHide); });

    const setPreview = on => {
      root.classList.toggle('preview', on);
      if (on) $('#ps', root).innerHTML = ficheImprimable(fiche.data);
      const b = $('#previewBtn', root); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Revenir à la fiche' : 'Aperçu impression';
      window.scrollTo(0, 0);
    };
    const beforePrint = () => { $('#ps', root).innerHTML = ficheImprimable(fiche.data); };
    window.addEventListener('beforeprint', beforePrint);
    nettoyages.push(() => window.removeEventListener('beforeprint', beforePrint));

    root.addEventListener('click', async e => {
      const t = e.target.closest('[data-f]'); if (!t) return;
      switch (t.dataset.f) {
        case 'read': reading = !reading; try { localStorage.setItem('ayesha.lecture', reading ? '1' : '0'); } catch (err) {} fiche.lecture(reading); majLecture(); break;
        case 'export': downloadFile(`fiche-${slug(fiche.data.nom)}.json`, JSON.stringify(fiche.data, null, 1)); toast('Fiche téléchargée'); break;
        case 'import': $('#file-open', root).click(); break;
        case 'preview': setPreview(!root.classList.contains('preview')); break;
        case 'print': beforePrint(); window.print(); break;
        case 'reset': {
          if (!await confirmer({ titre: "Repartir d'une fiche vierge ?", texte: `« ${esc(fiche.data.nom || 'Personnage sans nom')} » sera remplacé par une fiche vide. Téléchargez d'abord la fiche si vous voulez la garder.`, oui: 'Effacer et recommencer', danger: true })) return;
          const v = vierge(); v.joueur = auth.nom; fiche.setData(v); await personnage.remplacer(v, { ecraser: true }); toast('Nouvelle fiche'); break;
        }
      }
    });
    root.addEventListener('change', async e => {
      if (e.target.id !== 'file-open' || !e.target.files[0]) return;
      const data = await lireFichier(e.target.files[0]); e.target.value = '';
      if (!data) return;
      if (!await confirmer({ titre: 'Remplacer votre fiche ?', texte: `La fiche en ligne sera remplacée par « ${esc(data.nom || 'Personnage sans nom')} » (fichier importé).`, oui: 'Remplacer' })) return;
      fiche.setData(data); await personnage.remplacer(data, { ecraser: true }); toast('Fiche importée');
    });

    return {
      unmount() {
        nettoyages.forEach(fn => fn());
        document.body.classList.remove('has-ps');
        if (personnage.statut === 'attente') personnage.envoyer();
      },
    };
  },
};

/* Lit un fichier de fiche (.json enregistré par l'ancien site ou par celui-ci) */
function lireFichier(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => {
      let d = null; try { d = JSON.parse(r.result); } catch (e) {}
      if (d && d.chars && !d.format) { const v = Object.values(d.chars); d = v.length ? v[0] : null; }   // sauvegarde complète de l'ancien site
      if (!d || d.format !== FORMAT) { toast(`« ${file.name} » n'est pas une fiche d'Ayesha.`); return res(null); }
      res(normaliser(d));
    };
    r.onerror = () => { toast('Lecture du fichier impossible.'); res(null); };
    r.readAsText(file);
  });
}

/* Écran de création : fiche vierge, ancienne fiche du navigateur ou fichier */
function choisirDepart(root, auth) {
  return new Promise(resolve => {
    const anciennes = personnage.anciennesFiches().filter(c => c.nom || c.classe || Object.values(c.stats).some(Boolean));
    root.innerHTML = `<div class="panel start">
      <h2>Votre fiche de personnage</h2>
      <p>Bienvenue, ${esc(auth.nom)}. Vous n'avez pas encore de fiche sur ce compte. Comment voulez-vous commencer ?</p>
      <div class="choices">
        <button class="choice" data-s="vierge"><b>Créer un nouveau personnage</b><small>Une fiche vide, à remplir avec les dés du site ou les vôtres.</small></button>
        ${anciennes.length ? `<div class="choice old"><b>Reprendre une fiche de l'ancien site</b><small>Trouvée${anciennes.length > 1 ? 's' : ''} dans ce navigateur :</small>
          <div class="oldlist">${anciennes.map((c, i) => `<button class="btn" data-s="ancienne" data-i="${i}">${esc(c.nom || 'Personnage sans nom')}${c.classe ? ' · ' + esc(CLASSES[c.classe]?.nom || '') : ''}</button>`).join('')}</div></div>` : ''}
        <button class="choice" data-s="fichier"><b>Importer un fichier</b><small>Une fiche enregistrée avec « Enregistrer le fichier » sur l'ancien site (.json).</small></button>
      </div>
      <p class="hint">Fiche papier ? Créez un nouveau personnage et recopiez les valeurs : toutes les cases se remplissent à la main.</p>
      <input type="file" id="start-file" accept=".json,application/json" hidden>
    </div>`;
    root.addEventListener('click', function onClick(e) {
      const t = e.target.closest('[data-s]'); if (!t) return;
      if (t.dataset.s === 'vierge') { root.removeEventListener('click', onClick); resolve(vierge()); }
      if (t.dataset.s === 'ancienne') { root.removeEventListener('click', onClick); resolve(anciennes[+t.dataset.i]); }
      if (t.dataset.s === 'fichier') $('#start-file', root).click();
    });
    root.addEventListener('change', async e => {
      if (e.target.id !== 'start-file' || !e.target.files[0]) return;
      const d = await lireFichier(e.target.files[0]); e.target.value = '';
      if (d) resolve(d);
    });
  });
}
