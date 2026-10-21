# Maquette v3 : le bureau de la section Contact

- **Date** : 21 octobre 2026
- **Auteur** : Grégoire Tinnes, avec Claude
- **Statut** : design validé section par section ; spec à relire avant de construire
- **Lien avec la spec du parcours** (`2026-10-20-maquette-v3-parcours.md`) : le bureau remplace la fin « contact dans le vide » (section 7 de cette spec). Le reste du parcours ne change pas.
- **Références partagées par Grégoire** : un schéma de composition (posters à gauche, fenêtre au centre, écran à droite au premier plan), une image d'ambiance (un bureau devant une fenêtre au coucher du soleil, sur une ville au bord d'une rivière), la photo qui servira de fond d'écran (une ville en silhouette au coucher du soleil) et le clavier Logitech MX Keys.

## 1. Intention

Le parcours finit là où le rêve commence : la caméra repasse par la fenêtre d'un appartement et s'arrête dans les yeux de la personne assise à son bureau, face à la fenêtre et à son écran. Le site devient un seul plan, de la planète rêvée jusqu'au rêveur qui la regarde. Le contact s'affiche dans le ciel, sous la planète, et l'écran de l'ordinateur montre ce qu'il y a derrière chaque lien.

## 2. Décisions

| #   | Sujet                    | Choix                                                                                                                             |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fabrication              | une scène en code (Three.js), qui est la version finale : pas de reprise dans Blender                                             |
| 2   | Texte du contact         | toujours visible, centré dans le ciel de la fenêtre, sous la planète                                                              |
| 3   | Ville                    | une ville française imaginaire inspirée de Lyon, à la manière de l'image d'ambiance                                               |
| 4   | Lumière                  | tout le site passe à deux moments : l'aube avant midi, le crépuscule après midi                                                   |
| 5   | Arrivée                  | un seul plan : on passe par la fenêtre                                                                                            |
| 6   | Interaction              | sur ordinateur, la tête suit doucement la souris                                                                                  |
| 7   | Mobile                   | cadrage vertical : la fenêtre en haut, le bureau en bas                                                                           |
| 8   | Aperçus sur mobile       | aucun : la scène sert de fond et les liens s'ouvrent directement                                                                  |
| 9   | Objets                   | l'ordinateur, un Logitech MX Keys, une lampe allumée, une plante, un pot à crayons, la rose de la planète sous son globe de verre |
| 10  | Écran                    | le bureau de Windows 11, sans icônes ; au survol d'un lien, le navigateur s'ouvre en grand                                        |
| 11  | Technique de la maquette | rendus 3D en couches détourées, posées à leur profondeur dans la scène CSS 3D du parcours                                         |

## 3. La pièce et le cadrage

- **Point de vue** : les yeux d'une personne assise, à 1,20 m du sol, juste derrière le bord du bureau, la tête droite (baissée de 3°), avec un champ large (62° en hauteur, environ 88° en largeur sur ordinateur) pour voir à la fois le bureau et la fenêtre, comme sur l'image d'ambiance. On ne voit ni mains ni corps.
- **Composition sur ordinateur** :
  - à gauche, sept images collées directement au mur, sans cadre : des posters tenus par du ruban adhésif aux quatre coins, des photos tirées avec leur liseré blanc, disposés comme sur le schéma. En attendant leur contenu, ce sont de simples aplats ; leurs formes et leur disposition suivront le contenu final ;
  - à partir du centre, une grande baie d'un seul tenant, au cadre fin et blanc, sans montant, qui s'étend vers la droite jusqu'à sortir du cadre, derrière l'écran ; son appui est juste au-dessus du plateau du bureau. Le ciel occupe le haut, la ville le bas ;
  - à droite, au premier plan, l'écran sur son pied, au format 16:10 d'un écran de bureau classique (un 32 pouces), à peine tourné vers nous (tourné davantage, il paraîtrait étiré au bord d'une vue aussi large), et le MX Keys devant lui ;
  - le bureau est en bois sombre. La lampe allumée est à gauche, devant le mur ; la plante au coin gauche ; la rose sous son globe vers le coin gauche, entre la plante et la fenêtre ; le pot à crayons à droite de l'écran.
- **Style** : celui de la planète, sans photoréalisme : formes simples aux arêtes adoucies, matières mates, couleurs feutrées, ombres douces, même rendu (tone mapping ACES, ombres adoucies).
- **Mobile** : cadrage vertical. La caméra recule un peu et lève les yeux (10°, champ de 80° en hauteur) : la fenêtre occupe les deux tiers du haut (le ciel, la planète, le texte), l'écran et le bureau le tiers du bas ; un coin du mur aux posters dépasse sur la gauche.

## 4. La ville et le ciel

- **La ville**, vue d'un septième étage, sur les pentes d'une colline qui domine la ville d'environ 80 m :

  - juste sous la fenêtre, les toits voisins : tuiles de terre cuite, cheminées, quelques lucarnes ;
  - plus loin, une rivière qui traverse la vue en diagonale, deux ponts en arc, des quais plantés d'arbres ;
  - des immeubles de cinq à sept étages aux façades claires (crème, ocre, rose pâle), un ou deux clochers ; aucune tour d'habitation ni de bureaux ;
  - au loin, des collines douces, l'une coiffée d'une petite tour.

  Tout est en volumes simples ; les fenêtres sont de petits rectangles ; la ville se fond dans la couleur du ciel avec la distance.

- **Aube** (avant midi) : ciel du bleu nuit au rose pâle, puis à un orangé doux sur l'horizon ; le soleil n'est pas encore levé, une lueur se devine derrière les collines ; la ville est dans l'ombre bleutée, avec quelques fenêtres allumées.
- **Crépuscule** (après midi) : ciel de l'indigo à l'orange profond sur l'horizon ; le soleil vient de passer derrière les collines ; beaucoup de fenêtres allumées et les réverbères des quais.
- **Dans les deux cas** : les étoiles les plus brillantes restent visibles en haut du ciel ; la planète du Petit Prince reste la petite lumière floue de la fin du parcours, au-dessus du texte, avec « B 612 » au survol ; la vitre est invisible, sans reflet.

## 5. L'arrivée

1. Après le dernier projet, la caméra continue de reculer ; les cartes passées s'éloignent vers la planète et s'effacent, comme aujourd'hui.
2. **L'atmosphère** : le noir de l'espace se teinte peu à peu aux couleurs du moment ; la plupart des étoiles s'éteignent ; la planète reste une petite lumière floue.
3. **La ville** monte par le bas de l'image : toits, rivière, collines. Au crépuscule, ses fenêtres s'allument en vague pendant ce temps, de la rivière vers les collines.
4. **La fenêtre** : son cadre surgit autour de l'image, puis la pièce se déploie en reculant : le mur et les posters à gauche, le bureau, la lampe, l'écran à droite.
5. **La place assise** : la caméra s'arrête ; le texte du contact apparaît en fondu au centre du ciel ; l'en-tête reste en haut ; le compteur s'arrête à environ 100 millions de km de l'astéroïde B 612.

- **Durée** : le passage de l'ancre du dernier projet à celle du contact dure environ 2,5 s, même en un seul geste.
- **Retour** : en remontant, on refait le chemin à l'envers, par la fenêtre, vers l'espace.
- **Mise au point** : la pièce est nette ; seule la planète garde son flou.
- **Mobile** : la même chorégraphie, dans le cadrage vertical.

## 6. Le contact et l'écran

- **Le texte**, toujours visible, est centré dans le haut du ciel de la fenêtre, là où il est le plus sombre, sous la planète : le libellé « Contact », « Vous recrutez, ou vous avez un projet ? » (Libre Franklin 500, 40 px sur ordinateur, 30 px sur mobile), l'email avec « Copier », LinkedIn, GitHub, CV et Instagram ; « © 2026 Grégoire Tinnes » en bas de la page. Un léger halo sombre le garde lisible devant l'horizon.
- **L'écran** (par défaut) : le bureau de Windows, sans aucune icône : le fond d'écran (la photo de Grégoire, recadrée au format de l'écran) et la barre des tâches sombre en bas, d'après une capture de son ordinateur : les icônes des applications au centre, simplifiées sans reproduire les logos ; à droite, la langue, le réseau, le son, la batterie, l'heure et la date du visiteur, en petit. Rien sur l'écran n'attire l'œil plus que le texte du contact.
- **Au survol d'un lien** (ordinateur) : le navigateur s'ouvre comme sous Windows, en grandissant depuis son icône de la barre des tâches jusqu'au plein écran en environ 0,4 s (départ vif, arrivée douce), sur la page du lien, avec le bon onglet et la bonne adresse :
  - LinkedIn : le profil de Grégoire ;
  - GitHub : son profil et ses dépôts ;
  - CV : le PDF ouvert dans le navigateur ;
  - Instagram : sa grille de photos ;
  - l'email (ou « Copier ») : un nouveau message adressé à son email.
- **D'un lien à l'autre**, la fenêtre reste ouverte et seul l'onglet change. **Quand la souris quitte les liens**, elle se réduit dans la barre des tâches après 0,6 s.
- **Les pages** sont des aperçus simplifiés (la mise en page de chaque site avec le nom de Grégoire, sans reproduire les logos), en attendant les vraies captures.
- **Mobile** : le bureau de Windows seul ; les liens s'ouvrent directement.

## 7. Le mouvement et la vie dans la pièce

- **La tête suit la souris** (ordinateur) : les couches se décalent légèrement selon leur distance (au plus 13 px pour le bureau, 8 pour la pièce, 4 pour la ville, 2 pour le ciel), avec un amorti d'environ 0,5 s calculé image par image, sans à-coups.
- **La vie, très discrète** : la planète respire et les étoiles les plus brillantes scintillent ; quelques nuages fins glissent très lentement ; de temps en temps, une fenêtre de la ville s'allume ou s'éteint (de plus en plus allumées au crépuscule, de moins en moins à l'aube) ; une étoile filante traverse parfois la fenêtre ; l'heure de la barre des tâches avance. La lampe, la plante et la rose restent immobiles.
- **Mobile** : pas de mouvement de tête, la même vie discrète.
- **« Réduire les animations »** : ni mouvement de tête, ni nuages, ni étoile filante, ni fenêtres qui s'allument ; l'arrivée devient un fondu de l'espace vers le bureau ; la pièce reste fixe derrière le contact.

## 8. La lumière du site : deux moments

- Tout le site suit l'heure locale du visiteur : **l'aube avant midi, le crépuscule après midi**.
- La planète de l'accueil reprend ses rendus aube et crépuscule ; ceux du jour et de la nuit sont mis de côté.
- Dans la maquette, le réglage « heure » propose : Heure du visiteur, Aube, Crépuscule.
- La charte passe de quatre panneaux de lumière à deux. La spec principale (section 5.3) sera mise à jour quand la maquette v3 sera validée.

## 9. Fabrication

- **La scène** : une scène Three.js en code dans `docs/prototypes/bureau/`, avec le même rendu que le prototype de la planète. Les objets sont des formes simples aux arêtes adoucies ; le MX Keys est simplifié (un socle plat graphite et une grille de touches plates) ; la ville est générée (blocs et toits en pente, rivière, ponts, quais, collines, petite tour).
- **Les rendus** : pour chaque moment (aube, crépuscule) et chaque cadrage (ordinateur 1440 × 900, mobile 390 × 844), trois couches détourées en WebP : la ville, la pièce (mur, posters, cadre de fenêtre, ouverture transparente) et le bureau avec ses objets, avec une marge de 4 % autour du cadre pour les mouvements de tête, en densité 1,5 (ordinateur) et 2 (mobile). Soit douze images légères (20 à 180 Ko). Le ciel, les étoiles et la planète restent en direct, pour que le parcours continue à travers la fenêtre.
- **Le calage de l'écran** : les quatre coins de l'écran de l'ordinateur sont relevés dans le rendu ; le bureau de Windows et le navigateur, en HTML, s'y calent par une transformation en perspective.
- **Les couches animées** : deux images de plus montrent toutes les fenêtres de la ville allumées, sur noir (une par cadrage, la même pour les deux moments) ; de petites pastilles qui s'en éclairent tour à tour allument et éteignent des fenêtres. Les nuages sont dessinés en direct.
- **Version finale** : la scène en code est la version définitive, avec le niveau de finition d'une vraie scène (matières, lumière, détails) ; la plante est générée dans le style de la planète ; la rose est celle de la planète, reprise du modèle Blender de Grégoire (non versionné ; sans lui, une rose simplifiée la remplace). Le site final la reprendra telle quelle pour le rendu en temps réel.

## 10. Sur le canevas

- La scène du parcours finit dans le bureau, sur ordinateur et sur mobile.
- Un nouveau plan de travail, « Bureau — aube et crépuscule », montre les deux moments côte à côte, sur ordinateur et sur mobile, lisibles sur téléphone. Le composant « Bureau » (la scène en HTML sur les couches rendues) sert à ce plan et à la fin du parcours.
- Storyboard : l'image 7 devient l'arrivée au bureau ; une image s'ajoute avec le navigateur ouvert sur un aperçu.
- La charte passe à deux lumières.

## 11. Hors périmètre

- Le contenu des posters et des photos, et donc leurs formes définitives.
- Les vraies captures des pages LinkedIn, GitHub, CV et Instagram.
- Le rendu en temps réel du site final, qui reprendra la scène en code.

## 12. Ordre de construction

1. La scène Three.js du bureau (pièce, objets, ville), ses deux lumières et les rendus en couches, sur ordinateur et sur mobile.
2. Le plan de travail « Bureau — aube et crépuscule », pour valider l'image.
3. L'arrivée dans la scène du parcours (ciel, ville, fenêtre, pièce) et le contact dans le ciel.
4. L'écran : bureau de Windows, ouverture du navigateur et aperçus.
5. Le mobile.
6. Les deux moments sur tout le site (réglage « heure », charte).
7. Le storyboard.
