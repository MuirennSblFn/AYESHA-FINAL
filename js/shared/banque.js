/* =====================================================================
   Banque et catalogue de l'armurerie
   ---------------------------------------------------------------------
   Montants en centimes d'euro. Le solde n'est jamais stocké dans la fiche :
   il est la somme du relevé (table transactions), que seul le MJ peut
   alimenter (fonction mouvement) et que l'achat débite (fonction acheter).
   ===================================================================== */
import { sb } from '../core/supabase.js';
import { auth } from '../core/auth.js';

const FMT = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const euros = c => FMT.format((Number(c) || 0) / 100);
/* « 12,50 », « 12.5 », « 1 200 € » → centimes (null si illisible) */
export function lireEuros(s) {
  const t = String(s ?? '').replace(/[\s €]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}

export const CATEGORIES = {
  arme: { l: 'Armes', s: 'Arme' },
  armure: { l: 'Armures', s: 'Armure' },
  consommable: { l: 'Consommables', s: 'Consommable' },
  equipement: { l: 'Équipement', s: 'Équipement' },
  artefact: { l: 'Artefacts', s: 'Artefact' },
};

/* Message lisible à partir d'une erreur Supabase */
export const message = e => (e && (e.message || e.error_description)) || String(e || 'Erreur inconnue');

/* ---------- Abonnement temps réel (relevé et catalogue) ---------- */
const abonnes = new Set();
let canal = null, canalUid = null;
function brancher() {
  const uid = auth.user?.id || null;
  if (canal && canalUid === uid) return;
  if (canal) { try { sb.removeChannel(canal); } catch (e) {} canal = null; }
  canalUid = uid;
  if (!uid || !sb.channel) return;
  const filtreReleve = auth.isMJ ? {} : { filter: `owner=eq.${uid}` };
  canal = sb.channel('armurerie-' + uid)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', ...filtreReleve }, p => abonnes.forEach(fn => fn('transaction', p.new)))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, p => abonnes.forEach(fn => fn('item', p.new || p.old)))
    .subscribe();
}
auth.onChange(brancher);

export const banque = {
  /* fn(type, ligne) avec type = 'transaction' | 'item' ; renvoie la fonction de désabonnement */
  ecouter(fn) { brancher(); abonnes.add(fn); return () => abonnes.delete(fn); },
  _emettre(type, row) { abonnes.forEach(fn => fn(type, row)); },

  async releve(owner = auth.user?.id) {
    const { data, error } = await sb.from('transactions').select('id, owner, montant, motif, item_id, created_at').eq('owner', owner).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  async solde(owner = auth.user?.id) {
    return (await this.releve(owner)).reduce((s, t) => s + Number(t.montant), 0);
  },
  /* MJ : soldes de tous les joueurs { owner: centimes } */
  async tousLesSoldes() {
    const { data, error } = await sb.from('transactions').select('owner, montant');
    if (error) throw error;
    const s = {}; (data || []).forEach(t => s[t.owner] = (s[t.owner] || 0) + Number(t.montant)); return s;
  },
  async acheter(itemId, qte = 1) {
    const { data, error } = await sb.rpc('acheter', { p_item: itemId, p_qte: qte });
    if (error) throw error;
    this._emettre('transaction', null);
    return data;
  },
  async mouvement(joueur, montant, motif) {
    const { data, error } = await sb.rpc('mouvement', { p_joueur: joueur, p_montant: montant, p_motif: motif });
    if (error) throw error;
    this._emettre('transaction', null);
    return data;
  },
};

export const catalogue = {
  async lister() {
    const { data, error } = await sb.from('items').select('*').order('categorie').order('nom');
    if (error) throw error;
    return data || [];
  },
  async enregistrer(item) {
    const { id, created_at, ...champs } = item;
    const q = id ? sb.from('items').update(champs).eq('id', id) : sb.from('items').insert(champs);
    const { data, error } = await q.select('*').maybeSingle();
    if (error) throw error;
    banque._emettre('item', data);
    return data;
  },
  async supprimer(id) {
    const { error } = await sb.from('items').delete().eq('id', id);
    if (error) throw error;
    banque._emettre('item', null);
  },
};
