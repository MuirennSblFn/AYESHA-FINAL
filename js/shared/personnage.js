/* =====================================================================
   Personnage : modèle de données, calculs et stockage en ligne
   ---------------------------------------------------------------------
   Un joueur = un compte = un personnage (table « characters »).
   Les autres modules (armurerie, formation…) passent par ce fichier
   pour lire ou modifier le personnage du joueur :

     const p = await personnage.charger();     // { data, updatedAt } ou null
     p.data.armes.push({...}); personnage.modifie(p.data);   // sauvegarde différée
   ===================================================================== */
import { sb } from '../core/supabase.js';
import { auth } from '../core/auth.js';
import { STATS, VOIE } from './regles.js';

export const FORMAT = 'ayesha-fiche-v1';
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const int = v => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };

/* ---------- Modèle ---------- */
export function vierge() {
  return {
    format: FORMAT, id: uid(), nom: '', joueur: '', classe: '', portrait: '',
    stats: { INT: '', DEX: '', FOR: '', PER: '', CHA: '' }, rolls: {}, joker: false, chance: '', chanceRoll: null,
    max: { pv: '', pm: '', sm: '' },          // valeurs maximales saisies à la main (vide = calculée)
    cur: { pv: null, pm: null, sm: null, ch: null },
    talents: [{ t: '', j: '' }, { t: '', j: '' }, { t: '', j: '' }],
    entente: Array.from({ length: 5 }, () => ({ nom: '', a: '', note: 6 })),
    armes: [{ nom: '', stat: 'FOR', deg: '', eff: '' }], armures: [],
    inventaire: '', apparence: '', histoire: '',
    progression: [], mots: [{ mot: '', sens: '' }, { mot: '', sens: '' }, { mot: '', sens: '' }], corps: {}, sac: Array(12).fill(''),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export function normaliser(c) {
  c = c && typeof c === 'object' ? c : {};
  const b = vierge(); const o = { ...b, ...c };
  ['stats', 'cur', 'corps', 'rolls', 'max'].forEach(k => o[k] = { ...b[k], ...(c[k] || {}) });
  ['talents', 'entente', 'armes', 'armures', 'progression', 'mots', 'sac'].forEach(k => { if (!Array.isArray(o[k])) o[k] = b[k]; });
  while (o.talents.length < 3) o.talents.push({ t: '', j: '' });
  while (o.entente.length < 5) o.entente.push({ nom: '', a: '', note: 6 });
  while (o.sac.length < 12) o.sac.push('');
  o.format = FORMAT;
  return o;
}

/* ---------- Calculs ---------- */
export const brut = (C, k) => { const n = int(C.stats[k]); return n == null ? null : Math.floor(n / 5); };
export const compte = (C, v) => C.progression.filter(p => p.voie === v && VOIE[v] && VOIE[v].classe === C.classe).length;
export const niveau = C => 1 + C.progression.length;
export const malusArmure = C => C.armures.reduce((s, a) => s + Math.abs(int(a.mal) || 0), 0);
export const bonusDegats = n => (n != null && n > 50) ? Math.floor((n - 50) / 10) : 0;

/* Maximums calculés par les règles (null si les caractéristiques manquent) */
export function maxCalcules(C) {
  const F = brut(C, 'FOR'), I = brut(C, 'INT'), P = brut(C, 'PER');
  const ip = (I != null && P != null) ? Math.floor((I + P) / 2) : null;
  return {
    pv: F != null ? F + 5 + (C.classe === 'sorcier' ? 3 * compte(C, 'pv') : 0) : null,
    pm: ip != null ? ip + 10 + (C.classe === 'magicien' ? 3 * compte(C, 'pm') : 0) : null,
    sm: ip,
    ch: int(C.chance),
  };
}
/* Maximums utilisés : la saisie manuelle l'emporte sur le calcul */
export function maxEffectifs(C) {
  const calc = maxCalcules(C);
  const m = { ...calc };
  ['pv', 'pm', 'sm'].forEach(k => { const v = int(C.max?.[k]); if (v != null) m[k] = Math.max(0, v); });
  return m;
}
export function actuel(C, k, max) {
  let cur = C.cur[k]; if (cur == null || cur > max) cur = max; if (cur < 0) cur = 0; return cur;
}
export function formule(C, k) {
  return {
    pv: 'FOR ÷ 5 + 5' + (C.classe === 'sorcier' && compte(C, 'pv') ? ` + ${3 * compte(C, 'pv')} (progression)` : ''),
    pm: 'moyenne (INT ÷ 5, PER ÷ 5) + 10' + (C.classe === 'magicien' && compte(C, 'pm') ? ` + ${3 * compte(C, 'pm')} (progression)` : ''),
    sm: 'moyenne (INT ÷ 5, PER ÷ 5)', ch: '3d6',
  }[k];
}
export { STATS };

/* ---------- Stockage en ligne ---------- */
const BROUILLON = id => 'ayesha.brouillon.' + id;
const ANCIEN_LS = 'ayesha.fiches.v1';     // fiches de l'ancien site, restées dans le navigateur

const etat = { uid: null, data: null, updatedAt: null, timer: null, enCours: null, statut: 'ok', ecouteurs: new Set(), conflit: null };

function notifier() { etat.ecouteurs.forEach(fn => { try { fn(etat.statut); } catch (e) {} }); }
function setStatut(s) { etat.statut = s; notifier(); }

export const personnage = {
  get statut() { return etat.statut; },
  get updatedAt() { return etat.updatedAt; },
  surStatut(fn) { etat.ecouteurs.add(fn); return () => etat.ecouteurs.delete(fn); },
  /* appelé quand la version en ligne a été modifiée ailleurs ; fn(versionEnLigne) */
  surConflit(fn) { etat.conflit = fn; },

  /* Charge le personnage du joueur connecté (avec cache). */
  async charger({ forcer = false } = {}) {
    const id = auth.user?.id; if (!id) return null;
    if (!forcer && etat.uid === id && etat.data) return { data: etat.data, updatedAt: etat.updatedAt };
    const { data: row, error } = await sb.from('characters').select('data, updated_at').eq('owner', id).maybeSingle();
    if (error) throw error;
    etat.uid = id;
    etat.data = row ? normaliser(row.data) : null;
    etat.updatedAt = row ? row.updated_at : null;
    return etat.data ? { data: etat.data, updatedAt: etat.updatedAt } : null;
  },

  /* Fiches laissées dans ce navigateur par l'ancien site « Fiches des Gris » */
  anciennesFiches() {
    try { const d = JSON.parse(localStorage.getItem(ANCIEN_LS) || 'null'); return d && d.chars ? Object.values(d.chars).map(normaliser) : []; }
    catch (e) { return []; }
  },

  /* Modifications non envoyées lors d'une visite précédente */
  brouillon() {
    try { return JSON.parse(localStorage.getItem(BROUILLON(auth.user?.id)) || 'null'); } catch (e) { return null; }
  },
  oublierBrouillon() { try { localStorage.removeItem(BROUILLON(auth.user?.id)); } catch (e) {} },

  /* Signale une modification : copie locale immédiate, envoi en ligne différé. */
  modifie(data) {
    etat.data = data; data.updatedAt = new Date().toISOString();
    try { localStorage.setItem(BROUILLON(etat.uid), JSON.stringify({ base: etat.updatedAt, data })); } catch (e) {}
    setStatut('attente');
    clearTimeout(etat.timer); etat.timer = setTimeout(() => this.envoyer(), 900);
  },

  /* Remplace entièrement le personnage (import, fiche vierge…) et l'envoie tout de suite. */
  async remplacer(data, { ecraser = false } = {}) {
    etat.data = normaliser(data);
    clearTimeout(etat.timer);
    return this.envoyer({ ecraser });
  },

  /* Envoi en ligne. Détecte une modification faite entre-temps depuis un autre appareil. */
  async envoyer({ ecraser = false } = {}) {
    clearTimeout(etat.timer); etat.timer = null;
    if (!etat.data || !etat.uid) return;
    if (etat.enConflit && !ecraser) return;          // en attente du choix du joueur
    if (etat.enCours) {
      if (!ecraser) { etat.timer = setTimeout(() => this.envoyer(), 400); return; }
      await etat.enCours.catch(() => {});
    }
    const data = etat.data;
    setStatut('envoi');
    const run = (async () => {
      let res;
      if (!etat.updatedAt) {
        res = await sb.from('characters').insert({ owner: etat.uid, data }).select('updated_at').maybeSingle();
        if (res.error && res.error.code === '23505') return this._conflit();   // déjà créé ailleurs
      } else if (ecraser) {
        res = await sb.from('characters').update({ data }).eq('owner', etat.uid).select('updated_at').maybeSingle();
      } else {
        res = await sb.from('characters').update({ data }).eq('owner', etat.uid).eq('updated_at', etat.updatedAt).select('updated_at').maybeSingle();
        if (!res.error && !res.data) return this._conflit();
      }
      if (res.error) throw res.error;
      etat.updatedAt = res.data.updated_at;
      if (etat.data === data) { this.oublierBrouillon(); setStatut('ok'); }
      else { // modifié pendant l'envoi : renvoyer
        try { localStorage.setItem(BROUILLON(etat.uid), JSON.stringify({ base: etat.updatedAt, data: etat.data })); } catch (e) {}
        setStatut('attente'); etat.timer = setTimeout(() => this.envoyer(), 300);
      }
    })();
    etat.enCours = run;
    try { await run; }
    catch (e) {
      console.error(e); setStatut('erreur');
      clearTimeout(etat.timer); etat.timer = setTimeout(() => this.envoyer(), 10000);
    } finally { if (etat.enCours === run) etat.enCours = null; }
  },

  async _conflit() {
    etat.enConflit = true;
    setStatut('conflit');
    const { data: row } = await sb.from('characters').select('data, updated_at').eq('owner', etat.uid).maybeSingle();
    if (etat.conflit) etat.conflit(row ? { data: normaliser(row.data), updatedAt: row.updated_at } : null);
  },
  /* Résolution d'un conflit */
  async garderLaMienne(enLigne) { etat.enConflit = false; etat.updatedAt = enLigne?.updatedAt || etat.updatedAt; return this.envoyer({ ecraser: true }); },
  prendreEnLigne(enLigne) { etat.enConflit = false; clearTimeout(etat.timer); etat.data = enLigne.data; etat.updatedAt = enLigne.updatedAt; this.oublierBrouillon(); setStatut('ok'); return etat.data; },

  /* Vider le cache à la déconnexion */
  reinitialiser() { clearTimeout(etat.timer); Object.assign(etat, { uid: null, data: null, updatedAt: null, timer: null, statut: 'ok', enConflit: false }); },

  /* ----- MJ : tous les joueurs et leurs fiches ----- */
  async tousLesJoueurs() {
    const { data, error } = await sb.from('profiles').select('id, display_name, avatar_url, role, characters(data, updated_at)').order('display_name');
    if (error) throw error;
    return (data || []).map(p => {
      const ch = Array.isArray(p.characters) ? p.characters[0] : p.characters;
      return { id: p.id, nom: p.display_name, avatar: p.avatar_url, role: p.role, perso: ch ? normaliser(ch.data) : null, updatedAt: ch?.updated_at || null };
    });
  },
  async ficheDe(id) {
    const { data, error } = await sb.from('profiles').select('id, display_name, avatar_url, characters(data, updated_at)').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const ch = Array.isArray(data.characters) ? data.characters[0] : data.characters;
    return { id: data.id, nom: data.display_name, avatar: data.avatar_url, perso: ch ? normaliser(ch.data) : null, updatedAt: ch?.updated_at || null };
  },
};

auth.onChange(() => { if (etat.uid !== (auth.user?.id || null)) personnage.reinitialiser(); });
