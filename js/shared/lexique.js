/* =====================================================================
   Lexique de l'ancien langage (table « lexique »)
   Lecture pour tous les joueurs connectés (sauf mots masqués),
   modification réservée au MJ.
   ===================================================================== */
import { sb } from '../core/supabase.js';

let cache = null, enCours = null;
const ordre = (a, b) => a.fr.localeCompare(b.fr, 'fr');

export const lexique = {
  /* Liste des mots { id, fr, ancien, categorie, notes, visible } — chargée une fois par visite */
  async lister({ forcer = false } = {}) {
    if (cache && !forcer) return cache;
    if (!enCours || forcer) enCours = sb.from('lexique').select('id, fr, ancien, categorie, notes, visible').then(({ data, error }) => {
      enCours = null;
      if (error) throw error;
      cache = (data || []).sort(ordre);
      return cache;
    });
    return enCours;
  },
  oublier() { cache = null; },
  async enregistrer(mot) {
    const { id, ...champs } = mot;
    const q = id ? sb.from('lexique').update(champs).eq('id', id) : sb.from('lexique').insert(champs);
    const { data, error } = await q.select('id, fr, ancien, categorie, notes, visible').maybeSingle();
    if (error) throw error;
    cache = null; return data;
  },
  async supprimer(id) {
    const { error } = await sb.from('lexique').delete().eq('id', id);
    if (error) throw error;
    cache = null;
  },
};

/* Recherche tolérante : sans accents ni majuscules, sur le sens ou le mot ancien */
export const sansAccent = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function chercher(mots, q) {
  const t = sansAccent(q).trim(); if (!t) return mots;
  return mots.filter(m => sansAccent(m.fr).includes(t) || sansAccent(m.ancien).includes(t));
}
