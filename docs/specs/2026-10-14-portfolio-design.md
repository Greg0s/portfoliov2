# Portfolio v2 : spécification de design

- **Date** : 14 octobre 2026, révisée le 18 octobre 2026, mise à jour avec la maquette v3 le 23 octobre 2026
- **Auteur** : Grégoire Tinnes, avec Claude
- **Statut** : direction « Musée de nuit », charte graphique et maquette v3 validées par Grégoire (la maquette v3 le 23 octobre 2026) ; cette mise à jour v3 validée le 23 octobre 2026
- **Méthode** : la maquette est affinée jusqu'à être parfaite avant d'intégrer quoi que ce soit. Pas de page « bientôt » : le site réel n'est pas prioritaire.
- **Maquette de référence** : le canevas Claude Design « Maquette portfolio v3 » ([lien privé](https://claude.ai/artifact/Qm7HYAAf7d991WuXECGZue)) : le parcours de l'accueil sur ordinateur et sur mobile, jusqu'au bureau, l'étude de cas, le bureau aux deux moments, le titre animé et la charte. Le canevas de la v2 n'est plus une référence. Une évolution du design se fait d'abord sur la maquette, puis dans le code.
- **Specs détaillées de la v3**, qui font référence pour le détail : `2026-10-20-maquette-v3-parcours.md` (l'accueil en un seul mouvement de caméra à travers les projets) et `2026-10-21-maquette-v3-bureau.md` (le bureau qui termine le parcours, c'est-à-dire le contact). Cette spec en reprend l'essentiel et tranche ce qu'elles laissaient à l'intégration.

## 1. Contexte

Le portfolio actuel (`Greg0s/portfolio`, en ligne sur `gregoiretinn.es`) est un site HTML statique construit sur le template Bootstrap _MyPortfolio_. Ses limites :

- une page HTML copiée-collée par projet (une quarantaine), donc pénible à faire évoluer ;
- un bilinguisme FR/EN resté partiel ;
- 36 Mo d'images, optimisées à la main ;
- un contenu daté et des projets récents absents ;
- un rendu générique de template, peu convaincant pour un poste créatif.

On repart d'un repo vide : `Greg0s/portfoliov2`.

## 2. Objectif et critères de réussite

**Objectif** : décrocher un poste de **creative developer**. Le public visé : studios et agences créatives, équipes tech. Le site est la première pièce du portfolio, et son code sera lu lui aussi.

**Critères de réussite**

1. En arrivant sur l'accueil, on comprend qui est Grégoire et ce qu'il fait, et chaque projet est à un clic.
2. Les 8 études de cas sont complètes en français et en anglais.
3. La 3D ne bloque jamais l'accès au contenu : le site reste complet sans JavaScript, sans WebGL et avec « réduire les animations ».
4. Scores Lighthouse sur mobile avant la mise en service : performance ≥ 90, accessibilité 100, SEO 100.
5. Ajouter un projet consiste à créer un dossier de contenu, sans toucher au code ; ajouter une image au mur du bureau aussi.

## 3. Périmètre

**Dans la V1** : l'accueil en parcours (la planète, les 8 projets, le bureau du contact), les 8 études de cas et la page 404, en français et en anglais ; la scène 3D du Petit Prince et celle du bureau, avec la lumière qui suit l'heure du visiteur ; la version allégée pour les téléphones qui peinent ; le déploiement automatique et la mise en service sur `gregoiretinn.es`.

**Hors V1** : page À propos, lab d'expérimentations, blog, formulaire de contact, mode clair, statistiques de visite, archive des autres projets. Idées écartées pour l'instant, à garder en réserve : la lumière qui suit la souris, le renard qui tourne la tête vers le curseur, une planète différente à chaque visite, les astéroïdes du livre parmi les petits mondes (essayés puis écartés le 23 octobre 2026), une ville en plans séparés dans des couches pré-rendues.

## 4. Pages et navigation

| Page             | Français             | Anglais                |
| ---------------- | -------------------- | ---------------------- |
| Accueil          | `/`                  | `/en/`                 |
| Étude de cas     | `/projets/<slug>/`   | `/en/projects/<slug>/` |
| Page introuvable | `404.html`, bilingue |                        |

- Le slug d'un projet est identique dans les deux langues.
- **En-tête**, fixe pendant tout le parcours : le nom (libellé, retour à l'ouverture), Projets (premier projet), Contact (le bureau), sélecteur FR/EN. Chaque lien de l'en-tête passe par le noir : l'image s'éteint, la caméra saute à destination, l'image revient (section 5.5). Sur mobile, un bouton « Menu » ouvre une navigation plein écran qui s'ouvre comme on baisse la lumière d'un musée (spec du parcours, section 8).
- **Accueil**, une seule page où l'on recule d'ancre en ancre (section 5.4) :
  1. **Ouverture** : la planète du Petit Prince en 3D à gauche ; à droite, le nom, le métier animé, « Je code des images. » et la phrase « Entre l'image et le code, je conçois des interfaces et des expériences web interactives, avec autant de soin pour le rendu que pour la technique. » ; en bas au centre, le seul appel, « Voir les projets ». Sur mobile, la planète passe au-dessus du texte.
  2. **Les 8 projets** : la caméra recule et chaque carte passe, fait sa mise au point et affiche son cartel ; un clic plonge dans la carte et ouvre l'étude de cas.
  3. **Contact**, dans le bureau qui termine le parcours : la caméra repasse par la fenêtre d'un appartement et s'arrête dans les yeux de la personne assise. « On s'écrit ? », l'email (un clic ouvre la messagerie et un bouton à l'icône de copie, à sa droite, copie l'adresse ; sur mobile, un toucher ouvre une bulle avec ces deux actions), LinkedIn, GitHub, CV en PDF, Instagram, puis le copyright. L'écran de l'ordinateur montre ce qu'il y a derrière chaque lien.
- **Étude de cas** : lien « Retour aux projets », numéro (01 / 08), média d'ouverture (la carte dans laquelle on a plongé), tag (année et type), titre, chapeau, fiche (année, rôle, stack, liens), puis _Contexte_, _Ce que j'ai fait_, _Défis techniques_ (chaque défi en trois temps : problème, solution, résultat), images et vidéos, le projet suivant (le dernier renvoie au premier) et, en bas, un lien « Contact » qui mène au bureau par le noir.
- **404** : message en français et en anglais, avec des liens vers les deux accueils.
- **Langues** : français à la racine, anglais sous `/en/` ; le sélecteur mène à la page équivalente ; aucune redirection automatique ; chaque page déclare `<html lang>` et ses alternatives `hreflang` (`x-default` vers le français).
- **Adresses dans l'accueil** : chaque ancre a un fragment (`#accueil`, `#projets`, `#<slug>`, `#contact` ; en anglais `#home`, `#projects`, `#<slug>`, `#contact` ; le sélecteur de langue traduit le fragment), pour pouvoir partager un endroit du parcours et y arriver directement.
- **Anciennes URL** : des pages de redirection statiques renvoient les pages des projets retenus vers leur étude de cas, `about.html` vers l'accueil et `contact.html` vers `/#contact`. Les autres aboutissent à la 404.

## 5. Direction artistique : « Musée de nuit »

La rigueur d'un musée d'art moderne (MoMA, MAM Paris), le calme photographique de _The Third & The Seventh_, la poésie du Petit Prince. Le site est une salle sombre : la planète y est exposée sous un spot, les projets passent devant la caméra comme des œuvres, chacun avec son cartel. Le parcours finit chez le rêveur qui regarde la planète : un bureau devant une fenêtre, sur une ville au bord d'une rivière.

### 5.1 Typographie

| Rôle             | Police                  | Réglages                                                                         |
| ---------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Titres           | Libre Franklin          | 500, interlettrage -0,035em ; titres de projet en 600, -0,02em                   |
| Sous-titres      | Libre Franklin italique | 300, interlettrage -0,01em ; le métier animé, les titres des cartels du mur      |
| Texte            | Manrope                 | 400 et 500                                                                       |
| Libellés         | Manrope                 | 500, 12 px, capitales, interlettrage 0,16em                                      |
| Tags des projets | Libre Franklin          | 600, 12 px, capitales, interlettrage 0,06em ; le type des images du mur en 11 px |

- Polices auto-hébergées via Fontsource (fichiers variables, licence OFL), deux fichiers préchargés au plus.
- Tailles de référence : nom de l'ouverture `clamp(52px, 6.07vw, 88px)` ; métier animé 27 px (23 px sur mobile) ; « On s'écrit ? » 56 px (30 px sur mobile) ; email du contact 24 px (18 px) ; titres de projet 28 px ; « Je code des images. » 28 px ; texte courant 15 à 18 px.
- Deux familles seulement, sans empattement : Libre Franklin et Manrope. Seule exception, l'écran de l'ordinateur du bureau imite Windows : il utilise la police du système (`"Segoe UI", system-ui`), sans fichier téléchargé.

### 5.2 Couleurs : « Noir musée »

| Jeton             | Rôle                                     | Valeur                         |
| ----------------- | ---------------------------------------- | ------------------------------ |
| `--color-bg`      | fond, en dégradé vertical                | `#0C0C0D` vers `#060607`       |
| `--color-surface` | cartes et médias                         | `#161618`                      |
| `--color-bubble`  | bulles et cartels du mur                 | `#19191B`, avec un filet clair |
| `--color-text`    | texte principal                          | `#F3F3F1`                      |
| `--color-muted`   | texte secondaire (contraste 5,9:1)       | `#8F8F8B`                      |
| `--color-accent`  | liens, étoiles, anneau de la carte nette | `#FFFFFF`                      |
| `--color-line`    | traits et bordures                       | `rgba(243, 243, 241, 0.14)`    |

- Les seules couleurs du site sont celles de la planète, des projets et du bureau (le ciel, la ville, les objets, les images du mur). L'écran de l'ordinateur garde les couleurs de Windows 11 en thème sombre (accent `#60CDFF`) : elles restent dans l'écran.
- Survol des liens : opacité 0,6. Focus : contour de 2 px de la couleur du texte.
- Un seul thème.

### 5.3 La lumière suit l'heure du visiteur

L'éclairage de la planète et la teinte du ciel dépendent de l'heure locale du visiteur : deux moments, l'aube avant midi et le crépuscule après midi, sur tout le site, bureau compris (les lumières du jour et de la nuit ont été retirées le 23 octobre 2026) :

| Période    | Heures     | Spot             | Ciel (décor) | Étoiles | Teinte en haut de page      |
| ---------- | ---------- | ---------------- | ------------ | ------- | --------------------------- |
| Aube       | avant midi | rosé `#FFC2A0`   | 55 %         | 70 %    | `rgba(255, 168, 140, 0.12)` |
| Crépuscule | après midi | orangé `#FFA070` | 70 %         | 80 %    | `rgba(255, 122, 80, 0.12)`  |

- Au bureau, l'aube montre un ciel du bleu nuit au rose pâle, la ville dans l'ombre bleutée et la lune pleine ; le crépuscule, un ciel de l'indigo à l'orange profond, le soleil qui se couche entre deux collines et beaucoup de fenêtres allumées (spec du bureau, section 4).
- Si la période change pendant la visite (à midi), la lumière passe de l'une à l'autre en fondu, sur quelques secondes.
- Un paramètre d'URL `?heure=aube|crepuscule` force une période, pour les tests et les captures.

### 5.4 Mise en page et composants

Le détail est dans les specs du parcours (sections 4 à 9) et du bureau (sections 3 à 7) ; voici ce qui structure le site.

- **L'espace** : un seul travelling arrière. La planète est l'objet le plus lointain et sert de point de fuite ; les projets sont posés le long du trajet ; trois couches d'étoiles (environ 60, 40 et 20) remplissent le volume, et des petits mondes blancs (vingt et un sur ordinateur, seize sur mobile) passent entre les projets.
- **Ouverture** : la planète à gauche (600 px), avec son décor d'étoiles et de planètes lumineuses ; le texte à droite, sur 580 px au plus, reste net pendant que la planète commence à reculer, puis s'efface en montant de quelques pixels juste avant le premier projet. L'appel « Voir les projets », en bas au centre, fait glisser la caméra jusqu'au premier projet et disparaît au premier mouvement.
- **Ancres** : le défilement s'arrête toujours sur une ancre : l'ouverture, chacun des huit projets (carte nette), puis le contact. Un geste (molette, pavé tactile, doigt, clavier) mène à l'ancre suivante ou précédente. Sur le tronçon d'un projet, la caméra suit `f(s) = s + k · sin(2πs) / 2π` (`k = 0,75`) : lente quand la carte est nette, rapide entre deux projets.
- **Cartes des projets** :
  - rectangles arrondis (20 px) au format 16:9, avec une vidéo en boucle (image fixe en attendant la vidéo), qui se met en pause dès que la carte sort de la zone nette ;
  - alternance gauche/droite irrégulière, centre libre ; position, largeur nette (30 à 38 % de l'écran) et rotation propres à chaque carte (spec du parcours, section 5) ;
  - **profondeur de champ** : la carte arrive floue par-dessus l'épaule, devient nette, puis repart vers la planète en rapetissant, en se floutant (jusqu'à 12 px) et en s'estompant (jusqu'à 0,25) ;
  - la carte nette porte un anneau blanc de 1 px à 55 % et un léger halo ; son **cartel** s'affiche du côté du centre, sur 300 px au plus : titre, tag « 2024 — Three.js · génératif », description courte ;
  - **indice de clic** : sur ordinateur, au survol de la carte nette, la souris devient un disque clair de 96 px « Voir le projet » ; sur mobile, un rond sombre de 38 px dans le coin bas droit de l'image, avec une flèche d'ouverture (↗, choisie par Grégoire le 29 octobre 2026) ;
  - **plongée** : au clic, la caméra repart vers l'avant (0,9 s), la carte vole droit à la place du média d'ouverture de l'étude de cas (toute la largeur, en haut) en gardant son format, et le devient ; « Retour aux projets » joue l'inverse et rend le parcours à la même progression. « Projet suivant » mène à l'étude suivante par une plongée dans son image.
- **Le bureau** (la fin du parcours) :
  - **l'arrivée**, en 3,5 s environ : le saut à la vitesse de la lumière en marche arrière (traînées d'étoiles, éclat anamorphique), le ciel du moment qui se lève, la ville qui monte par le bas, le cadre de la fenêtre qui surgit, puis la pièce qui se déploie en reculant pendant que la ville recule vers l'horizon ; une étoile filante d'accueil, une fois par visite ;
  - **la pièce**, vue des yeux d'une personne assise : à gauche, les images du mur ; au centre, une grande baie sur la ville ; à droite, au premier plan, l'écran, le clavier, la souris ; sur le bureau, la lampe allumée, la plante, le petit cadre photo, la plante grasse, la rose sous son globe et le pot à crayons. Sur mobile, un cadrage vertical : le ciel en haut, l'écran à droite, le clavier en bas ;
  - **le contact**, toujours visible : à gauche sur le mur sur ordinateur, sur un halo sombre centré sur le texte ; centré dans le ciel sous la planète sur mobile ;
  - **l'écran** : le bureau de Windows 11 avec la seule Corbeille et la barre des tâches de Grégoire ; au survol d'un lien, Firefox s'ouvre en grand sur la page du lien (Thunderbird pour l'email) et la page défile doucement si la souris reste ; la Corbeille, une fois vidée, relance le tirage des images du mur. Sur mobile, l'écran n'est qu'un décor et les liens s'ouvrent directement ;
  - **les images du mur** : six cadres sur le mur (ordinateur seulement) et un petit cadre sur le bureau, chacun d'un type (affiche de film, image de film, peinture, photo, pochette d'album) et avec ses propres images, tirées au hasard à chaque visite, recadrées à son format sans jamais changer d'orientation ; au survol, un cartel (titre, auteur, année) sous l'image.
- **Mobile** : le même parcours au doigt ; les projets passent près du centre (5 à 8 % de décalage), la carte nette sur environ 78 % de la largeur, son cartel en dessous.

### 5.5 Mouvement : « Poétique »

| Élément             | Comportement                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Planète             | flottement de ±10 px et ±1°, sur 7 s ; l'écharpe au vent et la rose qui se balance, avec un coup de vent toutes les 7 à 14 s                                                                                                                                             |
| Cartes              | flottement de ±12 px, sur 8 à 10,5 s, décalé d'une carte à l'autre                                                                                                                                                                                                       |
| Carte nette         | se soulève à peine au survol (450 ms) ; cartel en 300 ms, effacé en 200 ms                                                                                                                                                                                               |
| Caméra              | dérive très légère (quelques pixels, une fraction de degré, sur une dizaine de secondes) ; sur ordinateur, inclinaison de 1 à 2° vers la souris                                                                                                                          |
| Passage par le noir | extinction en 0,25 s (`cubic-bezier(0.32, 0, 0.67, 0)`), saut, retour en 0,35 s (`cubic-bezier(0.33, 1, 0.68, 1)`)                                                                                                                                                       |
| Bureau              | la tête suit la souris (au plus 13 px pour le bureau, 8 pour la pièce, 4 pour la ville, 2 pour le ciel, amorti de 0,5 s) ; nuages lents, fenêtres de la ville qui s'allument ou s'éteignent, étoile filante de temps en temps, l'heure de la barre des tâches qui avance |
| Métier animé        | « Creative developer », « Ingénieur multimédia », « Dreamer », « Full-stack developer », « Human » ; transition « apesanteur » de 1,8 s (les lettres s'envolent, les suivantes se posent), puis 2,4 s de pause                                                           |
| Étoiles             | scintillement de 2,5 à 7 s ; étoile filante toutes les 9 s sur l'ouverture                                                                                                                                                                                               |

- **Départ différé** (décidé avec Grégoire le 24 octobre 2026) : les animations d'ambiance (dérive de la caméra, flottements, scintillement, vent sur la planète) attendent le premier geste du visiteur (souris, doigt, molette, touche), ou 4 s après le chargement. Jusque-là, la scène ne se redessine pas au repos : la page se charge sur un fil principal tranquille (Lighthouse passe de 55 à plus de 90). Le métier animé n'attend pas.
- Courbes : `cubic-bezier(0.23, 1, 0.32, 1)` pour les réactions d'interface, `cubic-bezier(0.37, 0, 0.63, 1)` pour les flottements, `cubic-bezier(0.65, 0, 0.35, 1)` pour la plongée.
- En HTML et CSS, on n'anime que `transform`, `opacity` et `filter`.
- **Animations réduites, automatiquement** : si le visiteur a activé « réduire les animations » dans son système, ni recul, ni flottement, ni inclinaison, ni mouvement de tête : l'ouverture est fixe, les projets défilent en liste avec leur cartel toujours visible, puis le bureau, fixe derrière le contact, sans nuages, ni étoile filante, ni fenêtres qui s'allument ; un fondu de 200 ms remplace la plongée, un fondu l'arrivée au bureau ; les scènes 3D s'arrêtent sur une pose fixe, le métier change en fondu de 500 ms et les étoiles scintillent très lentement. **Il n'y a pas de bouton pause** : c'est un choix de Grégoire, qui s'écarte du critère WCAG 2.2.2 pour les visiteurs qui n'ont pas activé ce réglage.

## 6. Les scènes 3D

### 6.1 La planète : modèle

La planète de l'ouverture est la création Blender de Grégoire, rendue en temps réel avec Three.js. Les choix ci-dessous ont été validés sur des rendus faits avec un prototype (`docs/prototypes/petit-prince/`).

- **Source** : l'export glTF Binary de Grégoire (Blender, export glTF 2.0), avec « Apply Modifiers », « Visible Objects » et « Renderable Objects », la caméra et les 26 animations. Draco et Meshopt restent décochés à l'export.
- **Corrections** (`docs/prototypes/petit-prince/fixes.mjs`, avant l'optimisation) : le renard, dont le corps était à moitié dans la planète, est relevé de 0,18 le long de la verticale du sol pour s'y asseoir (même pose, ses actions déplacées d'autant) ; l'écharpe, un ruban qui passait derrière la nuque sans l'entourer, est d'abord rapprochée du cou sur son premier tronçon (le reste, au vent, ne bouge pas), puis prolongée depuis son bord par une nappe de même largeur qui fait le tour du cou en épousant le manteau et finit cachée derrière le départ du ruban.
- **Optimisation** (`docs/prototypes/petit-prince/optimize.mjs`, avec gltf-transform et meshoptimizer) : soudure des sommets, simplification par objet (décor fortement réduit, personnages intacts), normales lisses recalculées, quantification et compression `EXT_meshopt_compression`. Résultat : de 16,3 Mo et 446 000 triangles à 0,56 Mo et 56 000 triangles, sans différence visible. La rose garde ses UV, car son matériau anisotrope en a besoin.
- **Chargement** : `GLTFLoader` avec `MeshoptDecoder`. Après quantification, chaque maillage est porté par un nœud enfant sans nom : on le cherche à l'intérieur du nœud nommé.

### 6.2 La planète : relief généré par le code

Le relief de la planète et les cheveux du prince viennent du matériau dans Blender, et un glTF ne peut pas l'exporter. Ils sont donc générés au chargement, avec un tirage fixe pour que la planète soit toujours la même :

- **Planète** : icosphère (détail 110, réduit sur mobile), surface bosselée (bruit simplex, 5 octaves) et 46 cratères (cuvette et rebord), atténués là où se tiennent le prince, le renard et la rose.
- **Cheveux** : boucles froissées, comme sur le rendu Blender : icosphère (détail 64) plissée par un bruit simplex « en crêtes » adouci, sur 2 octaves. Leur matière est un or plus vif et plus brillant que celui du fichier (`#F5CB3A`, rugosité 0,4).

### 6.3 La planète : lumière et caméra

- **Éclairage « Noir musée »** : un spot de musée (angle 0,165 rad, pénombre totale) braqué sur le prince et le renard depuis le haut à gauche, ombres douces ; une lumière d'ambiance presque nulle, un contre-jour froid et léger ; tone mapping ACES, environnement très faible. La planète plonge dans l'ombre vers le bas.
- Les deux moments (section 5.3) changent la couleur et la force du spot.
- **Caméra** : vue de dessus, comme le rendu d'origine (le prince se tient en haut de la planète, le renard vu de dos, l'écharpe au vent vers la droite), champ de 20°. La caméra exportée, avec son animation, peut servir à une entrée en matière au chargement.
- **Décor** : les étoiles, planètes lumineuses et anneaux du modèle, en blanc, rapprochés de la planète et réduits ; léger halo (bloom) sur eux seulement. Ce décor reste l'image rendue par le prototype (`decor.webp`, avec son halo), comme dans la maquette : la scène vivante ne dessine que la planète, les personnages et la rose, sans passe de post-traitement.
- **Animations** : les actions du modèle ne bougent en fait que la caméra exportée et l'étoile filante (vérifié sur le modèle web le 24 octobre 2026) ; le reste est fixe. L'écharpe et la rose suivent le souffle validé sur la maquette : une vague de 6 s du cou au bout du ruban, la rose de −1,2° à 2,4°, et un coup de vent toutes les 7 à 14 s (1,6 fois plus vite pendant 2,2 s). Le vent se lève en 1,5 s quand la planète vivante apparaît, pour qu'elle quitte sans saut la pose de son image.
- **Canevas** : la planète vivante a son propre petit canevas, posé dans le carré de l'image de repli, avec la caméra du prototype : elle tombe exactement sur l'image et reprend du CSS le flottement, le recul et le flou de l'ouverture.

### 6.4 La planète dans le parcours

- **En s'éloignant**, la planète glisse vers le centre et devient une petite lumière floue, qu'on retrouve dans le ciel du bureau avec « B 612 » au survol. Une fois qu'elle n'est plus qu'une lumière floue, la scène 3D s'arrête et une image la remplace en fondu, au même point : on ne paie le rendu en temps réel que tant que la planète se voit.
- Three.js et la scène sont importés dynamiquement après le premier affichage, jamais sur le chemin critique. La planète vivante se charge quand les animations d'ambiance démarrent (voir section 5.5).
- **Image de repli** : pour chaque période, un rendu fixe en WebP (environ 45 Ko) s'affiche tout de suite. Il reste en place sans JavaScript, sans WebGL ou avec `?gl=0`, et la scène vivante le remplace en fondu quand elle est prête.
- Rendu en pause quand l'onglet est caché ; densité de pixels plafonnée à 2 (1,5 sur mobile) ; carte d'ombres de 2 048 px.
- **Version allégée** : si la cadence reste sous 40 images par seconde pendant les 3 premières secondes, la scène se fige sur l'image de repli (pour toute la visite ; sans carte graphique, quand WebGL est rendu en logiciel, la planète vivante ne se charge même pas ; `?planete=live` la garde, pour les tests et les captures) et le site passe à la version allégée : la planète s'éloigne au début, puis les projets défilent en liste, sans 3D, jusqu'au bureau fixe.

### 6.5 Le bureau

- **La scène** est en code (`docs/prototypes/bureau/scene.js`) et c'est la version finale : la pièce et les cadres des images, les objets du bureau, la ville générée (quartiers, relief, rivière, ponts, quais, parc, monuments, collines sur cinq plans), les deux lumières et les deux cadrages (ordinateur et mobile). Même rendu que la planète (tone mapping ACES, ombres adoucies), sans photoréalisme. La rose est celle du modèle de Grégoire.
- **En temps réel, les couches en secours** (choix de Grégoire du 23 octobre 2026, après la mesure : `docs/prototypes/perf/RESULTS.md`) :
  - **en temps réel**, partout où l'appareil suit : la scène elle-même, ce qui donne la vraie parallaxe dans la ville quand on entre par la fenêtre (les toits proches reculent plus vite que les collines) et les mouvements de tête sans marge. Mesuré à 60 images par seconde une fois assis, sur l'ordinateur portable de Grégoire comme sur son Pixel 9. Trois conditions : la ville est construite hors du fil principal (dans un worker, ou cuite au build en modèle compressé), car sa construction bloque la page 0,6 à 1 s ; la scène est préchauffée pendant le parcours (tous les shaders compilés et tous les tampons envoyés au GPU avant l'arrivée), sinon l'arrivée accroche au premier affichage ; les ombres sont calculées une fois, la pièce ne bougeant pas ;
  - **en couches pré-rendues**, en secours, comme dans la maquette : pour chaque moment et chaque cadrage, trois couches détourées en WebP (la ville, la pièce, le bureau), avec 4 % de marge pour les mouvements de tête, et une couche des fenêtres allumées pour la vie de la ville. Le ciel, les étoiles et la planète restent en direct, pour que le parcours continue à travers la fenêtre. Les couches sont rendues depuis la scène du site elle-même (`pnpm render-office-layers`, qui écrit aussi `placement.json`) et versionnées, pour que la scène en temps réel et ses couches ne puissent pas diverger ; elles pèsent de 160 à 380 Ko par visiteur, écran compris.
  - **Comment la scène reproduit les couches** (étape 7) : elle est dessinée en trois passes, comme l'étaient les couches : la ville sous ses lumières extérieures, puis la pièce, puis le bureau, chacun sous sa propre copie des lumières intérieures et sur un tampon de profondeur vidé ; ainsi chaque passe ne reçoit que les ombres de ses propres objets, et le rendu assis est identique aux couches de la maquette. Pendant l'arrivée, la caméra de la pièce et du bureau recule vraiment par la fenêtre jusqu'à la place assise, tandis que la ville garde la caméra assise et s'agrandit puis recule (de 1,6× à 1×), comme la couche de la ville de la maquette : plus simple qu'une compression de profondeur, sans artefact. Les images du mur sont des textures sur les faces blanches des cadres, éclairées par la lampe et cachées par les objets devant elles. Le cadre de la maquette (1440 × 900 sur ordinateur, 390 × 844 sur mobile) couvre la section du contact, comme une image en `object-fit: cover`. Les halos du soleil couchant et de la lampe sont fusionnés en « écran », comme dans la maquette. L'écran de l'ordinateur montre une image (fond d'écran et barre des tâches) jusqu'à l'étape 8.
  - La bascule se fait sur la cadence mesurée, pas sur le type d'appareil : si le bureau reste sous 40 images par seconde pendant ses premières secondes, il passe sur les couches. Les couches sont aussi l'image de repli du bureau sans JavaScript, sans WebGL, dans la version allégée et avec « réduire les animations ». Sur le téléphone, elles ne sont pas plus fluides que le temps réel (arrivée à 44 images par seconde sur le Pixel 9).
- **Le calage** : les quatre coins de l'écran de l'ordinateur et de la face de chaque image sont donnés par la scène (projetés à chaque image en temps réel, ou relevés dans `placement.json` avec les couches). L'écran (bureau de Windows, Firefox, Thunderbird) est en HTML, calé en perspective par une transformation CSS (`matrix3d`). Avec les couches, les images du mur le sont aussi : une image se multiplie sur la face blanche du cadre et prend ainsi la lumière de la pièce ; en temps réel, elles sont des textures de la scène.
- **Chargement** : la scène du bureau (ou ses couches) se charge pendant que le visiteur parcourt les projets, à partir du milieu du parcours, ou tout de suite quand il arrive par `#contact`. Les captures des pages de l'écran se chargent au premier survol d'un lien du contact.

## 7. Architecture technique

### 7.1 Stack

Astro (sortie statique), TypeScript strict, Three.js, polices via Fontsource, pnpm, Node 24 (LTS). Ni Lenis ni GSAP : le défilement reste natif et une seule boucle `requestAnimationFrame` anime tout (section 7.4, décidé à l'étape 6, le 24 octobre 2026).

### 7.2 Arborescence

```
src/
  config.ts             réglages du site (email, liens sociaux)
  content.config.ts     collections et schémas de validation
  content/projects/<slug>/
                        project.yaml + fr.md + en.md + médias
  content/wall/<cadre>/ une image du mur par fichier : <image>.yaml + l'image
  i18n/                 fr.ts (référence), en.ts, routes.ts
  layouts/Base.astro    <html lang>, métadonnées, hreflang, en-tête, routeur client
  components/           Header, Menu, Opening, JobTitle, Journey, ProjectCard, Cartel,
                        Office, OfficeScreen, Wall, Contact, CaseStudy…
  pages/                index, projets/[slug], 404 ; en/ : index, projects/[slug]
  scene/
    planet/             scène du Petit Prince : chargement, relief, lumières, vent
    office/             scène du bureau, reprise de docs/prototypes/bureau
    journey/            caméra du parcours : ancres, paliers, mise au point, saut
    time.ts             heure du visiteur et moment (aube, crépuscule)
  motion/               flottements, survols, passage par le noir, métier animé, menu
  styles/               jetons (variables CSS), base
public/
  models/               petit-prince.glb (version optimisée)
  images/               rendus de repli de la planète, couches du bureau, captures de l'écran,
                        fond d'écran, icônes de la barre des tâches
  cv/                   CV en PDF (en anglais, seule version, sans numéro de téléphone)
scripts/                rendu des couches et des images de repli, optimisation des médias
tests/
  unit/                 Vitest
  e2e/                  Playwright
docs/
  specs/                cette spec et celles de la v3
  prototypes/           prototypes de rendu, d'optimisation et de mesure
```

### 7.3 Contenu et traductions

**Un dossier par projet** (`src/content/projects/<slug>/`) :

- `project.yaml`, les données qui ne se traduisent pas : `order`, `year`, `stack`, `links` (`live`, `code`, `video`, `gallery` pour une galerie comme Behance, facultatifs), `cover`, `coverFocus` (facultatif), `loop` (vidéo de la carte, facultative) ;
- `fr.md` et `en.md` : en en-tête `title`, `kind`, `role`, `summary` (la description courte du cartel, reprise pour le SEO) et `coverAlt` ; dans le corps, l'étude de cas en Markdown.

La position, la largeur nette et la rotation des 8 cartes dans le parcours sont définies dans le code, par emplacement, dans l'ordre des projets (spec du parcours, section 5), comme les petits mondes.

**Un dossier par cadre du mur** (`src/content/wall/<cadre>/`, les cadres sont fixés dans le code avec leur type et leur format) : pour chaque image, le fichier et un `.yaml` avec `title` (en français et en anglais pour les films, avec `originalTitle`), `author`, `year`, `credit` (une mention obligatoire, comme « NASA, Apollo 8, Bill Anders »), tous facultatifs, et `focus` (le point d'intérêt du recadrage). Le cartel n'affiche que ce qui est connu, et une image sans rien de connu n'a pas de cartel.

**Le tirage** se fait dans le navigateur, à chaque visite et à chaque Corbeille vidée : chaque cadre tire l'une de ses images, différente de la précédente quand il en a plusieurs. Sans JavaScript, chaque cadre montre sa première image.

**Vérifications au build** : le build échoue avec un message explicite si un champ manque ou est mal typé (Zod), si une image est introuvable, si un projet n'a pas son `fr.md` ou son `en.md`, si deux projets ont le même `order`, si une image du mur fait moins de 600 px de côté, ou si son orientation ne va pas avec son cadre (jamais du portrait au paysage ni l'inverse, ni du 16:9 au carré ni l'inverse).

**Textes de l'interface** : `fr.ts` fait référence ; `en.ts` est typé pour avoir exactement les mêmes clés.

**URL** : une fonction utilitaire ajoute le chemin de base (`/portfoliov2/` pendant la prévisualisation, `/` après la mise en service). La correspondance FR ↔ EN est définie à un seul endroit (`i18n/routes.ts`).

**Vidéos** : les boucles des cartes et des études de cas (muettes, `playsinline`, 4 Mo au plus, avec une image fixe) sont hébergées dans le repo. Dans le parcours, seule la carte nette et ses deux voisines chargent leur vidéo, et seule la carte nette la joue. Avec « réduire les animations », on n'affiche que l'image fixe. Les vidéos longues restent sur YouTube, chargées au clic (`youtube-nocookie.com`).

**Médias de tiers et de Grégoire** : le site publie forcément les versions web des images du mur, du fond d'écran et des captures des pages. Seules ces versions web, à la taille où le site les montre, sont versionnées, avec leurs crédits ; les originaux en haute définition restent hors du dépôt (`.design-assets/`). Décision de Grégoire du 23 octobre 2026.

### 7.4 Navigation et scène

- **Le parcours** : le défilement natif, aimanté sur les ancres par le CSS (`scroll-snap`), que la caméra suit avec une légère inertie ; un module d'ancres amène toujours le défilement sur l'ancre suivante ou précédente après un geste (un cran ou un geste de pavé tactile, inertie comprise, un glissement du doigt de plus de 40 px, une touche), en suivant la courbe des paliers ; le glissement part à la vitesse du doigt. Lenis n'apporte rien ici : l'aimantation et les glissements d'ancre en ancre remplacent son lissage, sans dépendance. Le défilement reste natif (barre de défilement, clavier, lecteurs d'écran) : il n'est jamais bloqué, et la hauteur de la page reprend les douze écrans et demi de la maquette.
- **Le clavier** : Tab passe d'un projet à l'autre dans l'ordre, la caméra glisse jusqu'à l'ancre du projet qui reçoit le focus, Entrée l'ouvre.
- **Le routeur client d'Astro** conserve les scènes d'une page à l'autre (`transition:persist`). La plongée remplace la planète qui s'éloigne de la v2 : la carte cliquée vole, dans la scène 3D du parcours, jusqu'à la place exacte du média d'ouverture de l'étude de cas, sans changer de format, puis le routeur affiche l'étude de cas autour d'elle (une transition de vue nommée relie la carte au média d'ouverture). Avant de partir, l'adresse de l'accueil prend le fragment du projet (`#what-we-play`), sans nouvelle entrée d'historique : « Retour aux projets » et le bouton Retour du navigateur ramènent ainsi le parcours sur le même projet, où l'image, revenue seule à la place du média d'ouverture, redevient la carte et rejoint sa place pendant que le reste réapparaît. Avec « réduire les animations », le routeur fait un fondu de 200 ms.
- **Le passage par le noir** sert aux liens de l'en-tête, au menu mobile, au lien « Contact » des études de cas et à la Corbeille : un voile couvre la page, la caméra saute, le voile se lève.
- **Les cartes** sont en HTML, en 3D CSS par-dessus la scène Three.js, comme dans la maquette : accessibles et cliquables sans couche invisible. La mesure (étape 1) l'a confirmé : des plans WebGL floutés dans le rendu ne sont pas plus fluides, ni sur ordinateur ni sur téléphone.
- **Les étoiles** (les trois couches et leur scintillement) sont dessinées en WebGL, en un seul nuage de points dont le scintillement est calculé dans le shader, jamais en éléments HTML animés : à la mesure, les 120 étoiles en HTML faisaient tomber le parcours de 60 à 45 images par seconde sur le Pixel 9, et rien d'autre ne le ralentissait (ni les cartes floutées, ni les petits mondes, ni la vidéo).
- Une seule boucle d'animation (`src/motion/ticker.ts`, un `requestAnimationFrame` arrêté quand l'onglet est caché) pilote les glissements, la caméra du parcours, les animations et le rendu 3D. Au repos, seuls les flottements bougent, de quelques pixels par seconde : la boucle les dessine alors 20 fois par seconde, ce qui ne se voit pas et libère le processeur ; un glissement, la souris ou un survol redessinent à chaque image. Le dessin d'une image ne relit jamais la mise en page (testé de bout en bout).

### 7.5 Amélioration progressive

- Tout le contenu est en HTML sémantique et reste lisible sans JavaScript : l'ouverture, les projets en liste avec leur cartel, puis le contact sur une image fixe du bureau.
- Les états cachés des animations ne s'appliquent que si JavaScript est actif. Sans JavaScript, rien n'est masqué.
- Navigation au clavier : les cartes reçoivent le focus et affichent leur cartel ; focus visible ; lien d'évitement vers le contenu.
- Un lecteur d'écran lit l'ouverture, les projets dans l'ordre, puis le contact. La 3D, le flou, l'écran de l'ordinateur et les images du mur sont décoratifs ; le bouton de copie de l'email s'appelle « Copier l'adresse » et annonce « Adresse copiée ».

## 8. Contenu

### 8.1 Les 8 projets

| #   | Slug                       | Projet                     | Tag                             | Ce que l'étude de cas met en avant                                                                                                                                                                              |
| --- | -------------------------- | -------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `la-fabrique-des-mondes`   | La Fabrique des Mondes     | 2024 — Three.js · génératif     | God game en Three.js où chaque élément matérialise un procédé : attracteurs étranges, triangle de Sierpiński, paysage adaptatif, voyageur de commerce, éponge de Menger, L-systèmes, automate de Wolfram, boids |
| 2   | `what-we-play`             | What we play?              | 2025 — Web · 3D en CSS          | TV-personnage qui réagit à l'utilisateur ; Mac 3D en CSS pur avec un pion animé par joueur ; trois langues à routes typées ; pré-rendu et SEO ; tests e2e                                                       |
| 3   | `litterature-combinatoire` | Littérature & Combinatoire | 2023 — Web · temps réel · vidéo | Exposition et site de génération de textes par combinaison (PHP Slim, SQL, Socket.io), en équipe de quatre ; vidéo promotionnelle (Premiere Pro, After Effects)                                                 |
| 4   | `sncf-wrapped`             | SNCF Wrapped               | 2026 — Récit de données         | Bilan annuel des trajets en train, raconté écran par écran ; tout se passe dans le navigateur, ce que garantit un test ; carte à partager ; tests aléatoires                                                    |
| 5   | `recoding`                 | Recoding                   | 2022 — Art génératif            | Art génératif et interactif (p5.js, TypeScript), en binôme                                                                                                                                                      |
| 6   | `lyrix`                    | Lyrix                      | 2026 — Jeu multijoueur          | Jeu à la Pédantix sur des paroles : multijoueur en temps réel (Durable Objects, WebSockets), indices par embeddings précalculés, backend Cloudflare Workers + Hono qui garde les paroles secrètes, tests        |
| 7   | `le-petit-prince`          | Le Petit Prince            | [année] — Animation 3D          | Courte animation 3D réalisée sous Blender, celle qui ouvre le site                                                                                                                                              |
| 8   | `obaine`                   | Obaine                     | [année] — Front-end             | Front-end d'une plateforme de financement d'athlètes par leurs fans (Vue, Pinia, Vue Router, Vitest, Docker)                                                                                                    |

Claude rédige une première version des études de cas en français et en anglais, à partir de l'ancien site et du code des repos ; Grégoire la corrige et la complète.

### 8.2 À fournir par Grégoire

- les vidéos en boucle des 8 projets ;
- les années et rôles à confirmer, en particulier pour Le Petit Prince et Obaine, et l'adresse en ligne de Lyrix ;
- des images pour chaque cadre du mur et pour le petit cadre du bureau : au moins 600 px de côté, d'un format proche de celui du cadre, avec le titre, l'auteur, l'année et la mention de crédit quand il les connaît. Pour l'instant, chaque cadre n'a qu'une image (sélection actuelle : spec du bureau, section 3) ;
- les photos et visuels en haute définition des études de cas ;
- de nouvelles captures de LinkedIn, GitHub et Instagram si ces pages changent avant la mise en service (méthode : spec du bureau, section 6).

Déjà fournis, gardés dans les fichiers du canevas : le CV (en anglais seulement et sans numéro de téléphone ; publié tel quel avec son adresse, décision de Grégoire du 24 octobre 2026, dans `public/cv/`), les captures des pages, le fond d'écran, les icônes de la barre des tâches et de la Corbeille ; l'adresse email à afficher est contact@gregoiretinn.es.

## 9. Qualité

### 9.1 Commandes

| Commande            | Rôle                                                      |
| ------------------- | --------------------------------------------------------- |
| `pnpm lint`         | ESLint (TypeScript, Astro)                                |
| `pnpm format:check` | Prettier                                                  |
| `pnpm check`        | `astro check` : typage, clés de traduction comprises      |
| `pnpm test`         | tests unitaires (Vitest)                                  |
| `pnpm build`        | build, vérifications de contenu comprises                 |
| `pnpm test:e2e`     | tests de bout en bout (Playwright, sur le site construit) |

### 9.2 Tests unitaires

- correspondance FR ↔ EN des pages et ajout du chemin de base aux URL ;
- vérifications du contenu (paire FR/EN, `order` unique, taille et orientation des images du mur) ;
- passage de l'heure au moment (bornes comprises) et paramètre `?heure=` ;
- génération du relief : même tirage, même géométrie ;
- courbe des paliers et ancres : la caméra s'arrête toujours sur une ancre, et la carte d'une ancre est nette ;
- tirage des images du mur : chaque cadre tire l'une de ses images, jamais celle d'un autre cadre, et en change quand il en a plusieurs ;
- cartel du mur : il n'affiche que ce qui est connu.

### 9.3 Tests de bout en bout (Chromium)

- chaque page répond et s'affiche, en français et en anglais ; le sélecteur de langue mène à la page équivalente ;
- aucun lien interne cassé, aucune erreur dans la console ;
- le contenu reste visible sans JavaScript, et les images de repli de la planète et du bureau s'affichent sans WebGL ;
- avec « réduire les animations », rien ne flotte, les projets sont en liste et les scènes sont figées ;
- au clavier, Tab amène chaque projet net avec son cartel, et Entrée l'ouvre ;
- un lien de l'en-tête mène à son ancre, et `/#contact` arrive directement au bureau ;
- ouvrir une étude de cas depuis le parcours puis revenir rend le parcours au même projet ;
- le bouton « Copier l'adresse » copie contact@gregoiretinn.es ;
- vider la Corbeille ouvre le message, et les images du mur restent chacune dans son cadre ;
- l'audit axe ne relève aucune violation sur l'accueil et une étude de cas, dans les deux langues.

### 9.4 Budgets de performance

- JavaScript initial de 60 Ko compressés au plus, scènes 3D chargées en différé non comprises ;
- modèle de la planète de 600 Ko au plus ; images de repli de la planète de 50 Ko au plus chacune ;
- LCP de 2,5 s au plus (Lighthouse, mobile), l'image de repli de la planète servant d'élément LCP ;
- deux fichiers de police préchargés au plus ;
- **le bureau** : 500 Ko au plus pour ce que charge un visiteur (un moment, un cadrage), qu'il s'agisse de la scène en temps réel (code et géométrie compressés) ou des couches (trois couches et celle des fenêtres) ; rien n'est chargé avant le premier projet ;
- **l'écran** : 1,5 Mo au plus pour les quatre captures des pages (WebP ou AVIF, 1 280 px de large, découpées en tranches pour la longue page de LinkedIn), chargées au premier survol d'un lien ; les icônes de la barre des tâches, 40 Ko au plus en tout (une bande WebP, reprise de la maquette, depuis l'étape 8) ;
- **les images du mur** : 40 Ko au plus chacune, à la taille où le site les montre ; seules les images tirées sont chargées ;
- **la cadence** : 60 images par seconde sur un ordinateur de milieu de gamme pendant tout le parcours et l'arrivée au bureau ; sur mobile, la version allégée prend le relais sous 40 images par seconde ;
- les budgets de mémoire et de nombre d'objets de la scène du bureau sont fixés par la mesure (étape 1).

## 10. Mise en ligne

- **CI** (`.github/workflows/ci.yml`), à chaque push et à chaque pull request : installation, lint, formatage, `astro check`, tests unitaires, build, tests e2e.
- **Déploiement** (`.github/workflows/deploy.yml`), à chaque push sur `main` : build, puis publication sur GitHub Pages.
- **Branches** : `main` est la branche publiée ; chaque tâche se fait sur sa propre branche, ouverte depuis `main`, avec sa propre pull request, que Grégoire relit et fusionne.
- **Prévisualisation** : pendant la construction, le site est publié sur `https://greg0s.github.io/portfoliov2/`. L'ancien site reste en ligne sur `gregoiretinn.es`.
- **Mise en service** (étape 12), avec l'accord explicite de Grégoire au moment venu :
  1. retirer le domaine personnalisé du repo `Greg0s/portfolio` ;
  2. déclarer `gregoiretinn.es` dans les réglages GitHub Pages de `Greg0s/portfoliov2`, et passer le chemin de base à `/` ;
  3. vérifier le HTTPS et les redirections des anciennes URL ;
  4. archiver `Greg0s/portfolio`.

  Les DNS ne changent pas, puisque les deux repos sont sur GitHub Pages. Les sous-domaines `whatweplay` et `topaventura` ne sont pas concernés.

- **Langue des documents** : le `README.md` est en anglais (repo public, lu par des recruteurs). Cette spec et les échanges de travail restent en français.

## 11. Étapes de construction

À partir de l'étape 2, chaque étape se termine avec une CI verte et le site à jour sur la prévisualisation.

| #   | Étape                 | Contenu                                                                                                                                                                                                                                                                  | Terminée quand                                                                                                                                                                         |
| --- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Maquette              | Maquette Claude Design v3 et charte « Musée de nuit », affinées jusqu'au moindre détail                                                                                                                                                                                  | **Faite** : Grégoire a validé la maquette v3 le 23 octobre 2026                                                                                                                        |
| 1   | Mesure                | Un prototype de mesure dans `docs/prototypes/` : le bureau rendu en temps réel par la scène du prototype, et le parcours avec ses cartes floutées en CSS ; mesures d'images par seconde, de poids et de mémoire sur un téléphone et sur un ordinateur de milieu de gamme | **Faite** le 23 octobre 2026 : bureau en temps réel, couches en secours (section 6.5) ; cartes en CSS, étoiles en WebGL (section 7.4) ; rapport dans `docs/prototypes/perf/RESULTS.md` |
| 2   | Fondations            | Projet Astro, TypeScript strict, ESLint, Prettier, Vitest, Playwright, CI, déploiement, `README.md`, `CLAUDE.md` à jour                                                                                                                                                  | le squelette se construit et se déploie sur la prévisualisation, et la CI est verte                                                                                                    |
| 3   | Design system         | Jetons de la charte, polices, en-tête, menu mobile, routage FR/EN, sélecteur de langue, textes d'interface typés                                                                                                                                                         | les pages vides existent en FR et en EN et les tests de routes passent                                                                                                                 |
| 4   | Contenu               | Schémas, vérifications, page d'étude de cas, import des 8 projets en brouillon, collection du mur, images optimisées                                                                                                                                                     | les 8 études de cas s'affichent en FR et en EN, et supprimer un `fr.md` fait échouer le build                                                                                          |
| 5   | Accueil statique      | L'accueil sans animation : ouverture avec les images de repli par moment, projets en liste avec leur cartel, contact sur l'image fixe du bureau, 404, SEO, redirections                                                                                                  | l'accueil est complet et utilisable sans JavaScript                                                                                                                                    |
| 6   | Parcours              | Le recul au défilement : ancres, paliers, profondeur de champ, cartels, curseur « Voir le projet », clavier, étoiles et petits mondes, flottements, métier animé, passage par le noir ; animations réduites automatiques                                                 | le parcours va de l'ouverture au contact au doigt, à la molette et au clavier, et le test e2e « réduire les animations » passe                                                         |
| 7   | Scènes 3D             | La planète (modèle, relief, éclairage, vent, lumière selon l'heure) puis le bureau, selon la mesure ; le saut à la vitesse de la lumière et l'arrivée par la fenêtre ; la tête qui suit la souris ; la vie de la pièce ; chargement différé, replis, version allégée     | les scènes tiennent les budgets de la section 9.4, se dégradent proprement sur mobile, et la performance Lighthouse reste à 90 ou plus                                                 |
| 8   | Bureau interactif     | L'écran : bureau de Windows, barre des tâches, Firefox et Thunderbird au survol, défilement des pages, Corbeille ; le mur : tirage, calage, cartels ; les actions de l'email                                                                                             | chaque lien du contact montre sa page sur l'écran, et vider la Corbeille relance le tirage                                                                                             |
| 9   | Médias et transitions | Vidéos des cartes, plongée vers une étude de cas et retour au même endroit, projet suivant, scènes conservées par le routeur                                                                                                                                             | le parcours complet est fluide et se dégrade proprement                                                                                                                                |
| 10  | Rédaction             | Études de cas complètes en FR et en EN, CV, visuels et photos HD, images du mur et leurs crédits                                                                                                                                                                         | Grégoire a tout relu et validé                                                                                                                                                         |
| 11  | Finitions             | Accessibilité, performance, SEO, images de partage, sitemap, tests e2e complets                                                                                                                                                                                          | les objectifs Lighthouse sont atteints                                                                                                                                                 |
| 12  | Mise en service       | Transfert du domaine (section 10)                                                                                                                                                                                                                                        | `gregoiretinn.es` sert le nouveau site en HTTPS et l'ancien repo est archivé                                                                                                           |

Le `CLAUDE.md`, mis à jour à l'étape 2, garde la consigne générale de Grégoire : Claude a toujours la liberté de lui proposer des choses surprenantes, en les présentant comme des choix.

## 12. Risques et parades

| Risque                                                                                                               | Parade                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scène de la planète trop lourde sur mobile (génération du relief, ombres)                                            | détail du relief réduit sur mobile, densité de pixels plafonnée, ombres en 2 048 px, rendu arrêté dès qu'elle n'est plus qu'une lumière floue, version allégée si la cadence chute                                                                                                                                                                                                  |
| Bureau trop lourd en temps réel, surtout sur mobile (ville générée, nombreux objets, ombres, deux scènes en mémoire) | mesuré à l'étape 1 : 60 images par seconde une fois assis sur ordinateur et sur téléphone ; ville construite hors du fil principal, scène préchauffée avant l'arrivée ; géométrie de la ville fusionnée et instanciée, ombres de la pièce figées après l'arrivée, planète libérée de la mémoire avant le bureau ; repli sur les couches pré-rendues, déjà validées dans la maquette |
| Cartes floutées coûteuses (flou CSS sur des vidéos, une dizaine de plans en 3D)                                      | une seule vidéo jouée à la fois, flou plafonné à 12 px, cartes lointaines remplacées par leur image fixe ; la mesure a montré que des plans WebGL n'y gagnent rien                                                                                                                                                                                                                  |
| Défilement par ancres mal vécu (pavés tactiles à inertie, molettes libres, lecteurs d'écran)                         | défilement natif suivi par la caméra et jamais bloqué, seuils réglés sur plusieurs appareils pendant l'étape 6 ; liste avec « réduire les animations »                                                                                                                                                                                                                              |
| Plongée et scènes conservées délicates avec le routeur client                                                        | testées dès l'étape 9 ; repli sur un simple fondu                                                                                                                                                                                                                                                                                                                                   |
| Animations sans bouton pause (critère WCAG 2.2.2)                                                                    | choix assumé de Grégoire ; « réduire les animations » est respecté automatiquement                                                                                                                                                                                                                                                                                                  |
| Poids des vidéos des cartes                                                                                          | 4 Mo au plus par boucle, seule la carte nette et ses voisines les chargent, pause hors de la zone nette, image fixe avec « réduire les animations »                                                                                                                                                                                                                                 |
| Poids des captures de l'écran                                                                                        | chargées au premier survol, découpées en tranches, budget de la section 9.4 ; aucune sur mobile                                                                                                                                                                                                                                                                                     |
| Captures périmées (LinkedIn, GitHub, Instagram qui changent)                                                         | refaites avant la mise en service, avec la méthode de la spec du bureau ; le lien mène toujours à la vraie page                                                                                                                                                                                                                                                                     |
| Images de tiers au mur (affiches, images de films, peintures, pochettes) et personnes visibles dans les captures     | versions légères à la taille d'affichage, crédits sur les cartels, personnes floutées dans les captures, retrait sur simple demande                                                                                                                                                                                                                                                 |
| Anciens visuels en basse résolution                                                                                  | vidéos et photos originales en haute définition, nouvelles captures des sites en ligne                                                                                                                                                                                                                                                                                              |
| Charge de rédaction bilingue                                                                                         | premières versions rédigées par Claude et relues par Grégoire ; le build bloque toute traduction manquante                                                                                                                                                                                                                                                                          |
