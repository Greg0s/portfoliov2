# Maquette v3 : le bureau de la section Contact

- **Date** : 21 octobre 2026
- **Auteur** : Grégoire Tinnes, avec Claude
- **Statut** : design validé section par section ; maquette en construction (avancement en section 12)
- **Lien avec la spec du parcours** (`2026-10-20-maquette-v3-parcours.md`) : le bureau remplace la fin « contact dans le vide » (section 7 de cette spec). Le reste du parcours ne change pas.
- **Références partagées par Grégoire** : un schéma de composition (posters à gauche, fenêtre au centre, écran à droite au premier plan), une image d'ambiance (un bureau devant une fenêtre au coucher du soleil, sur une ville au bord d'une rivière), la photo qui servira de fond d'écran (une ville en silhouette au coucher du soleil) et le clavier Logitech MX Keys.

## 1. Intention

Le parcours finit là où le rêve commence : la caméra repasse par la fenêtre d'un appartement et s'arrête dans les yeux de la personne assise à son bureau, face à la fenêtre et à son écran. Le site devient un seul plan, de la planète rêvée jusqu'au rêveur qui la regarde. Le contact s'affiche dans le ciel, sous la planète, et l'écran de l'ordinateur montre ce qu'il y a derrière chaque lien.

## 2. Décisions

| #   | Sujet                    | Choix                                                                                                                                                                                                                                                     |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fabrication              | une scène en code (Three.js), qui est la version finale : pas de reprise dans Blender                                                                                                                                                                     |
| 2   | Texte du contact         | toujours visible, centré dans le ciel de la fenêtre, sous la planète                                                                                                                                                                                      |
| 3   | Ville                    | une ville française imaginaire inspirée de Lyon, à la manière de l'image d'ambiance                                                                                                                                                                       |
| 4   | Lumière                  | tout le site passe à deux moments : l'aube avant midi, le crépuscule après midi                                                                                                                                                                           |
| 5   | Arrivée                  | un seul plan : on passe par la fenêtre                                                                                                                                                                                                                    |
| 6   | Interaction              | sur ordinateur, la tête suit doucement la souris                                                                                                                                                                                                          |
| 7   | Mobile                   | cadrage vertical : la fenêtre en haut, le bureau en bas                                                                                                                                                                                                   |
| 8   | Aperçus sur mobile       | aucun : la scène sert de fond et les liens s'ouvrent directement                                                                                                                                                                                          |
| 9   | Objets                   | l'ordinateur, un Logitech MX Keys, une souris dans l'esprit de la Logitech G502 sur un petit tapis bleu pastel, une lampe allumée dans l'esprit de l'Anglepoise Type 75 Mini, une plante, un pot à crayons, la rose de la planète sous son globe de verre |
| 10  | Écran                    | le bureau de Windows 11, sans icônes ; au survol d'un lien, Firefox s'ouvre en grand depuis la barre des tâches, ou l'application de messagerie pour l'email                                                                                              |
| 11  | Technique de la maquette | rendus 3D en couches détourées, posées à leur profondeur dans la scène CSS 3D du parcours                                                                                                                                                                 |

## 3. La pièce et le cadrage

- **Point de vue** : les yeux d'une personne assise, à 1,20 m du sol, juste derrière le bord du bureau, la tête droite (baissée de 3°), avec un champ large (62° en hauteur, environ 88° en largeur sur ordinateur) pour voir à la fois le bureau et la fenêtre, comme sur l'image d'ambiance. On ne voit ni mains ni corps.
- **Composition sur ordinateur** :
  - à gauche, sept images collées directement au mur avec de la Patafix, invisible : des posters imprimés à fond perdu, des photos tirées avec leur liseré blanc, disposés comme sur le schéma. En attendant leur contenu, ce sont de simples aplats ; leurs formes et leur disposition suivront le contenu final ;
  - à partir du centre, une grande baie d'un seul tenant, au cadre fin et blanc, sans montant, qui s'étend vers la droite jusqu'à sortir du cadre, derrière l'écran ; son appui est juste au-dessus du plateau du bureau. Le ciel occupe le haut, la ville le bas ;
  - à droite, au premier plan, l'écran sur son pied, au format 16:10 d'un écran de bureau classique (un 32 pouces), à peine tourné vers nous (tourné davantage, il paraîtrait étiré au bord d'une vue aussi large), le MX Keys devant lui et, à sa droite, une souris dans l'esprit de la Logitech G502 de Grégoire (dos haut, large repose-pouce, boutons latéraux, molette cerclée de métal, trois petites lumières bleues), posée sur un petit tapis de souris bleu pastel ;
  - le bureau est en bois sombre. La lampe allumée, dans l'esprit de l'Anglepoise Type 75 Mini (pied rond, un seul bras courbe, tête faite d'un court cylindre qui s'évase en cloche, éclairée dedans), se tient à gauche entre les posters et la fenêtre et éclaire le bureau à gauche du clavier, pas la plante ; elle cache bien moins les posters qu'avant, et pas la ville ; la plante au coin gauche, dont chaque tige finit sur une feuille ; la rose sous son globe au fond à droite, sous l'écran surélevé, entre son pied et le pot à crayons ; le pot à crayons à droite de l'écran.
- **Style** : celui de la planète, sans photoréalisme : formes simples aux arêtes adoucies, matières mates, couleurs feutrées, ombres douces, même rendu (tone mapping ACES, ombres adoucies).
- **Mobile** : cadrage vertical. L'œil se place un peu plus haut (1,40 m) et plus à droite, recule un peu et lève les yeux (7°, champ de 80° en hauteur, tourné de 13° vers la droite) : le ciel de la fenêtre en haut (la planète, puis le texte, qui tient entre le haut de la fenêtre et le haut de l'écran), la ville à gauche de l'écran, l'écran à droite avec la rose et le pot à crayons, la souris et le clavier en bas.

## 4. La ville et le ciel

- **La ville**, vue d'un septième étage, sur les pentes d'une colline qui domine la ville d'environ 80 m :

  - juste sous la fenêtre, les toits voisins : tuiles de terre cuite, cheminées, quelques lucarnes ;
  - plus loin, une rivière qui traverse la vue en diagonale, deux ponts en arc, des quais plantés d'arbres, et sur le quai d'en face un parc avec un étang ;
  - des quartiers qui se distinguent : la vieille ville, des immeubles de quatre à sept étages aux façades claires (crème, ocre, rose, terre cuite) et aux toits de tuiles ou de zinc (à la Mansart) ; des rues de petites maisons ; quelques immeubles modernes au loin ; de petites places plantées ; un dôme près du quai, un petit dôme de cuivre vert et cinq clochers ; aucune tour ;
  - une ville qui n'est pas plate : sur la rive d'en face, deux larges collines couvertes de maisons, dont les crêtes se détachent sur la brume, et le sol qui monte un peu vers l'horizon ; les quais restent à plat ;
  - au loin, des collines sur cinq plans, de plus en plus pâles, chacune perdue à son pied dans la brume, les dernières se fondant dans le ciel ; la deuxième est coiffée d'une petite tour.

  Tout est en volumes simples ; les fenêtres sont de petits rectangles ; la ville se fond dans la couleur du ciel avec la distance.

- **Aube** (avant midi) : ciel du bleu nuit au rose pâle, puis à un orangé doux sur l'horizon ; le soleil n'est pas encore levé, une lueur se devine derrière les collines ; la ville est dans l'ombre bleutée, avec quelques fenêtres allumées. Dans le ciel, discrète, la lune : un fin croissant décroissant (un tiers éclairé), presque à sa taille réelle (11 px sur ordinateur, au-dessus de l'écran ; 8 px sur mobile, à droite du titre ; sa vraie taille serait de 7 et 5 px), sa partie éclairée tournée vers la lueur du soleil qui va se lever, avec un très léger halo et la lueur cendrée de la partie sombre.
- **Crépuscule** (après midi) : ciel de l'indigo à l'orange profond sur l'horizon ; le soleil se couche derrière les collines, à moitié caché dans un creux entre deux d'entre elles, près de celle qui porte la petite tour, avec un halo qui déborde sur les crêtes (un disque un peu plus grand que nature, 2,4°) ; beaucoup de fenêtres allumées et les réverbères des quais. Sur mobile, le soleil est juste hors du cadre, à gauche : on n'en voit que la lueur.
- **Dans les deux cas** : les étoiles les plus brillantes restent visibles en haut du ciel ; la planète du Petit Prince reste la petite lumière floue de la fin du parcours, au-dessus du texte, avec « B 612 » au survol (le halo qui adoucit le ciel derrière le texte laisse passer la souris jusqu'à elle) ; la vitre est invisible, sans reflet.

## 5. L'arrivée

1. Après le dernier projet, la caméra continue de reculer ; les cartes passées s'éloignent vers la planète et s'effacent, comme aujourd'hui.
2. **Le saut** : la caméra passe à la vitesse de la lumière, en marche arrière. Les étoiles s'étirent en traînées blanches, quelques-unes lavande ou violettes, qui filent vers la planète, vives à la tête et évanescentes vers la queue ; un éclat marque le saut, avec un long reflet horizontal bleuté qui traverse la planète, comme à travers une optique de cinéma anamorphique ; un cœur lumineux brille sur la planète et l'image vibre très légèrement à pleine vitesse. Puis les traînées se rétractent en points et s'éteignent, avant que le ciel n'apparaisse (environ 0,8 s en tout). La planète du parcours passe le relais à celle du ciel, au même point de l'image, et reste une petite lumière floue.
3. **Le ciel et la ville** : le ciel du moment se lève depuis l'horizon, comme un lever de soleil accéléré : une bande orangée, puis le rose, le violet et le bleu nuit qui gagnent le haut de l'image. La ville monte par le bas : collines, toits, rivière, et au crépuscule le soleil couchant ; ses fenêtres sont déjà comme sur l'image (la vague qui les allumait a été retirée le 22 octobre 2026).
4. **La fenêtre** : son cadre surgit autour de l'image, puis la pièce se déploie en reculant : le mur et les posters à gauche, le bureau, la lampe, l'écran à droite. La caméra descend un peu en reculant, si bien que le bureau monte par le bas au lieu d'envahir l'image (surtout sur mobile, où l'écran est au centre).
5. **La place assise** : la caméra s'arrête ; le texte du contact apparaît en fondu au centre du ciel ; l'en-tête reste en haut. Une ombre légère en haut et en bas, qui vient avec le texte, garde l'en-tête et « © 2026 Grégoire Tinnes » lisibles. À cet instant, une fois par visite, une étoile filante traverse le ciel, comme un accueil.

- **Durée** : le passage de l'ancre du dernier projet à celle du contact dure environ 3,5 s, même en un seul geste. Sur ce tronçon, la caméra suit sa propre horloge : elle accélère, file à vitesse constante, puis ralentit, si bien que chaque étape (saut, ciel, ville, fenêtre, pièce) a sa part au lieu que les premières passent en un éclair.
- **Retour** : en remontant, on refait le chemin à l'envers, par la fenêtre, vers l'espace, au même rythme qu'à l'aller.
- **Mise au point** : la pièce est nette ; seule la planète garde son flou.
- **Mobile** : la même chorégraphie, dans le cadrage vertical.

## 6. Le contact et l'écran

- **Le texte**, toujours visible, est centré dans le haut du ciel de la fenêtre, là où il est le plus sombre, sous la planète : le libellé « Contact », « Vous recrutez, ou vous avez un projet ? » (Libre Franklin 500, 40 px sur ordinateur, 30 px sur mobile), l'email contact@gregoiretinn.es avec « Copier », LinkedIn, GitHub, CV et Instagram ; « © 2026 Grégoire Tinnes » en bas de la page. Un léger halo sombre le garde lisible devant l'horizon.
- **L'écran** (par défaut) : le bureau de Windows, sans aucune icône : le fond d'écran (la photo de Grégoire, recadrée au format de l'écran) et la barre des tâches sombre en bas, d'après une capture de son ordinateur : au centre, les vraies icônes, logos non modifiés : Windows, VS Code, Thunderbird, Figma, Blender, Spotify, Firefox, le Terminal Windows et Discord (fichiers officiels de Mozilla, Microsoft et Blender quand leurs dépôts les publient ; pour VS Code et Discord, les logos fournis par Grégoire : l'icône de VS Code 1.35 et l'icône ronde de Discord, refaite à l'identique avec le logo officiel ; reproductions fidèles de la collection SVG Logos et de Simple Icons pour les autres ; la liste reste à ajuster aux applications de Grégoire) ; à droite, la langue, le réseau, le son, la batterie, l'heure et la date du visiteur, en petit. Rien sur l'écran n'attire l'œil plus que le texte du contact.
- **Au survol d'un lien** (ordinateur) : Firefox s'ouvre comme sous Windows, en grandissant depuis son icône de la barre des tâches jusqu'au plein écran en environ 0,4 s (départ vif, arrivée douce), avec les quatre pages ouvertes dans quatre onglets (LinkedIn, GitHub, CV, Instagram), celui du lien au premier plan et son adresse dans la barre ; sous l'icône, le trait de l'application ouverte s'allonge et bleuit :
  - LinkedIn : le profil de Grégoire ;
  - GitHub : son profil et ses dépôts ;
  - CV : le PDF ouvert dans le navigateur ;
  - Instagram : sa grille de photos ;
  - l'email (ou « Copier ») : c'est Thunderbird qui s'ouvre, de la même façon depuis sa propre icône, sur une fenêtre de rédaction adressée à contact@gregoiretinn.es, plus petite que l'écran ; si Firefox était ouvert, il se réduit en même temps.
- **Si la souris reste sur un lien**, la page défile doucement vers le bas au bout d'environ une seconde, jusqu'à sa fin en 5 à 12 s (à 140 px/s au plus pour la longue page de LinkedIn), d'un mouvement lent au départ et à l'arrivée ; chaque nouvelle page repart du haut, et rien ne défile avec le mouvement réduit.
- **D'un lien à l'autre**, la fenêtre reste ouverte et Firefox passe à l'onglet du lien survolé. **Quand la souris quitte les liens**, elle se réduit dans la barre des tâches après 0,6 s.
- **Les pages** sont les captures de Grégoire, affichées sur 1280 px de large : LinkedIn, GitHub et Instagram, vus par un visiteur, et le CV dans sa version portfolio, sans numéro de téléphone (le PDF que le site proposera, gardé dans les fichiers du canevas), tel que Firefox l'affiche à 100 % (794 × 1123 px, sur fond gris foncé). LinkedIn est assemblé à partir de ses 13 captures, faites connecté à son propre compte (fenêtre de 1280 px, 1 754 px de large dans le PDF) et ramenées à la vue d'un visiteur : sans pastilles de notification, sans crayons, « + » ni boutons du propriétaire, sans statistiques ni blocs privés (langue du profil, URL publique), la colonne de droite resserrée et la publicité répétée par chaque capture gardée une seule fois. Les personnes suggérées, la personne qui suit une page, la photo d'un collègue dans une publication, les photos et lettres où figurent d'autres personnes et l'identité de l'auteure de la recommandation sont floutées, comme les deux CV de la rubrique « Sélection », par prudence (numéro de téléphone). La page entière mesure 6 595 px de haut à 1280 px de large. Chaque onglet porte le vrai favicon de sa page, comme Firefox l'affiche en thème sombre : LinkedIn, GitHub (en blanc), l'icône PDF de Firefox pour le CV, Instagram. Firefox est en thème sombre, comme la barre des tâches. Les captures prennent la place de la page dans la fenêtre de Firefox, dont la zone visible mesure 1280 × 670 px : affichées sur 1280 px de large (mode adaptatif de Firefox), capturées en page entière, pour le défilement, à l'échelle 2 (2560 px de large), au zoom 100 %, en navigation privée (la vue d'un visiteur, sans les menus du propriétaire), sans notification ni contenu d'autres personnes ; le CV vient directement du PDF.
- **Mobile** : le bureau de Windows seul ; les liens s'ouvrent directement.

## 7. Le mouvement et la vie dans la pièce

- **La tête suit la souris** (ordinateur) : les couches se décalent légèrement selon leur distance (au plus 13 px pour le bureau, 8 pour la pièce, 4 pour la ville, 2 pour le ciel), avec un amorti d'environ 0,5 s calculé image par image, sans à-coups.
- **La planète** est dans le ciel, derrière le mur : sa lueur ne passe jamais sur le mur ni sur le cadre de la fenêtre, qui la cachent comme ils cacheraient le ciel. Sur mobile, elle est placée juste sous le haut de la fenêtre pour rester toujours visible.
- **La vie, très discrète** : la planète respire et les étoiles les plus brillantes scintillent ; quelques nuages fins glissent très lentement ; de temps en temps, une fenêtre de la ville s'allume ou s'éteint (de plus en plus allumées au crépuscule, de moins en moins à l'aube) ; une étoile filante traverse parfois la fenêtre ; l'heure de la barre des tâches avance. La lampe, la plante et la rose restent immobiles.
- **Mobile** : pas de mouvement de tête, la même vie discrète.
- **« Réduire les animations »** : ni mouvement de tête, ni nuages, ni étoile filante, ni fenêtres qui s'allument ; l'arrivée devient un fondu de l'espace vers le bureau ; la pièce reste fixe derrière le contact.

## 8. La lumière du site : deux moments

- Tout le site suit l'heure locale du visiteur : **l'aube avant midi, le crépuscule après midi**.
- La planète de l'accueil reprend ses rendus aube et crépuscule ; ceux du jour et de la nuit sont mis de côté.
- Dans la maquette, le réglage « heure » propose : Heure du visiteur, Aube, Crépuscule.
- La charte passe de quatre panneaux de lumière à deux. La spec principale (section 5.3) sera mise à jour quand la maquette v3 sera validée.

## 9. Fabrication

- **La scène** : une scène Three.js en code dans `docs/prototypes/bureau/`, avec le même rendu que le prototype de la planète. Les objets sont des formes simples aux arêtes adoucies ; le MX Keys est simplifié (un socle plat graphite et une grille de touches plates) ; la ville est générée (quartiers de blocs aux toits de tuiles, de zinc ou plats, relief, rivière, ponts, quais, parc, monuments, collines sur cinq plans, petite tour).
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
- Le rendu en temps réel du site final, qui reprendra la scène en code.

## 12. Ordre de construction

1. La scène Three.js du bureau (pièce, objets, ville), ses deux lumières et les rendus en couches, sur ordinateur et sur mobile. **Fait.**
2. Le plan de travail « Bureau — aube et crépuscule », pour valider l'image. **Fait, image validée.**
3. L'arrivée dans la scène du parcours (ciel, ville, fenêtre, pièce) et le contact dans le ciel. **Faite et validée**, avec le saut à la vitesse de la lumière ; la vague des fenêtres a été retirée et la lune ajoutée à l'aube (22 octobre 2026).
4. L'écran : bureau de Windows, ouverture du navigateur et aperçus. **Fait, avec les vraies pages LinkedIn, GitHub et Instagram, le CV et les vrais logos.**
5. Le mobile.
6. Les deux moments sur tout le site (réglage « heure », charte).
7. Le storyboard.
