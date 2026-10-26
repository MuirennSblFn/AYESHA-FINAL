/* =====================================================================
   Module Factions (configuration du moteur js/shared/codex.js)
   ---------------------------------------------------------------------
   Les groupes qui croisent le chemin des Gris. Même fonctionnement que le
   Grimoire : partie joueurs / dossier du MJ, sections révélées une à une,
   publication immédiate, observations des joueurs, entente sur 10.
   Adresses : #/factions/<id>   #/factions/<id>/reecrire[/<section>]   #/factions/nouvelle
   ===================================================================== */
import { esc } from '../core/ui.js';
import { creerCodex, jauge } from '../shared/codex.js';
import { NATURES, TYPES, RAPPORTS, CONNAISSANCE, ENTENTE_MAX, SECTIONS_J, SECTIONS_MJ, factions } from '../shared/factions.js';
import { grimoire } from '../shared/grimoire.js';

const pips = c => { const i = CONNAISSANCE.indexOf(c); return `<span class="kpips" title="Connaissance : ${esc(c || 'non précisée')}">${CONNAISSANCE.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span>`; };
const typeLabel = e => e.type === 'Autre' ? (e.typeAutre || 'Autre') : (e.type || '');
const natureType = e => [e.nature, typeLabel(e)].filter(Boolean).join(' · ');
const rapport = e => e.rapport ? `<span class="rapport r-${esc(RAPPORTS.indexOf(e.rapport))}">${esc(e.rapport)}</span>` : '';
const aEntente = e => e.entente !== '' && e.entente != null;

/* Sceau de la page d'accueil des Factions : trois blasons liés */
const SCEAU = `<svg class="big" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width=".8" aria-hidden="true"><circle cx="20" cy="20" r="18"/><circle cx="20" cy="20" r="14" stroke-dasharray="1.5 2.5"/><path d="M20 7 L26 9.5 V14 Q26 18 20 20 Q14 18 14 14 V9.5 Z"/><path d="M11 20 L17 22.5 V27 Q17 31 11 33 Q5 31 5 27 V22.5 Z" opacity=".7" transform="translate(2 -1)"/><path d="M29 20 L35 22.5 V27 Q35 31 29 33 Q23 31 23 27 V22.5 Z" opacity=".7" transform="translate(-2 -1)"/><circle cx="20" cy="13.5" r="1.6" fill="currentColor"/></svg>`;

export default creerCodex({
  id: 'factions',
  titre: 'Factions',
  nav: { label: 'Factions', ordre: 12 },
  carte: { titre: 'Factions', texte: 'Les groupes, ordres et cours qui croisent le chemin des Gris : alliés, rivaux, ennemis.' },
  depot: factions, SJ: SECTIONS_J, SM: SECTIONS_MJ, sceau: SCEAU,

  /* Listes auxquelles les fiches peuvent renvoyer (sections « Liens avec le Grimoire », « Alliances & rivalités ») */
  refs: { grimoire: { depot: grimoire, base: '#/grimoire/' }, factions: { depot: 'soi', base: '#/factions/' } },

  entete: [
    { k: 'autresNoms', l: 'Autres noms (surnoms, couverture, nom dans l’ancien langage)', t: 'text' },
    { k: 'nature', l: 'Nature', t: 'radio', o: NATURES, demi: true },
    { k: 'rapport', l: 'Rapport aux Gris', t: 'radio', o: RAPPORTS, demi: true },
    { k: 'type', l: 'Type de groupe', t: 'radio', o: TYPES },
    { k: 'typeAutre', l: 'Si « Autre » : lequel ?', t: 'text' },
    { k: 'connaissance', l: 'Niveau de connaissance', t: 'radio', o: CONNAISSANCE, demi: true },
    { k: 'entente', l: `Entente avec les Gris (sur ${ENTENTE_MAX})`, t: 'jauge', max: ENTENTE_MAX, demi: true },
    { k: 'embleme', l: 'Emblème', t: 'text', ph: 'à quoi ressemble leur symbole, leur blason, leur signe…' },
  ],
  defauts: { connaissance: 'Rumeur' },
  metaAffiche: e => [
    natureType(e) && `<span><b>${esc(natureType(e))}</b></span>`,
    e.rapport && `<span>Rapport aux Gris ${rapport(e)}</span>`,
    aEntente(e) && `<span>Entente ${jauge(e.entente, ENTENTE_MAX)} <b>${esc(e.entente)}/${ENTENTE_MAX}</b></span>`,
    `<span>Connaissance ${pips(e.connaissance)} <b>${esc(e.connaissance || 'non précisée')}</b></span>`,
  ],
  sousEnTete: e => e.embleme ? `<p class="embleme"><span>Emblème</span> ${esc(e.embleme)}</p>` : '',
  ligneDiscord: e => [natureType(e), e.rapport && `Rapport aux Gris : ${e.rapport}`, aEntente(e) && `Entente : ${e.entente}/${ENTENTE_MAX}`].filter(Boolean).join(' · '),
  sousTitre: e => [natureType(e), e.rapport].filter(Boolean).join(' · '),
  coin: e => aEntente(e) ? `<span class="entente-mini" title="Entente ${esc(e.entente)}/${ENTENTE_MAX}">${esc(e.entente)}<small>/${ENTENTE_MAX}</small></span>` : pips(e.connaissance),
  filtre: { k: 'rapport', options: RAPPORTS },

  /* Note rapide (vue MJ) et observations versées : dans l'Historique avec les Gris */
  noteRapide: { section: 'historique', champ: 'historique', quiPh: 'Qui (personnage, groupe…)', textePh: 'Ce qui s’est passé avec cette faction…', bouton: 'Consigner l’événement', ligne: (date, qui, texte) => ({ date, qui, texte, entente: '' }) },

  T: {
    ouverture: 'Ouverture du registre des factions…', eyebrow: 'FACTION', nouvelle: 'Nouvelle faction', reecrire: 'Réécrire la fiche',
    sceller: 'Sceller la fiche', scellee: 'Fiche scellée', effacer: 'Effacer la faction', effacee: 'Faction effacée',
    nomPh: 'Nom de la faction', publier: 'Publier cette faction pour les joueurs',
    partieJ: 'Ce que savent les Gris', partieM: 'Dossier du MJ', partieMRevelee: 'Ce que le Maître a révélé',
    muet: 'Les Gris ne savent encore rien de cette faction.',
    singulierCourt: 'faction', plurielCourt: 'factions', sommaireVide: "Aucune faction répertoriée pour l'instant.",
    consignee: 'FACTION RÉPERTORIÉE', consignees: 'FACTIONS RÉPERTORIÉES',
    ouvert: 'Le registre des factions', scelle: 'Le registre est encore vide',
    accueilMJ: 'Choisissez une faction dans le sommaire, ou répertoriez-en une nouvelle. Ce que vous publiez est visible des joueurs immédiatement.',
    accueilJoueur: 'Choisissez une faction dans le sommaire pour lire ce que les Gris en savent.',
    scelleTexte: 'Aucune faction n’y a encore été répertoriée. Le MJ les ajoutera au fil des scénarios.',
    vierge: 'Le registre est vierge', premiere: 'Répertorier une faction',
    viergeTexte: 'Aucune faction n’est encore répertoriée. Chaque fiche suit le même canevas : ce que savent les Gris, puis le dossier du MJ, que vous révélez section par section.',
    obsIntro: 'Ce que votre personnage a vu, appris ou vécu avec cette faction.', obsDestination: 'à l’historique de la faction', obsDestinationCourte: 'l’historique',
  },
});
