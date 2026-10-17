/* =====================================================================
   Équipement : inventaire et objets portés
   ---------------------------------------------------------------------
   C.possessions = liste de tout ce que possède le personnage :
   { id, item?, nom, type, empl, qte, stat, deg, red, mal, eff, porte, src? }
     type  : 'arme' | 'armure' | 'consommable' | 'equipement' | 'artefact'
     empl  : où il se porte (voir EMPLACEMENTS dans regles.js), '' = ne s'équipe pas
     porte : '' = dans l'inventaire ; sinon la case occupée :
             'main_d', 'main_g', 'deux_mains', 'tete', 'corps_dessous', …
   Seul ce qui est porté compte pour les totaux (réduction, malus de DEX).
   Une case ne contient qu'un objet ; équiper un objet renvoie l'ancien
   occupant dans l'inventaire.
   ===================================================================== */

const ent = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
export const nouvelId = () => 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const portes = C => C.possessions.filter(o => o.porte);
export const sacoche = C => C.possessions.filter(o => !o.porte);
export const estEquipable = o => !!(o && o.empl);

/* Ce qui occupe une case de la fiche (une arme à deux mains occupe les deux mains) */
export function occupant(C, cas) {
  if (cas === 'main_d' || cas === 'main_g') return C.possessions.find(o => o.porte === cas || o.porte === 'deux_mains') || null;
  return C.possessions.find(o => o.porte === cas) || null;
}

/* Renvoie un objet porté dans l'inventaire (regroupé avec un exemplaire identique s'il y en a un) */
export function ranger(C, id) {
  const o = C.possessions.find(x => x.id === id); if (!o || !o.porte) return;
  o.porte = '';
  const jumeau = C.possessions.find(x => x !== o && !x.porte && memeObjet(x, o));
  if (jumeau) { jumeau.qte = ent(jumeau.qte) + Math.max(1, ent(o.qte)); C.possessions.splice(C.possessions.indexOf(o), 1); }
}
const memeObjet = (a, b) => a.item && b.item ? a.item === b.item && a.nom === b.nom : false;

/* Équipe un objet de l'inventaire. Renvoie la liste des noms renvoyés dans l'inventaire. */
export function equiper(C, id, main) {
  let o = C.possessions.find(x => x.id === id);
  if (!o || o.porte || !estEquipable(o)) return [];
  // Un seul exemplaire part sur le personnage ; le reste de la pile reste dans l'inventaire
  if (ent(o.qte) > 1) {
    o.qte = ent(o.qte) - 1;
    const copie = { ...o, id: nouvelId(), qte: 1 };
    C.possessions.splice(C.possessions.indexOf(o) + 1, 0, copie);
    o = copie;
  }
  // Cases visées
  let cases;
  if (o.empl === 'deux_mains') cases = ['main_d', 'main_g'];
  else if (o.empl === 'main' || o.empl === 'bouclier') {
    const libre = k => !occupant(C, k);
    const pref = main || (o.empl === 'bouclier' ? ['main_g', 'main_d'] : ['main_d', 'main_g']).find(libre) || (o.empl === 'bouclier' ? 'main_g' : 'main_d');
    cases = [pref];
  } else cases = [o.empl];
  const renvoyes = [];
  cases.forEach(k => { const occ = occupant(C, k); if (occ && occ !== o) { renvoyes.push(occ.nom || 'objet'); ranger(C, occ.id); } });
  o.porte = o.empl === 'deux_mains' ? 'deux_mains' : cases[0];
  return [...new Set(renvoyes)];
}

/* Utilise un consommable : −1, retiré à 0. Renvoie la quantité restante. */
export function utiliser(C, id) {
  const o = C.possessions.find(x => x.id === id); if (!o) return 0;
  const n = ent(o.qte) - 1;
  if (n <= 0) C.possessions.splice(C.possessions.indexOf(o), 1); else o.qte = n;
  return Math.max(0, n);
}

/* Totaux de l'équipement porté */
export const reductionPortee = C => portes(C).reduce((s, o) => s + Math.max(0, ent(o.red)), 0);
export const malusPorte = C => portes(C).reduce((s, o) => s + Math.abs(ent(o.mal)), 0);
export const armesEnMain = C => {
  const l = []; ['main_d', 'main_g'].forEach(k => { const o = occupant(C, k); if (o && !l.includes(o)) l.push(o); }); return l;
};

/* ---------- Conversion des fiches enregistrées avant l'inventaire ---------- */
export function migrerEquipement(o) {
  if (!Array.isArray(o.possessions)) o.possessions = [];
  const aConvertir = ['armes', 'armures', 'objets'].some(k => Array.isArray(o[k]));
  if (aConvertir) {
    const plein = s => String(s || '').trim();
    (o.armes || []).filter(a => plein(a.nom)).forEach(a => o.possessions.push({ id: nouvelId(), item: a.item, nom: a.nom, type: 'arme', empl: 'main', qte: 1, stat: a.stat || 'FOR', deg: a.deg || '', red: '', mal: '', eff: a.eff || '', porte: '', src: a.src }));
    (o.armures || []).filter(a => plein(a.nom)).forEach(a => o.possessions.push({ id: nouvelId(), item: a.item, nom: a.nom, type: 'armure', empl: 'corps_dessus', qte: 1, stat: '', deg: '', red: a.red || '', mal: a.mal || '', eff: a.eff || '', porte: '', src: a.src }));
    (o.objets || []).filter(a => plein(a.nom)).forEach(a => o.possessions.push({ id: nouvelId(), item: a.item, nom: a.nom, type: a.conso ? 'consommable' : 'equipement', empl: '', qte: a.qte ?? 1, stat: '', deg: '', red: '', mal: '', eff: a.eff || '', porte: '', src: a.src }));
    // Ce qui était sur l'ancienne fiche était « porté » : on équipe ce qui peut l'être, le reste va à l'inventaire
    const tmp = { possessions: o.possessions };
    o.possessions.filter(x => x.type === 'arme' && !x.porte).slice(0, 2).forEach((x, i) => equiper(tmp, x.id, i === 0 ? 'main_d' : 'main_g'));
    const arm = o.possessions.find(x => x.type === 'armure' && !x.porte); if (arm) equiper(tmp, arm.id);
    delete o.armes; delete o.armures; delete o.objets;
    o._converti = true;   // signale à la fiche qu'il faut enregistrer le nouveau format
  }
  // Valeurs par défaut et identifiants
  o.possessions.forEach(x => {
    if (!x.id) x.id = nouvelId();
    if (x.porte == null) x.porte = '';
    if (x.empl == null) x.empl = '';
    if (x.qte == null || x.qte === '') x.qte = 1;
    ['nom', 'stat', 'deg', 'red', 'mal', 'eff'].forEach(k => { if (x[k] == null) x[k] = ''; });
    if (!x.type) x.type = 'equipement';
  });
  return o;
}
