/* =====================================================================
   Grimoire de la Brume : canevas des entrées et accès aux données
   ---------------------------------------------------------------------
   Tables (supabase/schema.sql) :
   - grimoire            exemplaire du MJ (entrée + profil technique), MJ seulement
   - grimoire_public     version joueurs, recalculée par la base à chaque modification
   - grimoire_observations  observations proposées par les joueurs
   Si la liste des sections ou de leurs champs change ici, reporter le
   changement dans la fonction grimoire_publier() de schema.sql.
   ===================================================================== */
import { sb } from '../core/supabase.js';

export const FAMILLES = ['Fée / petit peuple', 'Mort-vivant', 'Métamorphe', 'Démon', 'Esprit / fantôme', 'Bête mythique', 'Autre'];
export const CONNAISSANCE = ['Rumeur', 'Partiel', 'Documenté', 'Complet'];
export const STATS = ['INT', 'DEX', 'FOR', 'PER', 'CHA'];
export const EXTRA = [{ k: 'pv', l: 'PV' }, { k: 'armure', l: 'Armure', hint: 'réduction / coup' }, { k: 'pm', l: 'PM' }, { k: 'volonte', l: 'Volonté', hint: '/20' }];

export const SECTIONS_J = [
  { id: 'desc', t: 'Description', f: [{ k: 'apparence', l: 'Apparence réelle', t: 'area' }, { k: 'taille', l: 'Taille / carrure', t: 'text' }] },
  { id: 'brume', t: 'Sous la Brume', f: [{ k: 'percu', l: 'Ce que perçoivent les humains', t: 'area' }, { k: 'explication', l: 'Explication rationnelle habituelle', t: 'area', ph: 'fait divers, accident, crime passionnel…' }] },
  { id: 'origines', t: 'Origines & mythologie', f: [{ k: 'origines', t: 'area', rows: 5 }] },
  { id: 'habitat', t: 'Habitat & territoire', f: [{ k: 'milieux', l: 'Milieu', t: 'checks', o: ['Urbain', 'Rural', 'Sauvage', 'Souterrain', 'Aquatique', 'Hors du monde'] }, { k: 'lieux', l: 'Lieux typiques', t: 'area' }] },
  { id: 'moeurs', t: 'Mœurs & comportement', f: [{ k: 'activite', l: 'Activité', t: 'text', ph: 'jour, nuit, cycle lunaire…' }, { k: 'social', l: 'Solitaire, meute ou société organisée', t: 'text' }, { k: 'alimentation', l: 'Alimentation / besoins', t: 'text' }, { k: 'communication', l: 'Communication', t: 'text', ph: 'parle ? quelle langue ? ancien langage ?' }] },
  { id: 'equilibre', t: "Rapport à l'équilibre", f: [{ k: 'attitude', l: 'Attitude envers les humains', t: 'radio', o: ['Hostile', 'Indifférente', 'Ambiguë', 'Bienveillante'] }, { k: 'bascule', l: "Ce qui la fait basculer hors de l'équilibre", t: 'area' }] },
  { id: 'signes', t: 'Signes de présence', s: "indices d'enquête", f: [{ k: 'signes', t: 'list', add: 'Ajouter un signe' }] },
  { id: 'faiblesses', t: 'Faiblesses connues', f: [{ k: 'faiblesses', t: 'area' }] },
  { id: 'protections', t: 'Protections & remèdes', f: [{ k: 'prevenir', l: "Pour s'en prémunir", t: 'area' }, { k: 'repousser', l: "Pour la repousser, l'apaiser ou la neutraliser", t: 'area' }] },
  { id: 'rumeurs', t: 'Rumeurs non vérifiées', f: [{ k: 'rumeurs', t: 'area' }] },
  { id: 'notes', t: 'Notes des Gris', s: 'ajoutées en fin de scénario', f: [{ k: 'notes', t: 'rows', cols: [{ k: 'date', l: 'Date', type: 'date', w: '9.5em' }, { k: 'perso', l: 'Personnage', w: '10em' }, { k: 'texte', l: 'Note', w: '1fr' }], add: 'Ajouter une note' }] },
];
export const SECTIONS_MJ = [
  { id: 'stats', mj: true, t: 'Caractéristiques', s: 'sur 1d100', f: [{ k: 'stats', t: 'stats' }] },
  { id: 'attaques', mj: true, t: 'Attaques', f: [{ k: 'attaques', t: 'rows', cols: [{ k: 'nom', l: 'Nom', w: '1fr' }, { k: 'stat', l: 'Stat testée', w: '6em' }, { k: 'degats', l: 'Dégâts', w: '6em' }, { k: 'effets', l: 'Effets supplémentaires', w: '1.4fr' }], add: 'Ajouter une attaque' }] },
  { id: 'reactions', mj: true, t: 'Réactions privilégiées', f: [{ k: 'reactions', t: 'checks', o: ['Esquive (DEX)', 'Parade (FOR)'] }, { k: 'reactionAutre', l: 'Autre réaction', t: 'text' }] },
  { id: 'pouvoirs', mj: true, t: 'Pouvoirs & capacités spéciales', f: [{ k: 'pouvoirs', t: 'area', rows: 4 }] },
  { id: 'vuln', mj: true, t: 'Vulnérabilités', f: [{ k: 'vArmes', l: 'Armes / matériaux efficaces', t: 'text' }, { k: 'vInefficaces', l: 'Armes inefficaces', t: 'text' }, { k: 'vMots', l: "Mots de l'ancien langage efficaces", t: 'text' }, { k: 'vAutres', l: 'Autres (lieux, objets, rituels, conditions)', t: 'area' }] },
  { id: 'resist', mj: true, t: 'Résistances & immunités', f: [{ k: 'resistances', t: 'area' }] },
  { id: 'sante', mj: true, t: 'Perte de Santé mentale', f: [{ k: 'smRencontre', l: 'À la première rencontre', t: 'text' }, { k: 'smPouvoirs', l: 'Face à ses pouvoirs / sa vraie forme', t: 'text' }] },
  { id: 'butin', mj: true, t: 'Butin & artefacts', s: "pour l'armurerie", f: [{ k: 'butin', t: 'area' }] },
  { id: 'mots', mj: true, t: "Mots de l'ancien langage à apprendre", f: [{ k: 'motsApprendre', t: 'area' }] },
  { id: 'secrets', mj: true, t: 'Secrets du MJ', s: 'ce que le Grimoire ignore ou déforme', f: [{ k: 'secrets', t: 'area', rows: 4 }] },
];
export const FIELDS = {};
[...SECTIONS_J, ...SECTIONS_MJ].forEach(s => s.f.forEach(f => { FIELDS[f.k] = f; }));
const META = ['nom', 'autresNoms', 'famille', 'familleAutre', 'connaissance', 'redacteur', 'maj'];

export const isEmpty = v => v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isEmpty));
/* Une section est-elle visible des joueurs ? Par défaut : partie joueurs oui, profil technique non. */
export const visOf = (entree, s) => (entree && entree.vis && typeof entree.vis[s.id] === 'boolean') ? entree.vis[s.id] : !s.mj;

/* Ligne de la table « grimoire » → entrée au format lecture { id, numero, publie, …meta, secJ, secM, j, m, vis, entree, profil } */
export function versLecture(r, { commeJoueur = false } = {}) {
  const e = r.entree || {}, p = r.profil || {};
  const sJ = SECTIONS_J.filter(s => !commeJoueur || visOf(e, s)), sM = SECTIONS_MJ.filter(s => !commeJoueur || visOf(e, s));
  const j = {}, m = {};
  sJ.forEach(s => s.f.forEach(f => { if (f.k in e) j[f.k] = e[f.k]; }));
  sM.forEach(s => s.f.forEach(f => { if (f.k in p) m[f.k] = p[f.k]; }));
  const out = { id: r.id, numero: r.numero, publie: !!r.publie, secJ: sJ.map(s => s.id), secM: sM.map(s => s.id), j, m, entree: e, profil: p, updated_at: r.updated_at };
  META.forEach(k => { out[k] = e[k] || ''; });
  return out;
}

/* Entrée d'une publication « grimoire-brume-v1 » (ancien grimoire.json) → ligne de la table */
export function depuisPublication(x) {
  const entree = {}; META.forEach(k => { entree[k] = x[k] || ''; });
  Object.assign(entree, x.j || {});
  entree.vis = {};
  SECTIONS_J.forEach(s => { entree.vis[s.id] = (x.secJ || []).includes(s.id); });
  SECTIONS_MJ.forEach(s => { entree.vis[s.id] = (x.secM || []).includes(s.id); });
  return { id: x.id, numero: parseInt(x.numero, 10) || null, publie: true, entree, profil: x.m || {} };
}

const trier = (a, b) => (+a.numero || 1e9) - (+b.numero || 1e9) || String(a.nom).localeCompare(String(b.nom), 'fr');

export const grimoire = {
  /* Version joueurs (tout le monde, connecté ou non). Repli sur grimoire.json tant que la base n'est pas prête. */
  async lirePublic() {
    const { data, error } = await sb.from('grimoire_public').select('id, numero, data, updated_at');
    if (!error && data && data.length) return { entries: data.map(r => ({ ...r.data, updated_at: r.updated_at })).sort(trier), source: 'base' };
    // Base pas encore prête ou encore vide (transition) : ancien fichier grimoire.json s'il existe
    const r = await fetch('grimoire.json', { cache: 'no-store' }).catch(() => null);
    if (!r || !r.ok) { if (!error) return { entries: [], source: 'base' }; throw error; }
    const d = await r.json();
    return { entries: (d.entries || []).sort(trier), source: 'fichier', publishedAt: d.publishedAt };
  },
  /* Exemplaire du MJ : toutes les entrées, brouillons et profils techniques compris */
  async lireMJ() {
    const { data, error } = await sb.from('grimoire').select('id, numero, publie, entree, profil, updated_at');
    if (error) throw error;
    return (data || []).map(r => versLecture(r)).sort(trier);
  },
  async enregistrer({ id, numero, publie, entree, profil }) {
    const champs = { numero: numero ?? null, publie: !!publie, entree, profil };
    const q = id ? sb.from('grimoire').update(champs).eq('id', id) : sb.from('grimoire').insert(champs);
    const { data, error } = await q.select('id, numero, publie, entree, profil, updated_at').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Entrée introuvable : a-t-elle été effacée ?');
    return versLecture(data);
  },
  async importer(lignes) {
    const { error } = await sb.from('grimoire').upsert(lignes, { onConflict: 'id' });
    if (error) throw error;
  },
  async supprimer(id) {
    const { error } = await sb.from('grimoire').delete().eq('id', id);
    if (error) throw error;
  },
};

export const observations = {
  /* Joueur : les siennes ; MJ : toutes */
  async lister() {
    const { data, error } = await sb.from('grimoire_observations').select('id, entree_id, owner, perso, date_obs, texte, created_at');
    if (error) return [];
    return (data || []).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  },
  async proposer({ entree_id, perso, date_obs, texte }) {
    const { data, error } = await sb.from('grimoire_observations').insert({ entree_id, perso, date_obs: date_obs || null, texte }).select('id, entree_id, owner, perso, date_obs, texte, created_at').maybeSingle();
    if (error) throw error;
    return data;
  },
  async retirer(id) {
    const { error } = await sb.from('grimoire_observations').delete().eq('id', id);
    if (error) throw error;
  },
};
