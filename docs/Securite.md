# Revue de sécurité — Pool.sol / Auction.sol / MRN.sol

Revue interne, lecture ligne à ligne des trois contrats de production
(`backend/contracts/`, Solidity 0.8.36, OpenZeppelin ^5.6.1, `viaIR`).
Les mocks (`MockReentrantBTC`, `MockMisbehavingBTC`) et `MrnFaucet` sont hors
périmètre de l'analyse, mais les suites qui les emploient sont référencées au
§6.

Contenu : §1 vue d'ensemble · §2–4 analyse par contrat · §5 constats ·
**§6 invariants testés (Foundry)** · **§7 scripts d'attaque**.

Légende : ✅ couvert · ⚠️ couvert mais résiduel assumé · ➖ sans objet.

## 1. Vue d'ensemble

| Faille | Pool | Auction | MRN |
|---|---|---|---|
| Réentrance | ✅ | ⚠️ | ➖ |
| Manipulation d'oracle | ➖ | ➖ | ➖ |
| Front-running | ⚠️ | ⚠️ | ➖ |
| Dépendance au timestamp | ⚠️ | ⚠️ | ➖ |
| Arrondis | ✅ | ✅ | ➖ |
| DoS / griefing | ✅ | ✅ | ➖ |
| Force feeding | ✅ | ✅ | ➖ |
| Attaque par donation | ✅ | ✅ | ➖ |
| send / transfer / call | ✅ | ✅ | ➖ |
| tx.origin | ✅ | ✅ | ✅ |

Aucun des trois contrats n'est upgradable, aucun n'a de proxy, aucun
n'expose `selfdestruct`, `delegatecall`, `assembly`, `block.number`,
`blockhash` ou une source d'aléa. Vérifié par recherche exhaustive sur les
trois fichiers : **zéro occurrence** de `tx.origin`, `.transfer(`, `.send(`,
`.call(`, `.call{`, `delegatecall`, `selfdestruct`, `block.number`.

## 2. Pool.sol

### Réentrance — ✅
- `ReentrancyGuard` (OZ) + `nonReentrant` sur les trois points d'entrée qui
  déplacent des fonds : `addLiquidity` (l.630), `removeLiquidity` (l.701),
  `swap` (l.740). C'est la correction **F4** : les trois fonctions écrivent
  les réserves avant leurs transferts, un jeton du panier muni d'un hook
  aurait pu re-entrer sur un état « crédité mais pas encore financé ».
  Le verrou est partagé, donc il couvre aussi la réentrance croisée
  (par ex. `swap` → `removeLiquidity`).
- Les trois fonctions de retrait (`claimManagerFees` l.795,
  `claimProtocolFees` l.808, `claimRent` l.954) n'ont pas le modificateur et
  n'en ont pas besoin : ce sont des tirages **pull-only, CEI strict** — le
  registre est remis à zéro avant le transfert. Une réentrance dans
  `claimRent` relit `rentDebt` déjà recalé (l.962) et `rentPending` à zéro,
  donc `owed == 0` → `ZeroRentOwed`.
- `notifyRent` (l.930) n'est pas verrouillé mais est réservé à l'Auction
  (l.931) et écrit tout son état avant le `safeTransferFrom` final (l.946).
- Le hook ERC20 `_update` (l.879) appelle `_updateRent()` : pendant un
  `addLiquidity`/`removeLiquidity`, une réentrance depuis ce hook retombe
  sur le verrou déjà pris.

### Oracle — ➖
Aucune lecture de prix externe. Le prix sort des réserves internes
(`_getAmountOut`, l.536) et la valeur d'une part LP est calculée sur les
réserves internes + `totalSupply()`, jamais sur `balanceOf`. Il n'y a donc
rien à manipuler de l'extérieur (cf. § donation).

### Front-running — ⚠️
- `swap` : `_minOut` (l.774) + bandes 13 %/53 % (l.767-772) + frais plafonnés
  à 0,5 %. Un sandwich reste possible — c'est inhérent à tout AMM — mais les
  bandes bornent l'impact d'un swap bien plus strictement qu'un `x·y=k` nu.
- `addLiquidity` : garde `_minShares` (l.651/662).
- `removeLiquidity` : garde `_minOut[3]` par jambe (l.708).
- `setFee` : réservé au gestionnaire de l'époque, une seule fois, dans une
  fenêtre de 240 s — pas de surface de front-running exploitable.

### Timestamp — ⚠️
`currentEpoch()` (l.433), la fenêtre prioritaire (l.572) et le flux de rente
(l.942) dérivent de `block.timestamp`. Sur Base, le séquenceur fixe
l'horodatage avec quelques secondes de latitude : au pire, un mandat est
perdu (et remboursé, cf. Auction) ou un `setFee` est repoussé d'une époque.
Aucun vol possible, pas de dépendance à une source manipulable à bas coût.

### Arrondis — ✅ (tous en faveur du pool)
| Calcul | Ligne | Sens |
|---|---|---|
| frais `Math.ceilDiv` | 746 | arrondi **supérieur** → pool |
| `amountOut = dx'·r_out/(dx'+r_in)` | 537 | arrondi **inférieur** → pool |
| jambes de dépôt `Math.ceilDiv` | 664-666 | **supérieur** → pool |
| `mintedShares` | 660 | **inférieur** → pool |
| `amountsOut[i]` (retrait) | 707 | **inférieur** → pool |
| `baseAmount`, `protocolCut` | 753-754 | **inférieur**, la poussière va au gestionnaire ou reste en réserve |
| rente `dt·rentRate/supply` | 830 | tronquée, la poussière reste dans le contrat |

`rentDebt` est recalé inconditionnellement après paiement (l.962) : la
troncature ne peut ni geler un solde ni le créditer deux fois.

Solvabilité exacte : `balance_du_contrat = Σréserves + ΣfeesOwed +
ΣprotocolFeesOwed`, car `amountInToReserves + managerCut + protocolCut ==
_amount` (l.757). Aucune dérive, aucun déficit possible.

### DoS — ✅
- Pas de boucle non bornée : tous les `for` sont `i < 3`.
- `pause()` ne ferme que `addLiquidity` et `swap` ; les sorties
  (`removeLiquidity`), `claimRent` et les deux tirages de frais restent
  ouverts : une mise en pause ne peut pas enfermer des fonds.
- La réserve du jeton de sortie ne peut jamais être vidée : `InsufficientReserve`
  exige `r_out > amountOut` (l.750), et les 1000 parts bloquées à l'adresse
  morte rendent `burned < supply` strictement, donc un retrait total laisse
  toujours une poussière.
- `getAmountOut` ne peut pas rendre 0 : garde `ZeroOutput` (l.749).
- Réserve : `pause()` est `onlyOwner` sans timelock — la centralisation
  assumée du projet, mais bornée à « geler les nouveaux flux ».

### Force feeding / donation — ✅
- **Aucun ETH** : pas de `receive`, pas de `fallback`, aucune lecture de
  `address(this).balance`. Un `selfdestruct` forcé n'a aucun effet.
- **Donation de jetons** : les réserves sont un compte interne
  (`_reservesPacked`, l.50), pas `balanceOf`. Envoyer du WBTC au pool ne
  déplace ni le prix, ni la valeur d'une part, ni le droit de retrait. C'est
  la propriété qui neutralise à la fois l'attaque par donation et
  l'inflation du prix de part des vaults ERC4626. Il n'y a pas de `skim` :
  les jetons envoyés par erreur sont définitivement bloqués (défensif).
- L'amorçage force le ratio 1:1:1 (l.652) : le premier déposant ne peut pas
  imposer un prix arbitraire. Ensuite, seuls les swaps déplacent les ratios,
  et ils sont bornés par les bandes.
- Les 1 000 parts `MINIMUM_LIQUIDITY` frappées à l'adresse morte (l.174)
  ajoutent deux propriétés de sécurité au-delà de la parade à l'inflation :
  `totalSupply()` ne peut plus jamais retomber à zéro — donc la branche
  d'amorçage 1:1:1 est **à usage unique**, il est impossible de refixer le
  taux après avoir vidé le pool — et un retrait total laisse toujours une
  poussière en réserve, ce qui interdit toute division par zéro côté swap.
  À noter que la parade est ici redondante : la jambe « donation » de
  l'attaque classique du premier déposant ne fonctionne de toute façon pas,
  puisque les réserves sont une comptabilité interne et non `balanceOf`.

### send / transfer / call — ✅
Aucun appel bas niveau, aucun transfert d'ETH. Tous les mouvements passent
par `SafeERC20.safeTransfer` / `safeTransferFrom` (OZ), qui gère les jetons
sans valeur de retour et exige `true` sinon. Arithmétique vérifiée par
défaut en 0.8 ; les blocs `unchecked` (l.405-427, 670-674, 759-762) ne
concernent que le (dé)paquetage des réserves, chacun précédé d'une garde
explicite `ReserveOverflow` / `InsufficientReserve`.

### tx.origin — ✅
Aucune occurrence. Toute l'autorisation est en `msg.sender` :
`onlyOwner`, `msg.sender == auction` (l.931), `msg.sender ==
managerOf[epoch]` (l.571), tirages payés à `msg.sender` ou à la `treasury`
immutable (l.118).

## 3. Auction.sol

### Réentrance — ⚠️ (sûr par dépendance, pas par construction)
- Aucun `ReentrancyGuard` dans ce fichier.
- `withdrawRefund` (l.337) est CEI strict : `refunds` remis à zéro avant le
  transfert.
- `placeBid` (l.294) crédite le remboursement (l.321) **puis** tire les MRN
  (l.325) **puis seulement** écrit `highBid`/`highBidder` (l.327).
- `_settle` (l.444) effectue trois appels externes — `burn` (l.461),
  `safeTransfer` de la récompense (l.463), `pool.notifyRent` (l.464) — et ne
  purge le slot `pending*` qu'**à la fin** (l.480-485).
- Les deux sont sans danger **uniquement parce que MRN est un ERC20 immuable
  sans hook** (ni ERC-777, ni ERC-1363) : `safeTransferFrom` ne rend pas la
  main à l'appelant. Filet de sécurité supplémentaire : même avec un MRN
  muni d'un hook, un double settlement réentrant serait arrêté par
  `Pool.setManager`, qui est « write-once » (`ManagerAlreadySet`).
- **Recommandation** (défense en profondeur) : ajouter `nonReentrant` à
  `placeBid` et `settle`, ou déplacer les écritures d'état avant les appels
  externes. Aucune exploitabilité avec le MRN déployé.

### Oracle — ➖
Aucun prix externe. L'horloge elle-même est figée au déploiement : `genesis`
et `epochDuration` sont copiés du Pool (l.227-228) pour que les deux
contrats ne puissent pas dériver. `pool.reserves(...)` n'est lu que pour
l'événement `Settled` (l.474-476) — aucune décision on-chain n'en dépend.

### Front-running — ⚠️
- Enchère ascendante ouverte : sniper dans le dernier bloc est possible.
  `maxExtension = 0` (l.233, module Ignition) donc la soft-close A1 n'est
  **pas** active ; `bidSilence` (60 s) n'est qu'une indication pour le bot,
  volontairement pas une garde (l.54-63). Le perdant est intégralement
  remboursé : le coût du sniping est nul pour lui, seule la rente attendue
  par les LP change de main.
- **F3** ferme la vraie faille : `settle()` exige désormais la fermeture de
  la fenêtre (l.395-396) avec la **même** expression stricte que le refus de
  `placeBid` (l.310-314). Phases d'enchère et de settlement sont disjointes
  → impossible de poser `minOpeningBid` et de consacrer dans la même
  transaction.
- `settle()` est permissionless et paie 0,1 % de la part LP à l'appelant
  (l.462). Se faire front-runner ne vole que cette récompense de keeper : le
  mandat va toujours à `pendingBidder` (l.466), jamais à l'appelant.

### Timestamp — ⚠️
`currentEpoch()` (l.245), `startOfEpoch` (l.279), `closesAt` (l.271) et la
branche d'expiration F1 (l.448) reposent sur `block.timestamp`. Une dérive de
séquenceur de quelques secondes peut faire basculer une époque un peu tôt :
la conséquence est un mandat perdu, et la branche F1 **rembourse** au lieu de
briquer (cf. DoS). Pas de perte de fonds.

### Arrondis — ✅
`min = highBid·11000/10000` (l.316) tronqué : l'incrément exigé est
marginalement plus petit (≤ 1 wei). `burnAmount` tronqué (l.459) → la part
brûlée est ≤ 30 % et la poussière va aux LP (`lpAmount = pendingAmount -
burnAmount`, pas de double troncature). `settleReward` tronqué (l.462).
Invariant de solvabilité respecté :
`MRN.balanceOf(auction) == Σrefunds + pendingAmount + highBid`, la
settlement dépensant exactement `burnAmount + settleReward + (lpAmount -
settleReward) = pendingAmount`.

### DoS — ✅
- **F1** supprime le brick définitif : un `pendingEpoch` expiré ou déjà
  pourvu est remboursé et purgé (l.448-457) au lieu de reverter
  `EpochAlreadyStarted`/`ManagerAlreadySet` avant la purge. Le MRN du
  gagnant n'est plus jamais captif.
- **F2** : `pendingBidder` est capturé en même temps que `pendingEpoch` et
  `pendingAmount` (l.301-303, 397-399), donc le bon gagnant est nommé.
- La capture par `settle()` **déplace** l'enchère vivante (l.400-401) : sans
  cette remise à zéro, un `sellingEpoch` périmé serait re-capturé à chaque
  appel et créditerait `refunds` en boucle.
- Aucune boucle, aucune itération non bornée.
- `closesAt()` revert par underflow tant que
  `sellingEpoch == 0` — état inatteignable dès lors qu'un `highBidder`
  existe. À documenter pour les appelants off-chain.

### Force feeding / donation — ✅
Pas d'ETH, pas de `receive`/`fallback`, pas de lecture de
`address(this).balance`. Les montants qui comptent (`highBid`,
`pendingAmount`, `refunds`) sont tous de la comptabilité interne : envoyer
du MRN au contrat ne change aucun prix de clearing, aucune enchère, aucun
droit. Pas de fonction de balayage → les MRN envoyés par erreur restent
bloqués (défensif).

### send / transfer / call — ✅
Aucun appel bas niveau, aucun ETH. `SafeERC20` partout. Un seul appel
direct à un contrat de confiance immuable : `ERC20Burnable(mrn).burn(...)`
(l.461) — dépendance dure à ce que MRN implémente `burn` (un MRN sans burn
briquerait tous les settlements).
L'approbation infinie du Pool au déploiement (l.239) est sans danger parce
que les deux contrats sont immuables et que `Pool.notifyRent` est réservé à
l'Auction ; à noter comme postulat de confiance.

### tx.origin — ✅
Aucune occurrence. `settle`, `withdrawRefund` et `placeBid` sont
permissionless par conception, mais paient toujours soit `msg.sender`, soit
`pendingBidder` capturé, soit un crédit `refunds[msg.sender]` — aucune
surface de hameçonnage `tx.origin`.

## 4. MRN.sol

ERC20 + `ERC20Burnable`, 25 lignes, sans propriétaire ni contrôle d'accès.
- **Réentrance** ➖ : aucun appel externe dans un changement d'état ; pas de
  hook (`_update` non surchargé), donc aucun callback sur `transfer`.
- **Oracle / timestamp / front-running** ➖ : le contrat ne lit ni prix, ni
  temps, ni état externe.
- **Arrondis** ➖ : `100000000·10**18` est exact ; `burn`/`burnFrom` sont ceux
  d'OZ, avec vérification d'allowance.
- **DoS** ➖ : pas de blacklist, pas de pause, pas de boucle non bornée.
- **Force feeding / donation** ➖ : solde pur, aucune logique n'en dépend.
- **send / transfer / call** ➖ : aucun ETH, aucun appel bas niveau.
- **tx.origin** ✅ : aucune occurrence.
- À noter (hors failles techniques) : 100 % de l'offre au déployeur, pas de
  vesting, pas de `permit` (EIP-2612), et `burnFrom` permet à un _spender_
  approuvé de brûler — comportement standard d'`ERC20Burnable`.

## 5. Points d'attention (nouveaux, hors périmètre F1–F8)

| # | Sévérité | Contrat | Constat |
|---|---|---|---|
| A | Faible | `Auction` | Le constructeur ne valide rien : pas de contrôle `auctionWindow < epochDuration`, ni `minOpeningBid > 0`, ni `_pool != 0`. `Pool` valide bien sa propre fenêtre (`PriorityWindowTooLong`, l.353), mais c'est la fenêtre de l'Auction qui porte la garde F3. Avec `auctionWindow >= epochDuration`, chaque settlement tombe dans la branche expirée → remboursement, aucun gestionnaire élu, enchère morte sans perte de fonds. Valeurs déployées saines (900 s ≪ 14400 s). |
| B | Info | `Pool` | Amorçage : `3·_amount - MINIMUM_LIQUIDITY` (l.650) underflow en panic 0x11 pour `_amount <= 333` au lieu d'une erreur métier (`BadSlippage`/`ZeroOutput`). Seuil = 334 unités soit 3,34e-6 BTC. |
| C | Faible (latent) | `Auction` | Ordre des écritures dans `placeBid` (transfert avant `highBid`/`highBidder`) et purge tardive du slot dans `_settle`. Sûr uniquement parce que MRN est immuable et sans hook ; filet : `Pool.setManager` write-once. Voir §3. |
| D | Info | `Auction` | `approve(pool, type(uint256).max)` (l.239) : postulat de confiance « Pool immuable ». À revoir si le Pool devient un jour upgradable. |
| E | Design | `Pool` | `get_dy` n'applique ni pause ni bandes : il peut coter un swap qui revertera. Documenté (l.543-547), à traiter comme une cotation Curve, pas comme une promesse d'exécution. La cotation est sinon bit-à-bit identique à l'exécution quand celle-ci est légale (même `ceilDiv`, même `_getAmountOut`). |
| E' | Info | `Pool` | `indexToAddress` rend `address(0)` pour un index > 2 au lieu de reverter. Sans gravité : l'accès suivant à `feesOwed[_][_tokenIndex]` (tableau `uint256[3]` de taille fixe) est borné par Solidity et reverte en panic 0x32 AVANT tout transfert. |
| F | Design | `Auction` | Pas de soft-close (`maxExtension = 0`) : l'enchère restera snipable jusqu'à l'activation de A1. |
| G | Faible | `Auction` | **MRN gelé par seconde réinitialisation portante.** Trois conditions cumulatives : (1) le mandat de l'epoch E+1 n'est pas réglé pendant l'epoch E (bot absent dans la fenêtre `auctionWindow → epochDuration`) ; (2) aucun `settle()` non plus pendant l'epoch E+1 — la branche expirée de F1 l'aurait remboursé ; (3) au moins une mise a été posée pendant E+1 **et** un `placeBid` arrive après le roulement en E+2. Cette **seconde réinitialisation portante** capture alors `pendingAmount` de façon INCONDITIONNELLE (`highBidder != 0`) et ÉCRASE l'ancien : le MRN du gagnant précédent n'entre ni dans `refunds`, ni dans le nouveau `pendingAmount`, et son bénéficiaire (`pendingBidder`) est effacé — inaccessible à jamais, et il n'existe aucun `skim` pour le récupérer. **Ce n'est pas le temps qui gèle les fonds, c'est l'arrivée d'une nouvelle mise** : sans nouveau `placeBid`, le slot périmé reste remboursable indéfiniment. Corollaire utile : une capture faite par `placeBid` produit TOUJOURS un `pendingEpoch <= currentEpoch()` — `sellingEpoch` n'est écrit qu'avec `currentEpoch()+1`, et `currentEpoch()` ne décroît pas — donc un reset ne peut jamais décerner de mandat, seulement créer un remboursable ; le mandat n'est décerné que par la branche de capture de `settle()`. Montant en jeu : la mise gagnante de l'epoch manquée. **Correction d'une ligne** : dans la branche de réinitialisation de `placeBid`, créditer `refunds[pendingBidder] += pendingAmount` avant d'écraser, exactement comme le fait la branche expirée de `_settle` — `deadMrn` deviendrait structurellement nul. Le test Foundry MESURE ce poste au lieu de le corriger (`deadMrn`, cf. §6) : l'invariant reste une égalité exacte au wei, mais ce terme est une perte sèche. |
| H | Info | `Pool` | `addLiquidity` et `removeLiquidity` ne portent PAS la boucle de bande 13 %/53 % (seul `swap` la porte). Ils sont proportionnels en théorie, mais sur un pool de poussière la troncature entière d'un dépôt ou d'un retrait peut dériver les ratios sans qu'aucun `require` ne s'y oppose. Le fuzz l'exclut du domaine (`MIN_ECONOMIC_RESERVE = 1e8`, soit ≥ 1 BTC par jambe), le contrat ne l'exclut pas. Aucune conséquence de marché : en dessous de ce seuil l'unité indivisible pèse autant que la réserve. |

### 5.1 Rayon d'impact du constat G — qui perd quoi

| Partie | Perd |
|---|---|
| `Pool` | **Rien.** `notifyRent` n'est jamais appelé pour cette epoch : le pool ne détient jamais ce MRN, ni en réserve ni en registre. Aucun solde n'est touché, l'identité de solvabilité du §2 est intacte. |
| Les LP | Une **rente manquée**, pas une perte de principal : les 70 % qui leur auraient été streamés n'arrivent jamais. L'epoch tourne sans gestionnaire, au tarif nominal `NOMINAL_FEE_NUM` (5 bp). |
| L'enchérisseur capturé (`pendingBidder`) | **La totalité de sa mise.** Il ne devient jamais gestionnaire — `pool.setManager` n'est appelé que par la branche nominale de `_settle` — et, dans le seul cas G, n'est jamais remboursé. |
| Les détenteurs de MRN | Le burn de 30 % n'a pas lieu : manque à gagner déflationniste marginal. |
| La trésorerie | Rien (R6 : l'enchère ne verse aucune part au trésor). |

Terminologie : ce n'est pas « le manager » qui perd — il ne l'est jamais
devenu. La victime est le **gagnant capturé**, `pendingBidder`, c'est-à-dire
l'enchérisseur le plus offrant d'une enchère dont le règlement n'a jamais été
poussé. Et dans le cas général il est remboursé : F1 le couvre dès qu'un
`settle()` intervient dans l'epoch suivante. G est le cas étroit où le slot est
écrasé avant.

**Qui est remboursé quand on appelle `settle()`.** Toujours et uniquement
`pendingBidder`, le titulaire courant du slot (Auction.sol:446). Deux chemins :

- *slot déjà rempli* → `_settle()` direct. Le pending n'a pu être rempli que
  par la réinitialisation d'un `placeBid`, donc son `pendingEpoch` est toujours
  `<= currentEpoch()` (cf. constat G) → branche expirée → **remboursement
  intégral** de `pendingAmount` (Auction.sol:448-457).
- *slot vide* → `settle()` capture d'abord l'enchère vivante, fenêtre fermée
  exigée (F3). Si l'epoch vendue n'a pas encore tourné (`pendingEpoch ==
  currentEpoch() + 1`), c'est la branche nominale : il devient gestionnaire,
  la rente est versée, 30 % sont brûlés, **aucun remboursement**. Si elle a
  tourné, branche expirée → remboursement.

Le remboursement est un **crédit, pas un push** : `refunds[pendingBidder] +=
montant`, que l'intéressé doit tirer lui-même via `withdrawRefund()`
(pull-only, paie `msg.sender`). Piège de lecture : dans `_settle`, la variable
locale qui reçoit `pendingBidder` s'appelle `manager` (Auction.sol:446) —
c'est un simple nom de variable, il n'a jamais été nommé gestionnaire de quoi
que ce soit à ce stade.

**Pas un vecteur d'attaque.** `settle()` est permissionless et rémunéré (0,1 %
de la part LP) : n'importe qui peut l'appeler, et l'appeler *rembourse*
l'enchérisseur. Empêcher tout règlement pendant deux époques exige une vraie
panne de keeper, pas une censure — et tant que `bot.mjs` tourne, le scénario
est inatteignable. Gravité réelle : un risque d'exploitation (disponibilité du
bot), pas une faille de sécurité exploitable par un tiers.

### 5.2 Le gel est un burn implicite

Économiquement, un MRN gelé par G est indiscernable d'un burn : plus aucune
clé, plus aucun chemin de code ne peut le dépenser, et il n'existe aucun
`skim`. La différence est comptable — et elle compte :

| Façon de détruire du MRN | `totalSupply()` | Traçable |
|---|---|---|
| `MRN.burn()` — les 30 % d'un règlement nominal | **diminue** | oui, `Transfer` vers `0x0` |
| Transfert vers `0x…dEaD` — les 1 000 parts `MINIMUM_LIQUIDITY` du Pool | inchangé | oui, solde lisible à une adresse connue |
| MRN orphelin dans l'Auction — constat **G** | inchangé | **non** : mélangé aux passifs vivants dans `balanceOf(auction)` |

Autrement dit : un **burn aveugle**. Le contrat reste solvable — l'invariant
`held == Σrefunds + pendingAmount + highBid + deadMrn` tient au wei — mais le
vrai flottant ne se lit qu'en calculant
`balanceOf(auction) − Σrefunds − pendingAmount − highBid`, ce qui est
exactement ce que fait le compteur `deadMrn` du harnais Foundry : un exercice
comptable côté test, pas côté contrat.

Conséquence pratique : toute métrique lue sur `totalSupply()` de MRN, ou sur
le solde de l'Auction, surestime la quantité réellement disponible. D'où
l'intérêt du correctif d'une ligne (§5, constat G) — ou, à défaut, d'exposer
le poste dans un compteur public.

## 6. Invariants testés (Foundry)

Deux campagnes de fuzz (`Pool.invariant.t.sol`, `Auction.invariant.t.sol`) et
douze suites déterministes, soit les quatorze `*.t.sol` de `backend/test/`.
Les campagnes tournent sous le runner d'invariants EDR de Hardhat 3.

### 6.1 `Pool.invariant.t.sol` — handler `PoolHandler`

Quatre wrappers : `addLiquidityWrapper`, `swapWrapper`,
`removeLiquidityWrapper`, `addThenRemoveRoundTrip`. `setUp` nomme un manager
pour l'epoch 1, avance l'horloge dans cette epoch et fixe sa base de frais :
**chaque swap fuzzé passe donc par le chemin `managerCut > 0`**, celui-là même
où la garde de bande s'applique au net du frais partagé.

| Invariant | Propriété | Ce qu'il attrape |
|---|---|---|
| `invariant_reservesNeverExceedBalances` | `reserves(i) ≤ balanceOf(i)` | sous-comptabilité, retrait au-delà du solde |
| `invariant_reservesTrackBalancesExactly` | **forme forte** : `reserves(i) + protocolFeesOwed(i) + feesOwed(MANAGER,i) == balanceOf(pool)` | toute fuite ou double-compte de frais — c'est l'identité de solvabilité du §2, vérifiée après chaque appel |
| `invariant_shareValueNeverDecreases` | `Σreserves · 1e18 / supply` monotone non décroissante | extraction de valeur par dépôt/retrait ; donation (si les réserves étaient lues en `balanceOf`, une donation ferait *baisser* cet indicateur au lieu de l'augmenter) |
| `invariant_bandsAlwaysRespected` | `floor·sum < reserves(i)·100 < ceiling·sum` | garde de bande neutralisée — **mutation vérifiée** : les deux `require` de bande retirés de `swap()` font tomber cet invariant, et lui seul |
| `invariant_addLiquidityDeliversAllThreeLegs` (G2) | chaque jambe croît d'au moins 1 unité | disparition du `ceilDiv` des jambes de dépôt (parts frappées contre 0 livré) |
| `invariant_managerPathWasExercised` | `swapsUnderManager == swapsExecuted` | alarme de harnais : si un remaniement faisait dériver l'horloge, le chemin gestionnaire ne serait plus éprouvé |
| `invariant_campaignDidSomething` + `afterInvariant` | `totalCalls > 100` par run ⇒ `totalSupply > 0` ; seuil haut en fin de run | campagne vide (handler revert-bloqué) |

Déterministes associés : `test_managerPathIsActiveAndConserves` (30 swaps sous
manager, conservation `Δreserves + ΔfeesOwed == Δbalance`) et
`test_InsufficientReserveReachedViaForgedState` (localise le slot des réserves
par scan, force `reserves[0] = 0` au `vm.store`, puis exige
`InsufficientReserve` — la seule façon d'atteindre une garde par ailleurs
inatteignable).

**Configuration** : `failOnRevert = false`. Déviation assumée de la fiche I.6,
documentée en tête de fichier et justifiée par mutation testing. Conséquence à
garder en tête : les assertions *internes* aux wrappers (conservation,
`k` non décroissant) sont décoratives en campagne — elles ne mordent que via
le déterministe. Les propriétés d'état, elles, sont promues en `invariant_`
de haut niveau et mordent après chaque appel.

### 6.2 `Auction.invariant.t.sol` — handler `AuctionHandler`

Quatre wrappers (`placeBid`, `settle`, `withdrawRefund`, `warp`), quatre
acteurs fixes financés, `failOnRevert = true`, `runs = 64`, `depth = 250`.

- **`invariant_mrnCoversObligations`** — l'invariant central :
  `mrn.balanceOf(auction) == Σrefunds + pendingAmount + highBid + deadMrn`,
  en **égalité exacte au wei**. Un `>=` à marge croissante absorberait une
  sous-créance de `refunds` ; l'égalité la mord.
- `afterInvariant` : `placeBidsOk > 0` — garde de vacuité par run.
- **Sélecteurs avalés, et uniquement ceux-là** : `WindowClosed`,
  `NoBidToSettle`, `WindowStillOpen`, `EpochAlreadyStarted`,
  `ManagerAlreadySet`, `NoBidToRefund`. Les deux derniers sont du **code mort
  depuis F1/F3**, conservés comme gardes défensives — c'est la preuve testée
  que `ManagerAlreadySet` est structurellement inatteignable depuis le chemin
  d'enchère.
- `deadMrn` : poste comptable qui mesure le MRN gelé par double
  réinitialisation portante (constat **G** du §5). L'invariant le couvre, il ne
  le récupère pas.
- Déterministes : `test_aDoubleNominationIsStructurallyUnreachable` (F3 — une
  mise après règlement heurte `WindowClosed`), `test_handlerReachesResetAndExpiredSettlePaths`
  (F1 — remboursement intégral du mandat périmé),
  `test_handlerReachesRefundAndWithdrawPaths`, `test_handlerReachesNoBidToSettlePath`,
  `test_threeLiabilityTermsNonZeroTogether` (les trois termes du passif non
  nuls simultanément, 4,31e18 au wei), `test_deadMrnAccumulatesOnSecondCarryingReset`
  (5,31e18 = 4,10e18 + 1,21e18).

### 6.3 Suites Foundry déterministes

| Fichier | Ce qu'il épingle |
|---|---|
| `Pool.security.t.sol` | **F5** rente (`accPerShare` figé, `rentLeftOver`, recalibrage de `rentLastUpdate`, accord `claimable()` / chemin écrivain, report refondu dans le flux suivant) · **F6** borne owner (`OwnerEpochTooFar`, la borne suit l'horloge et non l'appelant, voie enchère non bornée) · **F7** sentinelle `lastSetFeeEpoch` · **F8** plafond uint72 (`ReserveOverflow`) |
| `Auction.security.t.sol` | **F1** (le mandat périmé est remboursé, ne brûle rien, ne verse aucune rente, purge le slot, laisse l'enchère vivante, pas de double remboursement) · **F2** (`pendingBidder`) · **F3** (snipe à la 1re seconde → `WindowStillOpen` ; `settle` accepté à la seconde exacte ; `placeBid` refusé à cette même seconde) · mandat déjà pourvu → remboursement au lieu de `ManagerAlreadySet` |
| `Pool.safeERC20.t.sol` | tokens non standard : `transfer`/`transferFrom` rendant `false` → revert ; ne rendant rien → accepté. Testé sur add, remove, swap-in et swap-out |
| `Pool.forgedState.t.sol` | états forgés au `vm.store` : le `ceilDiv` livre ≥ 1 unité sur jambe de poussière ; `swap` rejette tout état d'arrivée hors bande **même depuis un état déjà hors bande** ; add/remove restent non gardés sous état forgé (confirme le constat **H**) |
| `Pool.feeSplit`, `Pool.rent`, `Pool.depeg`, `Pool.swap`, `Pool.addLiquidity`, `Pool.removeLiquidity`, `Pool.setFee`, `Pool.feeInForce` | répartition des frais, flux de rente, décorrélation, courbe, tarif en vigueur |

### 6.4 Ce que les campagnes ne couvrent pas

- Pool : `failOnRevert = false` (dette documentée), et la **fréquence** d'appel
  de `swapWrapper` n'est pas garantie par run — le fuzzer choisit librement ses
  sélecteurs. Le retune du domaine garantit la qualité des swaps fuzzés, pas
  leur nombre.
- Pool : les bandes ne sont affirmées qu'au-dessus de `MIN_ECONOMIC_RESERVE`
  (constat **H**).
- `MRN` : aucun invariant — il n'y a rien à invarier sur un ERC20 sans hook.

## 7. Scripts d'attaque (`backend/scripts/attack/`)

Quinze scripts + un socle commun `_harness.ts`. Ils tournent contre le nœud
Hardhat local (chaîne 31337) en lisant les adresses de
`ignition/deployments/chain-31337/deployed_addresses.json`
(`buildAttackContext()`), et sortent un verdict normalisé
« attaque / attendu / observé / OK-ÉCHEC » via `recordAttack` / `finalize`,
avec un récapitulatif en fin de run. Plusieurs déploient leur propre
Pool/Auction quand le scénario consommerait un vrai mandat ou exigerait de
redémarrer le nœud.

Exécution, depuis `backend/` :
`hardhat run scripts/attack/attack_<nom>.ts --network localhost`
(ici `npx` ne fonctionne pas — passer par le binaire local, cf. MEMORY).

| Script | Famille | Tentative | Verdict attendu |
|---|---|---|---|
| `attack_bands` | DoS / prix | pousser une jambe au-dessus de 53 % (swap entrant), puis sous 13 % (swap sortant) | `CeilingTouched` / `FloorTouched` |
| `attack_zero_output` | arrondis | swap d'une unité : `amountOut` tronqué à 0 | `ZeroOutput` |
| `attack_bad_slippage_frontrun` | front-running | `minOut` calculé sur l'état courant, état déplacé par une tx concurrente avant la nôtre | `BadSlippage` |
| `attack_swap_same_token` | arrondis | `swap(i, i)` : se rendre la monnaie à soi-même | **succès, mais** `amountOut < amount` : le pool gagne le frais et le price impact. Démonstration de non-profit, pas un revert |
| `attack_ceil_div` | arrondis | faire tomber la troncature du côté de l'appelant (frais, jambes de dépôt) | frais arrondi **au-dessus** (`ceilDiv`), jambes de dépôt **au-dessus** : aucun arrondi ne va à l'appelant |
| `attack_donation` | donation / force feeding | transfert direct de BTC mock au pool, sans `addLiquidity` | aucun revert : `reserves[i]` et `get_dy(i,j,dx)` **identiques** avant/après |
| `attack_safe_erc20` | send / transfer / call | `MockMisbehavingBTC` : `transfer` rendant `false`, ou ne rendant rien | `false` → revert (SafeERC20) ; sans valeur de retour → accepté |
| `attack_first_depositor` | donation / premier déposant | amorcer à 1 wei puis gonfler le prix de la part | `balanceOf(0x…dEaD) == 1000`, valeur des parts mortes > 0, part du premier déposant non siphonnable |
| `attack_pause_asymmetric` | DoS | pause d'urgence par l'owner, puis tentative de sortie | `swap` / `addLiquidity` revertent ; **`removeLiquidity` passe** — réfute la lecture « bank-run » |
| `attack_owner_power` | centralisation | owner vs manager : qui peut quoi | `pause` est `onlyOwner`, `setFee` exige `manager()` ; les deux rôles sont séparés et non confondus |
| `attack_owner_squat` | centralisation (**F6**) | l'owner préempte N mandats à l'avance | `OwnerEpochTooFar(currentEpoch()+1)` au-delà ; succès sur `currentEpoch()+1` — la borne borne l'amorçage sans le fermer |
| `attack_rent_burn` | DoS / rente (**F5**) | tous les LP sortent **pendant** un flux de rente | `accPerShare` inchangé, `rentLeftOver == dt·rentRate/1e18` au wei, report refondu dans le flux suivant |
| `attack_auction_snipe` | front-running / timestamp (**F3**) | `placeBid(minOpeningBid)` puis `settle()` dans la **même** transaction | `WindowStillOpen(closesAt)` ; `settle` accepté à la seconde exacte de fermeture |
| `attack_auction_brick` | DoS (**F1** + **F2**) | laisser périmer un mandat capturé, puis tenter de le régler | remboursement intégral du gagnant **capturé**, rien au meneur de l'enchère vivante, slot purgé, enchère toujours vivante |
| `attack_insufficient_reserve` | arrondis / DoS | vider la réserve de sortie | garde **prouvée inatteignable** : elle compare la sortie calculée à la réserve disponible, pas l'entrée à zéro ; seuls les états forgés l'atteignent (`Pool.invariant.t.sol`) |

**Lacunes de couverture de la voie A** : aucun script d'attaque pour la
réentrance — elle est couverte par `test/Pool.reentrancy.test.ts` (TS, mock
`MockReentrantBTC`, assertion sur le sélecteur `ReentrancyGuardReentrantCall`)
et par `Pool.security.t.sol`. Rien non plus pour oracle et `tx.origin` : ces
deux surfaces n'existent pas dans le code.
