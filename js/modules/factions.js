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
const SCEAU = `<svg class="big" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width=".8" aria-hidden="true"><circle cx="20" cy="20" r="18"/><circle cx="20" cy="20" r="15.6" stroke-dasharray="1.6 2.4" pathLength="100"/><path d="M20 7.5 L25 9.3 V13.6 Q25 17.4 20 19.4 Q15 17.4 15 13.6 V9.3 Z"/><path d="M13.2 20.2 L17.7 21.8 V25.4 Q17.7 28.8 13.2 30.6 Q8.7 28.8 8.7 25.4 V21.8 Z" opacity=".7"/><path d="M26.8 20.2 L31.3 21.8 V25.4 Q31.3 28.8 26.8 30.6 Q22.3 28.8 22.3 25.4 V21.8 Z" opacity=".7"/><circle cx="20" cy="13.4" r="1.5" fill="currentColor"/></svg>`;

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
