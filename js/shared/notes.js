/* =====================================================================
   Notes de session (table « notes ») : carnet personnel de chaque joueur.
   La base ne renvoie que les notes de la personne connectée.
   ===================================================================== */
import { sb } from '../core/supabase.js';

const COLS = 'id, titre, date_session, contenu, created_at, updated_at';

export const notes = {
  async lister() {
    const { data, error } = await sb.from('notes').select(COLS);
    if (error) throw error;
    return (data || []).sort(trier);
  },
  async creer(champs) {
    const { data, error } = await sb.from('notes').insert(champs).select(COLS).maybeSingle();
    if (error) throw error;
    return data;
  },
  async enregistrer(id, champs) {
    const { data, error } = await sb.from('notes').update(champs).eq('id', id).select(COLS).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Note introuvable (supprimée depuis un autre appareil ?)');
    return data;
  },
  async supprimer(id) {
    const { error } = await sb.from('notes').delete().eq('id', id);
    if (error) throw error;
  },
};

/* Plus récente session d'abord ; à date égale, la dernière créée d'abord */
export function trier(a, b) {
  const da = a.date_session || '', db = b.date_session || '';
  if (da !== db) return da < db ? 1 : -1;
  return (a.created_at || '') < (b.created_at || '') ? 1 : -1;
}

export const aujourdhui = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

export function dateLongue(iso) {
  if (!iso) return 'Sans date';
  const [y, m, j] = iso.split('-').map(Number);
  return new Date(y, m - 1, j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
