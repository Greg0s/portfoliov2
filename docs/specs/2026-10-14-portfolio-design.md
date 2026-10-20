# Portfolio v2 : spécification de design

- **Date** : 14 octobre 2026, révisée le 18 octobre 2026
- **Auteur** : Grégoire Tinnes, avec Claude
- **Statut** : direction « Musée de nuit » et charte graphique validées par Grégoire sur la maquette
- **Méthode** : la maquette est affinée jusqu'à être parfaite avant d'intégrer quoi que ce soit. Pas de page « bientôt » : le site réel n'est pas prioritaire.
- **Maquette de référence** : canevas Claude Design ([lien privé](https://claude.ai/artifact/Wj6dMenazXWimo8dPHnPnb)) avec l'accueil (ordinateur et mobile), une étude de cas et la planche de charte. Une évolution du design se fait d'abord sur la maquette, puis dans le code.
- **Évolution en cours** : la maquette v3, un parcours au défilement (`2026-10-20-maquette-v3-parcours.md`), remplacera la mise en page de l'accueil (5.4), une partie du mouvement (5.5) et la transition vers les études de cas (7.4). Cette spec sera mise à jour quand la maquette v3 sera validée.

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
3. La scène 3D ne bloque jamais l'accès au contenu : le site reste complet sans JavaScript, sans WebGL et avec « réduire les animations ».
4. Scores Lighthouse sur mobile avant la mise en service : performance ≥ 90, accessibilité 100, SEO 100.
5. Ajouter un projet consiste à créer un dossier de contenu, sans toucher au code.

## 3. Périmètre

**Dans la V1** : l'accueil, les 8 études de cas et la page 404, en français et en anglais ; la scène 3D du Petit Prince avec la lumière qui suit l'heure du visiteur ; le déploiement automatique et la mise en service sur `gregoiretinn.es`.

**Hors V1** : page À propos, lab d'expérimentations, blog, formulaire de contact, mode clair, statistiques de visite, archive des autres projets. Idées écartées pour l'instant, à garder en réserve : la lumière qui suit la souris, le renard qui tourne la tête vers le curseur, une planète différente à chaque visite.

## 4. Pages et navigation

| Page             | Français             | Anglais                |
| ---------------- | -------------------- | ---------------------- |
| Accueil          | `/`                  | `/en/`                 |
| Étude de cas     | `/projets/<slug>/`   | `/en/projects/<slug>/` |
| Page introuvable | `404.html`, bilingue |                        |

- Le slug d'un projet est identique dans les deux langues.
- **En-tête** : le nom (libellé, lien vers l'accueil), Projets, Contact, sélecteur FR/EN. Sur mobile, un bouton « Menu » ouvre une navigation plein écran.
- **Accueil**, une seule page qui se déroule :
  1. **Ouverture** : la planète du Petit Prince en 3D à gauche ; à droite, le nom, le métier animé, « Je code des images. », la phrase « Entre l'image et le code, je conçois des interfaces et des expériences web interactives, avec autant de soin pour le rendu que pour la technique. » et le lien « Voir les projets ». Sur mobile, la planète passe au-dessus du texte.
  2. **Projets sélectionnés** : 8 cartes arrondies qui flottent ça et là (section 5.4).
  3. **Contact**, sur une photo sombre tirée au hasard parmi trois : « Vous recrutez, ou vous avez un projet ? », l'email (lien `mailto:` et bouton « Copier »), LinkedIn, GitHub, CV en PDF, Instagram, puis le crédit photo et le copyright.
- **Étude de cas** : lien « Retour aux projets », numéro (01 / 08), média d'ouverture, tag (année et type), titre, chapeau, fiche (année, rôle, stack, liens), puis _Contexte_, _Ce que j'ai fait_, _Défis techniques_ (chaque défi en trois temps : problème, solution, résultat), images et vidéos, et le projet suivant (le dernier renvoie au premier).
- **404** : message en français et en anglais, avec des liens vers les deux accueils.
- **Langues** : français à la racine, anglais sous `/en/` ; le sélecteur mène à la page équivalente ; aucune redirection automatique ; chaque page déclare `<html lang>` et ses alternatives `hreflang` (`x-default` vers le français).
- **Anciennes URL** : des pages de redirection statiques renvoient les pages des projets retenus vers leur étude de cas, `about.html` vers l'accueil et `contact.html` vers `/#contact`. Les autres aboutissent à la 404.

## 5. Direction artistique : « Musée de nuit »

La rigueur d'un musée d'art moderne (MoMA, MAM Paris), le calme photographique de _The Third & The Seventh_, la poésie du Petit Prince. Le site est une salle sombre : la planète y est exposée sous un spot, les projets flottent comme des œuvres, chacun avec son cartel.

### 5.1 Typographie

| Rôle                 | Police                 | Réglages                                                    |
| -------------------- | ---------------------- | ----------------------------------------------------------- |
| Titres               | Libre Franklin         | 500, interlettrage -0,035em ; titres de projet en 600, -0,02em |
| Sous-titres          | Libre Franklin italique | 300, interlettrage -0,01em ; le métier animé                |
| Texte                | Manrope                | 400 et 500                                                  |
| Libellés             | Manrope                | 500, 12 px, capitales, interlettrage 0,16em                 |
| Tags des projets     | Libre Franklin         | 600, 12 px, capitales, interlettrage 0,06em                 |

- Polices auto-hébergées via Fontsource (fichiers variables, licence OFL), deux fichiers préchargés au plus.
- Tailles de référence : nom de l'ouverture `clamp(52px, 6.07vw, 88px)` ; métier animé 27 px (23 px sur mobile) ; titre du contact 52 px ; titres de projet 28 px ; « Je code des images. » 28 px ; texte courant 15 à 18 px.
- Deux familles seulement, sans empattement : Libre Franklin et Manrope.

### 5.2 Couleurs : « Noir musée »

| Jeton              | Rôle                               | Valeur                        |
| ------------------ | ---------------------------------- | ----------------------------- |
| `--color-bg`       | fond, en dégradé vertical          | `#0C0C0D` vers `#060607`      |
| `--color-surface`  | cartes et médias                   | `#161618`                     |
| `--color-text`     | texte principal                    | `#F3F3F1`                     |
| `--color-muted`    | texte secondaire (contraste 5,9:1) | `#8F8F8B`                     |
| `--color-accent`   | liens, étoiles, anneau de survol   | `#FFFFFF`                     |
| `--color-line`     | traits et bordures                 | `rgba(243, 243, 241, 0.14)`   |

- Les seules couleurs du site sont celles de la planète et des projets.
- Survol des liens : opacité 0,6. Focus : contour de 2 px de la couleur du texte.
- Un seul thème.

### 5.3 La lumière suit l'heure du visiteur

L'éclairage de la planète et la teinte du ciel dépendent de l'heure locale du visiteur :

| Période    | Heures      | Spot                      | Ciel (décor) | Étoiles CSS | Teinte en haut de page          |
| ---------- | ----------- | ------------------------- | ------------ | ----------- | ------------------------------- |
| Aube       | 6 h – 9 h   | rosé `#FFC2A0`            | 55 %         | 70 %        | `rgba(255, 168, 140, 0.12)`     |
| Jour       | 9 h – 18 h  | blanc `#FFFFFF`, plus fort | 20 %         | 35 %        | `rgba(150, 182, 255, 0.10)`     |
| Crépuscule | 18 h – 21 h | orangé `#FFA070`          | 70 %         | 80 %        | `rgba(255, 122, 80, 0.12)`      |
| Nuit       | 21 h – 6 h  | blanc froid `#FFF8EE`     | 100 %        | 100 %       | aucune                          |

- Si la période change pendant la visite, la lumière passe de l'une à l'autre en fondu, sur quelques secondes.
- Un paramètre d'URL `?heure=aube|jour|crepuscule|nuit` force une période, pour les tests et les captures.

### 5.4 Mise en page et composants

- **Ouverture** : colonne de gauche pour la planète (rendue sur une zone d'environ 600 × 600 px), colonne de droite de 580 px au plus pour le texte. Un halo blanc très léger derrière la planète, une étoile filante qui traverse de temps en temps.
- **Ciel** : environ 70 étoiles CSS qui scintillent sur toute la page, et le décor de la scène (étoiles et planètes lumineuses) regroupé autour de la planète pour laisser le texte au calme.
- **Cartes des projets** :
  - rectangles arrondis (20 px) au format 16:9, avec une vidéo en boucle (image fixe en attendant la vidéo) ;
  - placement libre sur un plan de 2 380 px de haut, largeurs de 28 à 40 % de la colonne, légère inclinaison en 3D propre à chaque carte ;
  - au survol (ou au focus clavier), la carte se détache : elle se redresse, grandit (×1,07) et s'entoure d'un anneau blanc ; les autres cartes s'estompent (opacité 0,3, flou de 2 px), perdent de la saturation et s'écartent ;
  - le **cartel** apparaît à côté de la carte : titre, tag « 2024 — Three.js · génératif », description courte, « Voir l'étude de cas → » ;
  - sur écran tactile et sur mobile, les cartes s'empilent en colonne avec leur cartel toujours visible.
- **Contact** : photo plein cadre (concert, roue ou colibri, tirée au hasard), assombrie par des dégradés ; le texte est posé directement dessus, à droite sur ordinateur.

### 5.5 Mouvement : « Poétique »

| Élément           | Comportement                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| Planète           | flottement de ±10 px et ±1°, sur 7 s                                      |
| Cartes            | flottement de ±12 px, sur 8 à 10,5 s, décalé d'une carte à l'autre        |
| Survol d'une carte | 450 ms ; cartel en 300 ms ; les autres cartes s'écartent de 40 px au plus |
| Parallaxe         | la planète (16 × 12 px) et le ciel (8 × 6 px) suivent la souris ; les cartes aussi, selon leur taille |
| Métier animé      | « Creative developer », « Ingénieur multimédia », « Dreamer », « Full-stack developer », « Human » ; transition « apesanteur » de 1,8 s (les lettres s'envolent, les suivantes se posent), puis 2,4 s de pause |
| Étoiles           | scintillement de 2,5 à 7 s ; étoile filante toutes les 9 s                |

- Courbes : `cubic-bezier(0.23, 1, 0.32, 1)` pour les réactions d'interface, `cubic-bezier(0.37, 0, 0.63, 1)` pour les flottements.
- On n'anime que `transform`, `opacity` et `filter`.
- **Animations réduites, automatiquement** : si le visiteur a activé « réduire les animations » dans son système, plus de flottement, de parallaxe ni d'étoile filante, les animations de la scène 3D s'arrêtent sur une pose fixe, le métier change en fondu de 500 ms et les étoiles scintillent très lentement. **Il n'y a pas de bouton pause** : c'est un choix de Grégoire, qui s'écarte du critère WCAG 2.2.2 pour les visiteurs qui n'ont pas activé ce réglage.

## 6. La scène 3D du Petit Prince

La planète de l'ouverture est la création Blender de Grégoire, rendue en temps réel avec Three.js. Les choix ci-dessous ont été validés sur des rendus faits avec un prototype (`docs/prototypes/petit-prince/`).

### 6.1 Modèle

- **Source** : l'export glTF Binary de Grégoire (Blender, export glTF 2.0), avec « Apply Modifiers », « Visible Objects » et « Renderable Objects », la caméra et les 26 animations. Draco et Meshopt restent décochés à l'export.
- **Optimisation** (`docs/prototypes/petit-prince/optimize.mjs`, avec gltf-transform et meshoptimizer) : soudure des sommets, simplification par objet (décor fortement réduit, personnages intacts), normales lisses recalculées, quantification et compression `EXT_meshopt_compression`. Résultat : de 16,3 Mo et 446 000 triangles à 0,53 Mo et 51 000 triangles, sans différence visible. La rose garde ses UV, car son matériau anisotrope en a besoin.
- **Chargement** : `GLTFLoader` avec `MeshoptDecoder`. Après quantification, chaque maillage est porté par un nœud enfant sans nom : on le cherche à l'intérieur du nœud nommé.

### 6.2 Relief généré par le code

Le relief de la planète et les cheveux du prince viennent du matériau dans Blender, et un glTF ne peut pas l'exporter. Ils sont donc générés au chargement, avec un tirage fixe pour que la planète soit toujours la même :

- **Planète** : icosphère (détail 110, réduit sur mobile), surface bosselée (bruit simplex, 5 octaves) et 46 cratères (cuvette et rebord), atténués là où se tiennent le prince, le renard et la rose.
- **Cheveux** : icosphère hérissée de 150 pétales.

### 6.3 Lumière et caméra

- **Éclairage « Noir musée »** : un spot de musée (angle 0,165 rad, pénombre totale) braqué sur le prince et le renard depuis le haut à gauche, ombres douces ; une lumière d'ambiance presque nulle, un contre-jour froid et léger ; tone mapping ACES, environnement très faible. La planète plonge dans l'ombre vers le bas.
- Les variantes de l'heure (section 5.3) changent la couleur et la force du spot.
- **Caméra** : vue de dessus, comme le rendu d'origine (le prince se tient en haut de la planète, le renard vu de dos, l'écharpe au vent vers la droite), champ de 20°. La caméra exportée, avec son animation, peut servir à une entrée en matière au chargement.
- **Décor** : les étoiles, planètes lumineuses et anneaux du modèle, en blanc, rapprochés de la planète et réduits ; léger halo (bloom) sur eux seulement.
- **Animations** : toutes les actions du modèle jouent en boucle (écharpe, rose, renard, rotation de la planète, étoiles, étoile filante).

### 6.4 Intégration et performance

- Three.js et la scène sont importés dynamiquement après le premier affichage, jamais sur le chemin critique.
- **Image de repli** : pour chaque période, un rendu fixe en WebP (environ 45 Ko) s'affiche tout de suite. Il reste en place sans JavaScript, sans WebGL ou avec `?gl=0`, et la scène vivante le remplace en fondu quand elle est prête.
- Rendu en pause quand l'ouverture sort de l'écran ou quand l'onglet est caché ; densité de pixels plafonnée à 2 (1,5 sur mobile) ; carte d'ombres de 2 048 px.
- Si la cadence reste sous 40 images par seconde pendant les 3 premières secondes, la scène se fige sur l'image de repli.

## 7. Architecture technique

### 7.1 Stack

Astro (sortie statique), TypeScript strict, Three.js, GSAP, Lenis, polices via Fontsource, pnpm, Node 24 (LTS).

### 7.2 Arborescence

```
src/
  config.ts             réglages du site (email, liens sociaux, photos du contact)
  content.config.ts     collections et schémas de validation
  content/projects/<slug>/
                        project.yaml + fr.md + en.md + médias
  i18n/                 fr.ts (référence), en.ts, routes.ts
  layouts/Base.astro    <html lang>, métadonnées, hreflang, en-tête, routeur client
  components/           Header, Landing, JobTitle, ProjectField, ProjectCard, Contact, CaseStudy…
  pages/                index, projets/[slug], 404 ; en/ : index, projects/[slug]
  scene/                scène du Petit Prince : chargement, relief, lumières, heure, boucle
  motion/               flottements, survols, parallaxe, métier animé
  styles/               jetons (variables CSS), base
public/
  models/               petit-prince.glb (version optimisée)
  images/               rendus de repli de la planète, photos du contact
  cv/                   CV en PDF (FR et EN)
tests/
  unit/                 Vitest
  e2e/                  Playwright
docs/
  specs/                cette spec
  prototypes/           prototypes de rendu et d'optimisation de la scène
```

### 7.3 Contenu et traductions

**Un dossier par projet** (`src/content/projects/<slug>/`) :

- `project.yaml`, les données qui ne se traduisent pas : `order`, `year`, `stack`, `links` (`live`, `code`, `video`, facultatifs), `cover`, `coverFocus` (facultatif), `loop` (vidéo de la carte, facultative) ;
- `fr.md` et `en.md` : en en-tête `title`, `kind`, `role`, `summary` (la description courte du cartel, reprise pour le SEO) et `coverAlt` ; dans le corps, l'étude de cas en Markdown.

La position, la taille et l'inclinaison des 8 cartes sur l'accueil sont définies dans le code, par emplacement, dans l'ordre des projets.

**Vérifications au build** : le build échoue avec un message explicite si un champ manque ou est mal typé (Zod), si une image est introuvable, si un projet n'a pas son `fr.md` ou son `en.md`, ou si deux projets ont le même `order`.

**Textes de l'interface** : `fr.ts` fait référence ; `en.ts` est typé pour avoir exactement les mêmes clés.

**URL** : une fonction utilitaire ajoute le chemin de base (`/portfoliov2/` pendant la prévisualisation, `/` après la mise en service). La correspondance FR ↔ EN est définie à un seul endroit (`i18n/routes.ts`).

**Vidéos** : les boucles des cartes et des études de cas (muettes, `playsinline`, 4 Mo au plus, avec une image fixe) sont hébergées dans le repo et se mettent en pause hors écran. Avec « réduire les animations », on n'affiche que l'image fixe. Les vidéos longues restent sur YouTube, chargées au clic (`youtube-nocookie.com`).

### 7.4 Navigation et scène

- Le routeur client d'Astro conserve la scène d'une page à l'autre (`transition:persist`) : en ouvrant une étude de cas, la planète s'éloigne et s'assombrit ; elle revient au retour sur l'accueil. Si cette transition pose problème, repli sur un simple fondu.
- Une seule boucle d'animation (le ticker de GSAP) pilote Lenis, les animations et le rendu 3D.

### 7.5 Amélioration progressive

- Tout le contenu est en HTML sémantique et reste lisible sans JavaScript.
- Les états cachés des animations ne s'appliquent que si JavaScript est actif. Sans JavaScript, rien n'est masqué.
- Navigation au clavier : les cartes reçoivent le focus et affichent leur cartel ; focus visible ; lien d'évitement vers le contenu.

## 8. Contenu

### 8.1 Les 8 projets

| #   | Slug                       | Projet                     | Tag                         | Ce que l'étude de cas met en avant                                                                                                                                                        |
| --- | -------------------------- | -------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `la-fabrique-des-mondes`   | La Fabrique des Mondes     | 2024 — Three.js · génératif | God game en Three.js où chaque élément matérialise un procédé : attracteurs étranges, triangle de Sierpiński, paysage adaptatif, voyageur de commerce, éponge de Menger, L-systèmes, automate de Wolfram, boids |
| 2   | `what-we-play`             | What we play?              | 2025 — Web · 3D en CSS      | TV-personnage qui réagit à l'utilisateur ; Mac 3D en CSS pur avec un pion animé par joueur ; trois langues à routes typées ; pré-rendu et SEO ; tests e2e                                 |
| 3   | `litterature-combinatoire` | Littérature & Combinatoire | 2023 — Web · temps réel · vidéo | Exposition et site de génération de textes par combinaison (PHP Slim, SQL, Socket.io), en équipe de quatre ; vidéo promotionnelle (Premiere Pro, After Effects)                     |
| 4   | `sncf-wrapped`             | SNCF Wrapped               | 2026 — Récit de données     | Bilan annuel des trajets en train, raconté écran par écran ; tout se passe dans le navigateur, ce que garantit un test ; carte à partager ; tests aléatoires                              |
| 5   | `recoding`                 | Recoding                   | 2022 — Art génératif        | Art génératif et interactif (p5.js, TypeScript), en binôme                                                                                                                               |
| 6   | `lyrix`                    | Lyrix                      | 2026 — Jeu multijoueur      | Jeu à la Pédantix sur des paroles : multijoueur en temps réel (Durable Objects, WebSockets), indices par embeddings précalculés, backend Cloudflare Workers + Hono qui garde les paroles secrètes, tests |
| 7   | `le-petit-prince`          | Le Petit Prince            | [année] — Animation 3D      | Courte animation 3D réalisée sous Blender, celle qui ouvre le site                                                                                                                        |
| 8   | `obaine`                   | Obaine                     | [année] — Front-end         | Front-end d'une plateforme de financement d'athlètes par leurs fans (Vue, Pinia, Vue Router, Vitest, Docker)                                                                              |

Claude rédige une première version des études de cas en français et en anglais, à partir de l'ancien site et du code des repos ; Grégoire la corrige et la complète.

### 8.2 À fournir par Grégoire

- les vidéos en boucle des 8 projets ;
- les trois photos du contact en haute définition (2 400 px de large au moins) ;
- l'adresse email à afficher, l'URL LinkedIn à jour, le CV en français et en anglais ;
- les années et rôles à confirmer, en particulier pour Le Petit Prince et Obaine, et l'adresse en ligne de Lyrix.

## 9. Qualité

### 9.1 Commandes

| Commande            | Rôle                                                       |
| ------------------- | ---------------------------------------------------------- |
| `pnpm lint`         | ESLint (TypeScript, Astro)                                 |
| `pnpm format:check` | Prettier                                                   |
| `pnpm check`        | `astro check` : typage, clés de traduction comprises       |
| `pnpm test`         | tests unitaires (Vitest)                                   |
| `pnpm build`        | build, vérifications de contenu comprises                  |
| `pnpm test:e2e`     | tests de bout en bout (Playwright, sur le site construit)  |

### 9.2 Tests unitaires

- correspondance FR ↔ EN des pages et ajout du chemin de base aux URL ;
- vérifications du contenu (paire FR/EN, `order` unique) ;
- passage de l'heure à la période (bornes comprises) et paramètre `?heure=` ;
- génération du relief : même tirage, même géométrie.

### 9.3 Tests de bout en bout (Chromium)

- chaque page répond et s'affiche, en français et en anglais ; le sélecteur de langue mène à la page équivalente ;
- aucun lien interne cassé, aucune erreur dans la console ;
- le contenu reste visible sans JavaScript, et l'image de repli de la planète s'affiche sans WebGL ;
- avec « réduire les animations », rien ne flotte et la scène est figée ;
- au clavier, le focus sur une carte affiche son cartel ;
- l'audit axe ne relève aucune violation sur l'accueil et une étude de cas, dans les deux langues.

### 9.4 Budgets de performance

- JavaScript initial de 60 Ko compressés au plus, scène 3D chargée en différé non comprise ;
- modèle 3D de 600 Ko au plus ; images de repli de 50 Ko au plus chacune ;
- LCP de 2,5 s au plus (Lighthouse, mobile), l'image de repli servant d'élément LCP ;
- deux fichiers de police préchargés au plus.

## 10. Mise en ligne

- **CI** (`.github/workflows/ci.yml`), à chaque push et à chaque pull request : installation, lint, formatage, `astro check`, tests unitaires, build, tests e2e.
- **Déploiement** (`.github/workflows/deploy.yml`), à chaque push sur `main` : build, puis publication sur GitHub Pages.
- **Branches** : `main` est la branche publiée ; le travail se fait sur une branche dédiée, intégrée à `main` étape par étape.
- **Prévisualisation** : pendant la construction, le site est publié sur `https://greg0s.github.io/portfoliov2/`. L'ancien site reste en ligne sur `gregoiretinn.es`.
- **Mise en service** (étape 10), avec l'accord explicite de Grégoire au moment venu :
  1. retirer le domaine personnalisé du repo `Greg0s/portfolio` ;
  2. déclarer `gregoiretinn.es` dans les réglages GitHub Pages de `Greg0s/portfoliov2`, et passer le chemin de base à `/` ;
  3. vérifier le HTTPS et les redirections des anciennes URL ;
  4. archiver `Greg0s/portfolio`.

  Les DNS ne changent pas, puisque les deux repos sont sur GitHub Pages. Les sous-domaines `whatweplay` et `topaventura` ne sont pas concernés.
- **Langue des documents** : le `README.md` est en anglais (repo public, lu par des recruteurs). Cette spec et les échanges de travail restent en français.

## 11. Étapes de construction

À partir de l'étape 1, chaque étape se termine avec une CI verte et le site à jour sur la prévisualisation.

| #   | Étape           | Contenu                                                                                                                         | Terminée quand                                                                                  |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 0   | Maquette        | Maquette Claude Design et charte « Musée de nuit », affinées jusqu'au moindre détail                                            | Grégoire juge la maquette parfaite ; rien n'est intégré avant                                   |
| 1   | Fondations      | Projet Astro, TypeScript strict, ESLint, Prettier, Vitest, Playwright, CI, déploiement, `README.md`, `CLAUDE.md`                | le squelette se construit et se déploie sur la prévisualisation, et la CI est verte             |
| 2   | Design system   | Jetons de la charte, polices, en-tête, menu mobile, routage FR/EN, sélecteur de langue, textes d'interface typés                | les pages vides existent en FR et en EN et les tests de routes passent                          |
| 3   | Contenu         | Schémas, vérifications, page d'étude de cas, import des 8 projets en brouillon, images optimisées                               | les 8 études de cas s'affichent en FR et en EN, et supprimer un `fr.md` fait échouer le build   |
| 4   | Accueil         | Ouverture avec les images de repli par période, plan des cartes et cartels, contact avec photo au hasard, 404, SEO, redirections | l'accueil est complet et utilisable sans JavaScript                                             |
| 5   | Motion          | Mouvement « Poétique » : flottements, survol des cartes, parallaxe, métier animé, étoiles ; animations réduites automatiques ; routeur client | le test e2e « réduire les animations » passe et la navigation se fait sans rechargement         |
| 6   | Scène 3D        | Modèle optimisé, relief généré, éclairage « Noir musée », lumière selon l'heure, animations, chargement différé, repli          | la scène tourne à 60 images/s sur un ordinateur de milieu de gamme, se fige proprement sur mobile, et la performance Lighthouse reste à 90 ou plus |
| 7   | Médias et transitions | Vidéos des cartes, transition de l'accueil vers une étude de cas avec la scène conservée                                  | le parcours complet est fluide et se dégrade proprement                                         |
| 8   | Rédaction       | Études de cas complètes en FR et en EN, CV, visuels et photos HD                                                                | Grégoire a tout relu et validé                                                                  |
| 9   | Finitions       | Accessibilité, performance, SEO, images de partage, sitemap, tests e2e complets                                                 | les objectifs Lighthouse sont atteints                                                          |
| 10  | Mise en service | Transfert du domaine (section 10)                                                                                               | `gregoiretinn.es` sert le nouveau site en HTTPS et l'ancien repo est archivé                    |

Le `CLAUDE.md` créé à l'étape 1 reprend la consigne générale de Grégoire : Claude a toujours la liberté de lui proposer des choses surprenantes, en les présentant comme des choix.

## 12. Risques et parades

| Risque                                                             | Parade                                                                                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Scène 3D trop lourde sur mobile (génération du relief, ombres)     | détail du relief réduit sur mobile, densité de pixels plafonnée, ombres en 2 048 px, pause hors écran, repli sur l'image fixe si la cadence chute |
| Animations sans bouton pause (critère WCAG 2.2.2)                  | choix assumé de Grégoire ; « réduire les animations » est respecté automatiquement                                     |
| Scène conservée entre les pages délicate avec le routeur client     | testée dès l'étape 5 ; repli sur un simple fondu                                                                       |
| Poids des vidéos des cartes                                        | 4 Mo au plus par boucle, chargement au défilement, pause hors écran, image fixe avec « réduire les animations »        |
| Anciens visuels en basse résolution                                | vidéos et photos originales en haute définition, nouvelles captures des sites en ligne                                 |
| Charge de rédaction bilingue                                       | premières versions rédigées par Claude et relues par Grégoire ; le build bloque toute traduction manquante             |
