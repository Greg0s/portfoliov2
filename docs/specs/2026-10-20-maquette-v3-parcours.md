# Maquette v3 : le parcours au défilement

- **Date** : 20 octobre 2026
- **Auteur** : Grégoire Tinnes, avec Claude
- **Statut** : spec validée par Grégoire ; maquette terminée et validée le 23 octobre 2026
- **Fin du parcours** : le bureau de la section Contact a sa propre spec (`2026-10-21-maquette-v3-bureau.md`).
- **Maquette** : canevas Claude Design « Maquette portfolio v3 » ([lien privé](https://claude.ai/artifact/Qm7HYAAf7d991WuXECGZue))
- **Lien avec la spec principale** (`2026-10-14-portfolio-design.md`) : la charte « Musée de nuit » reste valable (typographie, couleurs, mouvement « Poétique », lumière selon l'heure, animations réduites automatiques). La v3 remplace la mise en page de l'accueil : les cartes flottantes à plat et le contact sur photo. La spec principale a été mise à jour avec la v3 le 23 octobre 2026 (sections 4, 5.4, 5.5, 7.4 et 11).

## 1. Intention

Un seul travelling arrière. On part de la planète du Petit Prince ; en faisant défiler, la caméra recule, les projets passent un par un et font leur mise au point, puis on se retrouve dans le vide, où apparaît le contact.

Ce même recul finit dans un bureau : la caméra repasse par la fenêtre et s'arrête dans les yeux de la personne assise, face à la fenêtre et à son écran. Le site devient un seul plan, de la planète rêvée jusqu'au rêveur qui la regarde. Cette fin est décrite dans la spec du bureau.

## 2. Décisions

| #   | Sujet                    | Choix                                                                                                |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | Mouvement de caméra      | un seul travelling arrière                                                                           |
| 2   | Présentation d'un projet | mise au point automatique (profondeur de champ), cartel affiché tant que la carte est nette          |
| 3   | Rythme                   | d'ancre en ancre (l'ouverture, chaque projet, le contact), sur ordinateur comme sur mobile           |
| 4   | Texte de l'ouverture     | reste net au premier plan, puis s'efface avant le premier projet                                     |
| 5   | Disposition              | alternance gauche/droite irrégulière, centre libre                                                   |
| 6   | Fin                      | le contact dans le vide, sans photo                                                                  |
| 7   | Ouvrir un projet         | plongée dans la carte ; au retour, on retrouve le parcours au même endroit                           |
| 8   | Mobile                   | le même parcours, adapté ; version allégée automatique si le téléphone peine                         |
| 9   | Repère                   | aucun : le compteur de distance a été retiré (22 octobre 2026)                                       |
| 10  | Maquette                 | un nouveau canevas Claude Design                                                                     |
| 11  | Technique de la maquette | prototype interactif en 3D CSS, complété par un storyboard                                           |
| 12  | Projet suivant           | directement l'étude suivante, par une plongée dans son image                                         |
| 13  | Indice de clic           | sur ordinateur, un curseur « Voir le projet » en disque clair ; sur mobile, une pastille sur l'image |
| 14  | Appel de l'ouverture     | un seul, en bas au centre : « Voir les projets » (22 octobre 2026)                                   |
| 15  | Liens de l'en-tête       | un fondu au noir, rapide, quel que soit le lien (22 octobre 2026)                                    |

## 3. Le canevas v3

Un canevas « Maquette portfolio v3 », séparé de celui de la v2, avec ces plans de travail :

1. **Parcours, ordinateur** (1440 × 900) : on fait défiler à l'intérieur du plan de travail pour faire reculer la caméra. Réglages : « ancre » (pour se placer sur l'une d'elles) et « heure » (Heure du visiteur, Aube, Crépuscule).
2. **Parcours, mobile** (390 × 844) : le même parcours, adapté. Mêmes réglages.
3. **Storyboard** : huit moments clés côte à côte, lisibles sur téléphone : l'ouverture ; le début du recul ; le premier projet net ; l'entre-deux ; un projet au milieu ; le dernier projet ; le contact dans le vide ; la plongée dans une carte. Il n'est plus mis à jour depuis l'arrivée du bureau (le contact y reste dans le vide) : il n'est pas nécessaire à l'intégration.
4. **Étude de cas** : la page de la v2, en arrivée de la plongée, avec la carte cliquée comme média d'ouverture.
5. **Titre animé** : le composant de la v2.
6. **Charte** : celle de la v2.

Les réglages ne s'affichent que dans l'éditeur, sur ordinateur. Sur téléphone, on fait défiler le parcours mobile, et le storyboard montre les moments clés d'un coup d'œil.

La scène (étoiles, planète, cartes, cartels, textes) est un seul composant, utilisé par les deux parcours et par les huit images du storyboard, chacun à sa position. Comme un composant importé ne peut pas porter de styles partagés, ses animations (flottement, scintillement, dérive de la caméra) sont calculées en JavaScript à partir du temps et de la progression, et ses styles sont tous en ligne.

## 4. La scène et la caméra

- **Espace** : perspective CSS. La planète est l'objet le plus lointain et sert de point de fuite. Les projets sont posés le long du trajet, entre la planète et la position finale de la caméra. Trois couches d'étoiles (environ 60, 40 et 20) remplissent le volume à des profondeurs croissantes.
- **Recul** : la caméra ne fait que reculer. La planète, posée à gauche sur l'ouverture (600 px) avec son décor d'étoiles et de planètes lumineuses, glisse vers le centre en s'éloignant, jusqu'à n'être plus qu'une petite lumière floue. Les étoiles proches défilent plus vite que les lointaines.
- **Petits mondes** : vingt et un sur ordinateur, seize sur mobile, de la même famille que le décor de la planète : disques lumineux, planètes à anneau (vu de biais, ou par la tranche comme un trait), une planète et sa lune, petites étoiles à cinq branches, tous blancs. Posés entre les projets, en haut et en bas de l'image ou sur le côté libre, à l'écart des cartes et des cartels, ils arrivent de derrière, passent et s'éloignent vers la planète avec les étoiles. Discrets : opacité de 0,5 à 0,75, flous hors du plan net comme les cartes, ils flottent de quelques pixels. Ajoutés le 22 octobre 2026 pour l'immersion ; cinq de plus (trois sur mobile) entourent le premier projet, qui paraissait vide.
- **Les astéroïdes du livre** : essayés le 22 octobre 2026 (six des petits mondes devenus les astéroïdes 325 à 330, avec leurs habitants), puis écartés par Grégoire le 23 octobre ; les petits mondes restent tels quels.
- **Le vent sur la planète** : l'écharpe du Petit Prince flotte doucement, une vague qui court du cou jusqu'au bout du ruban (une boucle de 6 s, en 96 images rendues par le prototype `docs/prototypes/petit-prince`, `npm run vent`) ; la rose se balance au même souffle, en continu et sans à-coup (de −1,2° à 2,4°, un aller-retour de 6 s, accéléré et ralenti en douceur ; amplitude augmentée de moitié le 23 octobre 2026 pour qu'il se voie un peu plus) ; toutes les 7 à 14 s, un coup de vent presse les deux ensemble (1,6 fois plus vite pendant 2,2 s). Avec « Réduire les animations », et dans le storyboard, la planète reste le rendu fixe.
- **Vie d'une carte** : elle arrive par-dessus l'épaule, tout près et floue, en fondu ; elle devient nette quand elle occupe environ un tiers de la largeur de l'écran (de 30 à 38 % selon la carte) ; puis elle repart vers la planète en rapetissant, en se floutant et en s'estompant.
- **Ancres** : le défilement s'arrête toujours sur une ancre : l'ouverture, chacun des huit projets (carte nette), puis le contact. Un geste (molette, pavé tactile, doigt, clavier) mène à l'ancre suivante ou précédente ; on ne peut pas rester entre deux.
- **Paliers** : sur le tronçon de chaque projet, la position de la caméra suit `f(s) = s + k · sin(2πs) / 2π`, avec `s` la progression dans le tronçon (de 0 à 1) et `k = 0,75`. Le recul tombe à 25 % de sa vitesse moyenne au milieu du tronçon, quand la carte est nette, et monte à 175 % entre deux projets, sans à-coup. Avec les ancres, cette courbe rythme le passage d'une ancre à l'autre : départ et arrivée en douceur, accélération entre les deux.
- **Longueur** : douze écrans et demi de défilement : l'ouverture et l'effacement du texte (un écran), un écran et quart par projet, un écran et demi pour la fin.
- **Compteur** : retiré le 22 octobre 2026, à la demande de Grégoire ; la distance depuis l'astéroïde B 612 n'est plus affichée.
- **Touches « poétiques »** : la caméra dérive très légèrement (quelques pixels, une fraction de degré, sur une dizaine de secondes) ; sur ordinateur, elle s'incline de 1 à 2° vers la souris, ce qui remplace la parallaxe de la v2. La planète garde la lumière selon l'heure.

## 5. Les projets

| #   | Projet                     | Côté   | Décalage horizontal | Décalage vertical | Largeur nette | Rotation (Y, Z) |
| --- | -------------------------- | ------ | ------------------- | ----------------- | ------------- | --------------- |
| 1   | La Fabrique des Mondes     | gauche | -27 %               | -6 %              | 38 %          | 12°, -1,5°      |
| 2   | What we play?              | droite | +25 %               | +8 %              | 32 %          | -10°, 2°        |
| 3   | Littérature & Combinatoire | gauche | -30 %               | +10 %             | 34 %          | 9°, 1°          |
| 4   | SNCF Wrapped               | droite | +28 %               | -9 %              | 30 %          | -12°, -2°       |
| 5   | Recoding                   | gauche | -24 %               | -2 %              | 36 %          | 11°, 1,5°       |
| 6   | Lyrix                      | droite | +31 %               | +5 %              | 33 %          | -9°, -1°        |
| 7   | Le Petit Prince            | gauche | -29 %               | +12 %             | 31 %          | 10°, 2°         |
| 8   | Obaine                     | droite | +26 %               | -7 %              | 35 %          | -11°, -1,5°     |

Décalages mesurés au moment où la carte est nette, depuis le centre de l'écran, en % de la largeur et de la hauteur (négatif : à gauche ou en haut). Rotations en convention CSS : un angle Y positif tourne la carte vers la droite, donc chaque carte fait face au centre. Les cartes gardent le format de la v2 (16:9, coins arrondis de 20 px) et son flottement (±12 px, sur 8 à 10,5 s).

- **Profondeur de champ** : nette dans une zone d'environ ±10 % autour de la distance de netteté ; au-delà, le flou croît jusqu'à 12 px. La planète suit la même règle : nette sur l'ouverture, floue dès que la caméra s'éloigne. Une carte qui arrive apparaît en fondu ; une carte qui s'éloigne descend jusqu'à une opacité d'environ 0,25.
- **Carte nette** : anneau blanc de 1 px à 55 % et léger halo blanc, comme le survol de la v2.
- **Cartel** : du côté du centre, 300 px de large au plus : titre (Libre Franklin 600, 28 px), tag (« 2024 — Three.js · génératif », Libre Franklin 600, 12 px, capitales), description courte (Manrope, 15 px). Il apparaît en 300 ms et s'efface en 200 ms.
- **Indice de clic** : sur ordinateur, au survol de la carte nette, la souris devient un disque clair de 96 px (#F3F3F1) où « Voir le projet » s'écrit en capitales sombres (Libre Franklin 600, 11 px) ; il apparaît en grandissant (300 ms). Sur mobile, sans survol, une pastille « + Voir le projet » s'affiche sur l'image de la carte nette.
- **Survol** : la carte nette se soulève à peine (450 ms).
- **Clavier** : Tab passe d'un projet à l'autre dans l'ordre ; la caméra glisse jusqu'à l'ancre du projet qui reçoit le focus ; Entrée l'ouvre.
- **Plongée** : au clic, la caméra repart vers l'avant pendant 0,9 s (`cubic-bezier(0.65, 0, 0.35, 1)`) ; la carte grandit jusqu'à couvrir l'écran, tout le reste s'efface en 300 ms, puis l'étude de cas s'ouvre avec la carte comme média d'ouverture. « Retour aux projets » joue l'inverse et rend le parcours à la même progression.
- **Projet suivant** : depuis une étude de cas, « Projet suivant » mène directement à l'étude suivante, sans repasser par le parcours : l'image du projet suivant grandit jusqu'à devenir l'image d'ouverture de sa fiche (0,9 s), pendant que la page s'efface. Au retour, on retrouve la carte de ce projet dans le parcours.
- **Médias** : les images actuelles en attendant les vidéos en boucle ; une vidéo se met en pause dès que sa carte s'éloigne de la zone nette.

## 6. L'ouverture et ce qui reste à l'écran

- **Ouverture** : celle de la v2. La planète à gauche, éclairée selon l'heure ; à droite le nom, le métier animé (Libre Franklin italique léger), « Je code des images. » et la phrase d'accroche.
- **Texte** : reste net et immobile pendant que la planète commence à reculer, puis s'efface en fondu, avec une montée de quelques pixels, juste avant que le premier projet devienne net.
- **En-tête** : fixe pendant tout le parcours : le nom (retour à l'ouverture), Projets (premier projet), Contact (fin du parcours), FR/EN.
- **Passage par le noir** : tout clic sur un lien de l'en-tête (le nom, Projets, Contact, et sur mobile les liens du menu) passe par le noir, quelle que soit la distance : l'image s'éteint en 0,25 s (`cubic-bezier(0.32, 0, 0.67, 0)`), la caméra saute à destination, puis l'image revient en 0,35 s (`cubic-bezier(0.33, 1, 0.68, 1)`). Une étude de cas ouverte ou le menu se ferment dans le noir ; le lien « Contact » du bas d'une étude de cas fait de même. On arrive au contact directement sur la place assise, avec l'étoile filante d'accueil si elle n'a pas encore été vue. Déjà à destination, un clic ne fait rien. « Retour aux projets » garde la plongée inverse. Le même passage par le noir sert quand on vide la Corbeille de l'écran du bureau : la scène revient avec de nouvelles images au mur (spec du bureau, section 6).
- **Appel à l'action** : un seul, en bas au centre de l'ouverture, sur ordinateur comme sur téléphone : « Voir les projets » en petites capitales et un trait qui descend lentement. Un clic fait glisser la caméra jusqu'au premier projet, comme un défilement ; l'appel disparaît au premier mouvement (et sort alors de l'ordre de tabulation).

## 7. La fin : le contact dans le vide

Cette fin est remplacée par le bureau (`2026-10-21-maquette-v3-bureau.md`) ; elle reste décrite ici pour mémoire.

- Après le dernier projet, la caméra continue de reculer ; les cartes passées s'éloignent vers la planète, devenue une petite lumière floue au centre ; les étoiles se raréfient.
- Le contact apparaît en fondu au centre-gauche : le libellé « Contact », « Vous recrutez, ou vous avez un projet ? » (Libre Franklin 500), l'email avec « Copier », LinkedIn, GitHub, CV, Instagram, puis « © 2026 Grégoire Tinnes ».
- Plus de photo, donc plus de crédit photo.
- Au survol de cette lumière (au toucher sur mobile), un minuscule libellé « B 612 » apparaît à côté, relié par un trait fin.
- Le compteur s'arrête sur sa valeur finale (environ 100 millions de km). C'est un point d'arrivée stable : on ne défile pas plus loin ; en remontant, on refait le trajet jusqu'à la planète.
- La scène du bureau remplacera plus tard cette fin.

## 8. Mobile

- Le même parcours au doigt, sur 390 × 844 : la planète en haut de l'ouverture, le texte en dessous.
- Les mêmes ancres qu'à l'ordinateur, au doigt.
- Les projets passent près du centre avec une alternance légère (5 à 8 % de décalage) ; la carte nette fait environ 78 % de la largeur, avec son cartel en dessous.
- Le menu plein écran de la v2, la même plongée, le contact au bureau.
- **Le menu s'ouvre comme on baisse la lumière d'un musée** : le fond de nuit couvre la scène en fondu (0,26 s), puis le nom et « Fermer », « Projets », « Contact » et les langues apparaissent en montant de 10 px, l'un après l'autre (0,32 s chacun, 50 ms d'écart, `cubic-bezier(0.23, 1, 0.32, 1)`). « Fermer » le referme en un seul fondu plus court (0,18 s), les mots restant en place ; un lien du menu le ferme dans le noir, avec le saut. Avec « Réduire les animations », les mots apparaissent sans monter.
- Si la cadence reste sous 40 images par seconde pendant les 3 premières secondes (le seuil de la spec principale), le site bascule sur une version allégée : la planète s'éloigne au début, puis les projets défilent en liste, sans 3D. Cette version n'est pas prototypée dans la maquette.

## 9. Animations réduites et accessibilité

- **« Réduire les animations »**, détecté automatiquement : ni recul, ni flottement, ni parallaxe. L'ouverture est fixe, les projets défilent en liste avec leur cartel toujours visible, le contact suit ; un fondu de 200 ms remplace la plongée.
- **Accessibilité** : tout est en HTML ; un lecteur d'écran lit les projets dans l'ordre puis le contact. La 3D et le flou sont décoratifs ; le cartel de la carte nette garde un contraste suffisant. Le défilement n'est jamais bloqué.

## 10. Hors périmètre

- Le vrai rendu WebGL : la maquette simule la 3D en CSS, avec les rendus de la planète ; le site, lui, utilisera Three.js.
- Les vidéos des projets, à fournir par Grégoire.
- La version allégée pour les téléphones lents.

## 11. À trancher à l'intégration

Ces deux points sont repris par la spec principale (section 7.4) :

- **Les cartes dans le site** : en HTML, en 3D CSS par-dessus la scène Three.js, comme dans la maquette, par défaut ; en plans WebGL avec texture vidéo, doublés d'un HTML invisible pour l'accessibilité, si le prototype de mesure (étape 1 de la spec principale) montre que flouter les vidéos en CSS coûte trop cher.
- **La plongée dans le site** : elle remplace la planète qui s'éloigne et s'assombrit. Le routeur d'Astro garde les scènes d'une page à l'autre ; une transition de vue nommée relie la carte au média d'ouverture de l'étude de cas, et la progression du parcours est gardée dans l'historique pour le retour.

## 12. Ordre de construction de la maquette

1. Le nouveau canevas et le composant de la scène, piloté par la progression.
2. Le parcours sur ordinateur : défilement interne, paliers, mise au point, cartels, compteur, ouverture.
3. La fin : le contact dans le vide.
4. La plongée et l'étude de cas.
5. Le parcours mobile.
6. Le storyboard.
7. La charte et le titre animé, repris de la v2.
