/* =====================================================================
   Factions : canevas des fiches et accès aux données
   ---------------------------------------------------------------------
   Tables (supabase/schema.sql) : factions (MJ), factions_public (version
   joueurs, recalculée par la base), factions_observations.
   Si les sections, leurs champs ou l'en-tête changent ici, reporter le
   changement dans le déclencheur factions_sync de schema.sql.
   ===================================================================== */
import { creerDepot } from './codex.js';

export const NATURES = ['Humaine', 'Surnaturelle', 'Mixte'];
export const TYPES = ['Ordre', 'Secte', 'Cour', 'Meute', 'Clan', 'Institution', 'Réseau criminel', 'Autre'];
export const RAPPORTS = ['Allié', 'Neutre', 'Méfiant', 'Rival', 'Hostile'];
export const CONNAISSANCE = ['Rumeur', 'Partiel', 'Documenté', 'Complet'];
export const ENTENTE_MAX = 10;
export const AVANCEMENT_MAX = 6;

export const SECTIONS_J = [
  { id: 'presentation', t: 'Présentation', f: [{ k: 'presentation', t: 'area', rows: 4 }, { k: 'devise', l: 'Devise ou credo', t: 'text' }] },
  { id: 'brume', t: 'Rapport à la Brume', f: [{ k: 'savoir', l: 'Ce qu’ils savent de la Brume', t: 'radio', o: ['N’en savent rien', 'La soupçonnent', 'La connaissent', 'En font partie'] }, { k: 'brume', l: 'La subissent, l’exploitent, la protègent ?', t: 'area' }] },
  { id: 'equilibre', t: "Rapport à l'équilibre", f: [{ k: 'defendent', l: 'Ce qu’ils défendent', t: 'area' }, { k: 'bascule', l: 'Ce qui les ferait basculer', t: 'area' }] },
  { id: 'territoire', t: 'Territoire & repaires', f: [{ k: 'zone', l: 'Où ils opèrent', t: 'text', ph: 'quartiers, villes, région, hors du monde…' }, { k: 'repaires', l: 'Repaires connus', t: 'area' }] },
  { id: 'membres', t: 'Membres connus', f: [{ k: 'membres', t: 'rows', cols: [{ k: 'nom', l: 'Nom', w: '10em' }, { k: 'role', l: 'Rôle', w: '9em' }, { k: 'description', l: 'Description', w: '1fr', long: true }], add: 'Ajouter un membre' }] },
  { id: 'magie', t: 'Pratique de la magie', f: [{ k: 'pratiques', l: 'Pratiques', t: 'checks', o: ['Aucune', 'Ancien langage', 'Divination', 'Sacrifice', 'Artefacts', 'Magie propre à leur nature'] }, { k: 'magie', l: 'Précisions', t: 'area' }] },
  { id: 'signes', t: 'Signes de reconnaissance', s: "indices d'enquête", f: [{ k: 'signes', t: 'list', add: 'Ajouter un signe' }] },
  { id: 'services', t: "Ce qu'on peut obtenir d'eux", f: [{ k: 'services', t: 'rows', cols: [{ k: 'quoi', l: 'Information, service, objet…', w: '1fr', long: true }, { k: 'prix', l: 'À quel prix', w: '1fr', long: true }], add: 'Ajouter' }] },
  { id: 'rumeurs', t: 'Rumeurs non vérifiées', f: [{ k: 'rumeurs', t: 'area' }] },
  { id: 'historique', t: 'Historique avec les Gris', s: 'ajouté en fin de scénario', f: [{ k: 'historique', t: 'rows', notes: { qui: 'qui', texte: 'texte', extra: n => n.entente !== '' && n.entente != null ? ` · entente <b>${String(n.entente).replace(/[<&"]/g, '')}/10</b>` : '' }, cols: [{ k: 'date', l: 'Date', type: 'date', w: '9.5em' }, { k: 'qui', l: 'Qui', w: '9em' }, { k: 'texte', l: 'Ce qui s’est passé', w: '1fr', long: true }, { k: 'entente', l: 'Entente', type: 'jauge', max: ENTENTE_MAX, w: '5.5em' }], add: 'Ajouter un événement' }] },
];
export const SECTIONS_MJ = [
  { id: 'objectifs', mj: true, t: 'Objectifs réels', s: 'ce qu’ils cachent', f: [{ k: 'objectifs', t: 'area', rows: 4 }] },
  { id: 'organisation', mj: true, t: 'Organisation', f: [{ k: 'chef', l: 'Chef véritable', t: 'text' }, { k: 'effectifs', l: 'Effectifs', t: 'text' }, { k: 'hierarchie', l: 'Hiérarchie', t: 'area' }] },
  { id: 'ressources', mj: true, t: 'Ressources', s: 'argent, armes, influence, appuis', f: [{ k: 'ressources', t: 'area' }] },
  { id: 'plans', mj: true, t: 'Plans en cours', s: `avancement sur ${AVANCEMENT_MAX}`, f: [{ k: 'plans', t: 'rows', cols: [{ k: 'plan', l: 'Plan', w: '1fr', long: true }, { k: 'avancement', l: 'Avancement', type: 'jauge', max: AVANCEMENT_MAX, w: '6.5em' }, { k: 'consequence', l: 'Quand il aboutit', w: '1fr', long: true }], add: 'Ajouter un plan' }] },
  { id: 'entites', mj: true, t: 'Liens avec le Grimoire', f: [{ k: 'entites', t: 'rows', cols: [{ k: 'entite', l: 'Entité', type: 'ref', source: 'grimoire', w: '1fr' }, { k: 'lien', l: 'Lien (sert, dirige, combat…)', w: '1.3fr' }], add: 'Ajouter une entité' }] },
  { id: 'relations', mj: true, t: 'Alliances & rivalités', f: [{ k: 'relations', t: 'rows', cols: [{ k: 'faction', l: 'Faction', type: 'ref', source: 'factions', w: '1fr' }, { k: 'relation', l: 'Relation', w: '8em' }, { k: 'detail', l: 'Détail', w: '1.3fr', long: true }], add: 'Ajouter une faction' }] },
  { id: 'accroches', mj: true, t: 'Accroches de scénario', f: [{ k: 'accroches', t: 'list', add: 'Ajouter une accroche' }] },
  { id: 'secrets', mj: true, t: 'Secrets du MJ', f: [{ k: 'secrets', t: 'area', rows: 4 }] },
];

const META = ['nom', 'autresNoms', 'nature', 'type', 'typeAutre', 'rapport', 'connaissance', 'entente', 'embleme', 'maj'];
export const factions = creerDepot({ table: 'factions', tablePublique: 'factions_public', tableObs: 'factions_observations', meta: META, SJ: SECTIONS_J, SM: SECTIONS_MJ });
