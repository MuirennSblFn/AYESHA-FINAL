/* =====================================================================
   Règles d'Ayesha — données partagées par tous les modules
   (fiche, et plus tard armurerie, centre de formation…)
   ===================================================================== */

export const STATS = [
  { k: 'INT', n: 'Intelligence', d: 'savoir, éducation' },
  { k: 'DEX', n: 'Dextérité', d: 'doigts, souplesse' },
  { k: 'FOR', n: 'Force', d: 'endurance, effort' },
  { k: 'PER', n: 'Perception', d: 'sens' },
  { k: 'CHA', n: 'Charisme', d: 'aisance sociale' },
];

export const CLASSES = {
  magicien: { nom: 'Magicien', desc: "Assemble les Mots de l'ancien langage pour jeter des sorts.", voies: [
    { k: 'maitrise', l: '+1 à la maîtrise générale' }, { k: 'mot', l: '+3 sur un mot précis', cible: 'mot' }, { k: 'pm', l: '+3 points de magie' }] },
  devin: { nom: 'Devin', desc: "Lit l'avenir dans les lames du Tarot et infléchit les dés.", voies: [
    { k: 'devoiler', l: 'Dévoiler une carte avant de choisir' }, { k: 'remplacer', l: 'Remettre une carte et en repiocher une' }, { k: 'recuperer', l: 'Récupérer une carte défaussée' }] },
  sorcier: { nom: 'Sorcier', desc: 'Sacrifie sa chair, son sang et ses souvenirs à la Magie.', voies: [
    { k: 'partie', l: '+2 sur une partie du corps', cible: 'partie' }, { k: 'reutil', l: 'Réutiliser un sacrifice temporaire', cible: 'partie' }, { k: 'pv', l: '+3 points de vie' }] },
  portesac: { nom: 'Portesac', desc: 'Tire des objets magiques de son Sac, au gré du dé.', voies: [
    { k: 'dupliquer', l: 'Dupliquer un numéro (1 PM par copie)' }, { k: 'tirages', l: 'Tirer plusieurs objets et choisir (1 PM par objet)' }, { k: 'echange', l: 'Changer définitivement un objet du sac', cible: 'texte' }] },
};
export const VOIE = {};
Object.entries(CLASSES).forEach(([c, o]) => o.voies.forEach(v => VOIE[v.k] = { ...v, classe: c }));

export const CORPS = [['I', 'Doigts', 2], ['II', 'Mains', 4], ['III', 'Bras', 6], ['IV', 'Pieds', 4], ['V', 'Jambes', 6], ['VI', 'Œil', 6], ['VII', 'Oreilles', 6], ['VIII', 'Langue', 5], ['IX', 'Sexe', 10], ['X', 'Reins', 10], ['XI', 'Cœur', 12], ['XII', 'Souvenirs', 6], ['XIII', 'Âme', 12]];

export const SAC = [
  ['Épée courte qui clignote', 'Lampe torche', 'Escabeau en bois (pliable mais encombrant)'],
  ['Arc court avec 15 flèches', "Gourde d'eau fraîche", 'Mitrailleuse'],
  ["Masse d'armes avec bruit de poulet en caoutchouc", 'Corde de 200 m', 'Parasol géant multicolore'],
  ['Arbalète de poing avec 15 carreaux', 'Sac de couchage douillet', 'Piano jouet'],
  ['Lasso multi-prise', 'Coffret de premiers secours', 'Briquet-tempête'],
  ["Chèvre vivante miniature (taille d'un chiot)", 'Grimoire de recettes de cuisine', 'Paravent pliant taille humaine'],
  ['Lance phosphorescente', 'Jumelles de vision nocturne', 'Bouclier rond'],
  ['Hache de guerre chantante', 'Caisse de ration militaire', 'Canapé deux places'],
  ['Revolver ancien à balles nationaliste', 'Boussole', 'Guitare sèche'],
  ['Chaîne en acier', 'Trousse de bricolage complète', 'Arbre en pot'],
  ['Taille-haie à essence', 'Livre de poche au choix', 'Parapluie énorme et indestructible'],
  ['Tronçonneuse', 'Tente de camping qui se déploie toute seule', "Statue en or d'1 m 80"],
];

export const COUT = { 1: 8, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10 };
export const DIFF = { 1: 7, 2: 10, 3: 13, 4: 16, 5: 18, 6: 20 };
export const DIFF_TXT = { 1: 'Très vague, la magie interprète largement', 2: 'Sort simple (action + effet)', 3: 'Sort plus précis (action + effet + direction)', 4: 'Sort complexe ou conditionné', 5: 'Invocation longue, très précise', 6: 'Rituel ou prouesse magique exceptionnelle' };

export const TALENTS = ['Forcer une porte', 'Porter une charge sans fatigue', 'Briser un lien à mains nues', 'Nager en milieu hostile', 'Grimper sans équipement', 'Lire sur les lèvres', 'Reconnaître une odeur ou un goût', 'Suivre une piste simple', 'Repérer une cachette', 'Noter un détail anormal', 'Lire une carte', 'Faire des nœuds marins', 'Reconnaître une langue étrangère', "Évaluer la valeur d'un objet", 'Citer une règle obscure', 'Chanter juste', 'Donner un ordre crédible', 'Mentir sans rougir', 'Désamorcer un conflit verbal', 'Connaître les usages sociaux', 'Crocheter une serrure simple', 'Dessiner avec précision', 'Jongler avec des objets', 'Équilibrer ton corps sur une surface instable', 'Lancer avec précision', 'Se cacher', 'Escalader'];

export const JAUGES = [['pv', 'PV', 'Points de vie'], ['pm', 'PM', 'Points de magie'], ['sm', 'SM', 'Santé mentale'], ['ch', 'Ch', 'Chance']];

export const d6 = () => 1 + Math.floor(Math.random() * 6);
