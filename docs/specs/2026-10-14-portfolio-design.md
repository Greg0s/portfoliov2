# Portfolio v2 : spécification de design

- **Date** : 14 octobre 2026
- **Auteur** : Grégoire Tinnes, avec Claude
- **Statut** : design validé section par section en séance, spec à relire

## 1. Contexte

Le portfolio actuel (`Greg0s/portfolio`, en ligne sur `gregoiretinn.es`) est un site HTML statique construit sur le template Bootstrap _MyPortfolio_. Ses limites :

- une page HTML copiée-collée par projet (une quarantaine), donc pénible à faire évoluer ;
- un bilinguisme FR/EN resté partiel (quelques phrases traduites seulement) ;
- 36 Mo d'images, optimisées à la main (`*_min.jpg`) ;
- un contenu daté (la page À propos présente encore un étudiant en 2e année) et des projets récents absents ;
- un rendu générique de template, peu convaincant pour un poste créatif.

On repart d'un repo vide : `Greg0s/portfoliov2`.

## 2. Objectif et critères de réussite

**Objectif** : décrocher un poste de **creative developer**. Le public visé : studios et agences créatives, équipes tech. Le site est la première pièce du portfolio, et son code (repo public) sera lu lui aussi.

**Critères de réussite**

1. En arrivant sur l'accueil, on comprend qui est Grégoire et ce qu'il fait, et chaque projet est à un clic.
2. Les 8 études de cas sont complètes en français et en anglais.
3. Les effets WebGL ne bloquent jamais l'accès au contenu : le site reste complet sans JavaScript, sans WebGL et avec « réduire les animations ».
4. Scores Lighthouse sur mobile avant la mise en service : performance ≥ 90, accessibilité 100, SEO 100.
5. Ajouter un projet consiste à créer un dossier de contenu, sans toucher au code.

## 3. Périmètre

**Dans la V1** : les pages de la section 4, le français et l'anglais, les 8 projets de la section 7, les effets de la section 5, le déploiement automatique et la mise en service sur `gregoiretinn.es`.

**Hors V1** (idées pour plus tard) : scène 3D temps réel en ouverture, lab d'expérimentations, blog, formulaire de contact, mode clair, statistiques de visite, archive des autres projets.

## 4. Pages et navigation

| Page             | Français                 | Anglais                |
| ---------------- | ------------------------ | ---------------------- |
| Accueil          | `/`                      | `/en/`                 |
| Étude de cas     | `/projets/<slug>/`       | `/en/projects/<slug>/` |
| À propos         | `/a-propos/`             | `/en/about/`           |
| Page introuvable | `404.html`, bilingue     |                        |

- Le slug d'un projet est identique dans les deux langues.
- **En-tête** (toutes les pages) : nom (lien vers l'accueil), À propos, Contact (ancre vers le pied de page), sélecteur FR/EN.
- **Pied de page** (toutes les pages, ancre `#contact`) : email (lien `mailto:` et bouton « copier »), LinkedIn, GitHub.
- **Accueil**, dans cet ordre :
  1. l'ouverture « plan fixe vivant » : « Grégoire Tinnes — Creative developer », petit et centré, sur le visuel d'un projet phare (La Fabrique des Mondes par défaut, réglable dans `src/config.ts`) ;
  2. l'index des 8 projets : numéro, titre, année, type ;
  3. un court paragraphe de présentation, avec un lien vers À propos ;
  4. le contact (pied de page).
- **Étude de cas** :
  - un plan d'ouverture (image ou vidéo, au format cinémascope) ;
  - le titre, le type, l'année, le rôle, la stack et les liens (site, code, vidéo) ;
  - le corps, en trois sections (_Contexte_, _Ce que j'ai fait_, _Défis techniques_), avec images et vidéos au fil du texte ;
  - un lien « Projet suivant » ; le dernier projet renvoie au premier.
- **À propos** : bio, compétences en quatre familles, parcours (formation et expériences), CV en PDF dans la langue de la page, portrait facultatif.
- **404** : message en français et en anglais, avec des liens vers les deux accueils.
- **Langues** :
  - français à la racine, anglais sous `/en/` ;
  - le sélecteur mène à la page équivalente dans l'autre langue ;
  - aucune redirection automatique selon la langue du navigateur ;
  - chaque page déclare `<html lang>` et ses alternatives `hreflang` (`x-default` pointe vers la version française).
- **Anciennes URL** : des pages de redirection statiques renvoient les adresses de l'ancien site vers les nouvelles :
  - les pages des projets retenus (`obaine.html`, `what-we-play.html`…) vers leur étude de cas, `litterature-combinatoire-pub.html` compris ;
  - `about.html` vers À propos ;
  - `contact.html` vers le contact de l'accueil.

  Les autres anciennes adresses aboutissent à la page 404.

## 5. Direction artistique : « béton et lumière »

**Référence** : _The Third & The Seventh_ (Alex Roman, 2009).

- **Ce qu'on en garde** : la lumière naturelle rasante, la matière (le béton), la profondeur de champ, les mouvements de caméra lents et la sobriété.
- **Ce qu'on laisse** : le photoréalisme 3D en temps réel (hors V1) et la lenteur dans l'usage. Les interactions restent immédiates.

**Principe** : le site se comporte comme une caméra. Le contenu sort de l'ombre, les images font leur mise au point, les mouvements sont des travellings lents. **Le texte reste toujours net** : aucun effet WebGL ne touche le texte.

### 5.1 Couleurs

Valeurs de départ, ajustées à l'étape 2 :

| Jeton             | Rôle                            | Valeur    |
| ----------------- | ------------------------------- | --------- |
| `--color-bg`      | fond, noir chaud                | `#0E0D0C` |
| `--color-surface` | béton sombre (surfaces, filets) | `#1A1917` |
| `--color-muted`   | gris béton (texte secondaire)   | `#8A8580` |
| `--color-text`    | texte principal, blanc cassé    | `#EAE6DF` |
| `--color-light`   | accent « lumière dorée »        | `#E8B86A` |

- L'accent est réservé aux éléments interactifs : liens au survol, focus, langue active, sélection de texte. Il n'est jamais décoratif.
- Contrastes minimum sur le fond : 7:1 pour le texte principal, 4,5:1 pour le texte secondaire et l'accent.
- Un seul thème : le thème sombre.

### 5.2 Typographie

- **Deux familles** :
  - pour les titres, un serif élégant et léger, comme dans un générique de film ;
  - pour le texte et les libellés, un sans-serif neutre. Les libellés (métadonnées, navigation, numéros) sont en petites capitales très espacées.
- **Candidats** : Cormorant Garamond ou Newsreader pour les titres, Inter ou Geist pour le texte. Le choix final se fait à l'étape 2, en comparant les candidats sur la version en ligne. Critères :
  - lisibilité en clair sur fond sombre ;
  - accents français ;
  - licence libre (OFL) ;
  - fichiers variables auto-hébergés via Fontsource.
- **Échelle** : 5 à 6 tailles, sur un rapport de 1,5 (éditorial). Les titres de l'index et des études de cas sortent de l'échelle et montent jusqu'à environ 8vw. 2 à 3 graisses.
- **Une seule exception** : le titre d'ouverture est le seul texte centré du site. Il est petit, comme un carton de générique.

### 5.3 Grille, espacements et médias

- **Grille** : unité de base de 8 px, 12 colonnes sur ordinateur, 4 sur mobile.
- **Espacement vertical**, trois niveaux, réduits proportionnellement sur mobile :
  - 24 px à l'intérieur d'un bloc ;
  - 64 px entre deux blocs ;
  - 160 px entre deux sections.
- **Formats d'image** :
  - **2,39:1** pour les plans d'ouverture et l'index ;
  - **16:9** pour les vidéos et les images des études de cas ;
  - **4:5** pour le portrait et les captures mobiles, ces dernières présentées dans un cadre 4:5.

  Sur mobile en portrait, les plans d'ouverture passent au 4:5, car le 2,39:1 y serait trop étroit. L'index, lui, garde le 2,39:1.
- **Angles** : droits partout.
- **Traitement commun à tous les médias** : grain de pellicule et léger vignettage, en WebGL avec un équivalent en CSS.
- **Recadrage** : centré par défaut, avec un point focal réglable image par image.

### 5.4 Mouvement

Valeurs indicatives, affinées à l'étape 5 :

| Effet               | Description                                                                         | Durée         |
| ------------------- | ----------------------------------------------------------------------------------- | ------------- |
| Sortie de l'ombre   | exposition de 0 à 1 et translation de 24 px au plus ; lignes de texte décalées d'environ 80 ms | 0,9 à 1,2 s   |
| Mise au point       | passage du flou au net, réservé aux images                                          | environ 0,8 s |
| Travelling          | zoom lent ou dérive du cadre                                                        | 2 à 6 s       |
| Retour d'interface  | survol, focus                                                                       | 150 à 200 ms  |
| Transition de page  | ne retarde jamais la navigation                                                     | 1,2 s au plus |

- Une seule famille de courbes : une sortie douce, de type _expo out_.
- **Avec « réduire les animations »** : ni défilement fluide, ni mouvement de caméra, ni déformation. Seulement des fondus courts, d'environ 200 ms.

### 5.5 Effets WebGL

1. **Ouverture** : au chargement, le visuel du projet phare fait sa mise au point. Le grain et des reflets de lumière suivent le curseur.
2. **Index, avec une souris** (`(hover: hover) and (pointer: fine)`) : au survol d'un titre, le visuel du projet sort de l'ombre, fait sa mise au point, puis la caméra avance doucement.
3. **Index, sur écran tactile** : les visuels s'affichent directement sous chaque titre et sortent de l'ombre au défilement.
4. **Défilement** : l'image glisse légèrement dans son cadre, comme un travelling vertical.
5. **Transition de l'index vers une étude de cas** : le visuel cliqué s'agrandit jusqu'à devenir le plan d'ouverture de l'étude de cas.

## 6. Architecture technique

### 6.1 Stack

Astro (sortie statique), TypeScript strict, Three.js, GSAP, Lenis, polices via Fontsource, pnpm, Node 24 (LTS).

### 6.2 Arborescence

```
src/
  config.ts             réglages du site (projet de l'ouverture, email, liens sociaux)
  content.config.ts     collections et schémas de validation
  content/
    projects/<slug>/    project.yaml + fr.md + en.md + médias
    about/              fr.md + en.md
  i18n/                 fr.ts (référence), en.ts, routes.ts
  layouts/Base.astro    <html lang>, métadonnées, hreflang, en-tête, pied de page,
                        routeur client, canvas WebGL persistant
  components/           Header, Footer, LangSwitch, Hero, ProjectIndex, CaseStudy, Media…
  pages/                index, a-propos, projets/[slug], 404
    en/                 index, about, projects/[slug] (mêmes composants, lang="en")
  motion/               défilement fluide (Lenis), apparitions (GSAP)
  webgl/                moteur, plans, shaders, transitions, modes
  styles/               jetons (variables CSS), base, rendu de repli des médias
public/                 CV en PDF (FR et EN), favicon, images de partage, redirections
tests/
  unit/                 Vitest
  e2e/                  Playwright
```

### 6.3 Contenu et traductions

**Un dossier par projet** (`src/content/projects/<slug>/`) :

- `project.yaml` contient les données communes, qui ne se traduisent pas :
  - `order` : position dans l'index ;
  - `year` ;
  - `stack` : liste des technologies ;
  - `links` : `live`, `code` et `video`, tous facultatifs ;
  - `cover` : image principale ;
  - `coverFocus` : point focal, facultatif ;
  - `video` : boucle MP4 pour le plan d'ouverture, facultative.
- `fr.md` et `en.md` contiennent les textes traduits :
  - en en-tête (frontmatter) : `title`, `kind` (type de projet), `role`, `summary` (une ou deux phrases, utilisées dans l'index et comme description SEO) et `coverAlt` ;
  - dans le corps : l'étude de cas en Markdown, avec des images intégrées dont le texte alternatif est propre à chaque langue.

**Vérifications au build** : le build échoue, avec un message explicite, si :

- un champ manque ou est mal typé (schéma Zod) ;
- une image est introuvable ;
- un projet n'a pas son `fr.md` ou son `en.md` ;
- deux projets ont le même `order`.

**Textes de l'interface** : `fr.ts` fait référence. `en.ts` est typé pour avoir exactement les mêmes clés : une clé manquante ou en trop provoque une erreur TypeScript.

**URL** :

- Toutes les URL internes passent par une fonction utilitaire qui ajoute le chemin de base : `/portfoliov2/` pendant la prévisualisation, `/` après la mise en service.
- La correspondance FR ↔ EN des pages est définie à un seul endroit (`i18n/routes.ts`). Le sélecteur de langue et les balises `hreflang` l'utilisent tous les deux.

**Vidéos** :

- Les boucles courtes (4 Mo au plus, muettes, `playsinline`) sont hébergées dans le repo.
- Les vidéos longues restent sur YouTube. On affiche une vignette, et le lecteur (`youtube-nocookie.com`) ne se charge qu'au clic.

### 6.4 Moteur WebGL

- **Un canvas plein écran**, placé derrière le contenu et conservé d'une page à l'autre (`transition:persist` avec le routeur client d'Astro).
- **Rendu** : `WebGLRenderer` de Three.js, caméra orthographique (une unité égale un pixel CSS), densité de pixels plafonnée à 2.
- **Plans synchronisés** :
  - chaque `<img>` ou `<video>` qui porte l'attribut `data-gl` reçoit un plan calé sur son emplacement ;
  - les positions sont mesurées au redimensionnement et après chaque changement de page, puis décalées selon le défilement, sans nouvelle mesure à chaque image ;
  - quand le plan est prêt, le média HTML devient transparent. Si le contexte WebGL est perdu, il redevient visible.
- **Textures** : une image reprend le fichier déjà chargé par la page (`currentSrc`). Une vidéo passe par une texture vidéo.
- **Shaders** :
  - un socle commun : recadrage avec point focal, grain, vignettage, exposition ;
  - des effets dédiés : mise au point par flou, reflets qui suivent le curseur, glissement de l'image dans son cadre au défilement.
- **Boucle unique** : le ticker de GSAP pilote Lenis et le rendu. Le rendu se met en pause quand rien ne bouge et quand l'onglet est caché.
- **Transitions** : elles se branchent sur les événements du routeur client d'Astro.
  1. Au clic sur un projet de l'index, son plan s'anime vers l'emplacement du plan d'ouverture pendant que la page se charge.
  2. Une fois la page échangée, le plan se cale sur le nouvel élément.
  3. Le contenu apparaît.
- **Modes**, choisis au démarrage puis mis à jour si les préférences changent :
  - `off` : pas de WebGL2, ou paramètre `?gl=0` dans l'URL ;
  - `reduced` : « réduire les animations » est activé. Images fixes avec grain, uniquement des fondus. On bascule aussi automatiquement de `full` à `reduced` si la cadence moyenne reste sous 40 images par seconde pendant les 3 premières secondes d'animation ;
  - `full` : tous les effets. Sur écran tactile, pas d'effets de survol et une densité de pixels réduite.
- **Chargement différé** : Three.js et le moteur sont importés dynamiquement après le premier affichage (`requestIdleCallback`), jamais sur le chemin critique.

### 6.5 Amélioration progressive

- Tout le contenu est en HTML sémantique et reste lisible sans JavaScript.
- Le grain et le vignettage ont un équivalent CSS : une texture de bruit et un dégradé radial.
- Les états cachés des animations ne s'appliquent que si JavaScript est actif (classe posée sur `<html>`). Sans JavaScript, rien n'est masqué.
- Navigation au clavier, focus visible (accent doré), lien d'évitement vers le contenu.

## 7. Contenu

### 7.1 Les 8 projets

| #   | Slug                       | Projet                     | Ce que l'étude de cas met en avant                                                                                                                                                        | Sources                                                    |
| --- | -------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `la-fabrique-des-mondes`   | La Fabrique des Mondes     | God game en Three.js où chaque élément matérialise un procédé : attracteurs étranges, triangle de Sierpiński, paysage adaptatif, voyageur de commerce, éponge de Menger, L-systèmes, automate de Wolfram, boids | ancien site, repo, greg0s.github.io/la-fabrique-des-mondes |
| 2   | `what-we-play`             | What we play?              | TV-personnage qui réagit à l'utilisateur ; Mac 3D en CSS pur avec un pion animé par joueur ; trois langues à routes typées ; pré-rendu et SEO ; tests e2e                                 | repo, whatweplay.gregoiretinn.es                           |
| 3   | `litterature-combinatoire` | Littérature & Combinatoire | Exposition et site de génération de textes par combinaison (PHP Slim, SQL, Socket.io), en équipe de quatre (maquettes, back, front) ; vidéo promotionnelle (Premiere Pro, After Effects) | ancien site (2 pages), combimac.oulico.fr, vidéo YouTube   |
| 4   | `sncf-wrapped`             | SNCF Wrapped               | Bilan annuel des trajets en train, raconté écran par écran ; tout se passe dans le navigateur, ce que garantit un test ; carte à partager ; tests aléatoires                              | repo, greg0s.github.io/sncf-wrapped                        |
| 5   | `recoding`                 | Recoding                   | Art génératif et interactif (p5.js, TypeScript), en binôme                                                                                                                               | ancien site, repo, greg0s.github.io/recoding               |
| 6   | `lyrix`                    | Lyrix                      | Jeu à la Pédantix sur des paroles : multijoueur en temps réel (Durable Objects, WebSockets), indices par embeddings précalculés, backend Cloudflare Workers + Hono qui garde les paroles secrètes, tests | repo                                                       |
| 7   | `le-petit-prince`          | Le Petit Prince            | Courte animation 3D réalisée sous Blender                                                                                                                                                 | ancien site, Behance                                       |
| 8   | `obaine`                   | Obaine                     | Front-end d'une plateforme de financement d'athlètes par leurs fans (Vue, Pinia, Vue Router, Vitest, Docker)                                                                              | ancien site, Behance                                       |

- À l'étape 3, on confirme avec Grégoire les années, les rôles exacts et les URL manquantes (comme l'adresse en ligne de Lyrix).
- Visuels : au départ, les images de l'ancien repo. Elles sont remplacées par les originaux en haute définition quand Grégoire les fournit. On fait de nouvelles captures des sites en ligne pour What we play?, SNCF Wrapped et Lyrix.

### 7.2 Structure d'une étude de cas

1. Le plan d'ouverture, puis le titre, le type, l'année, le rôle, la stack et les liens.
2. **Contexte** : le projet, son cadre (école, perso, pro, équipe) et son objectif.
3. **Ce que j'ai fait** : la part de Grégoire dans le projet.
4. **Défis techniques** : deux ou trois défis, présentés chacun en trois temps : problème, solution, résultat.
5. Des images et des vidéos au fil du texte.

Claude rédige une première version en français et en anglais, à partir de l'ancien site et du code des repos. Grégoire la corrige et la complète.

### 7.3 À propos

- **Bio** : une centaine de mots, orientée creative developer.
- **Compétences** :
  - code créatif : Three.js, GLSL, WebGL/OpenGL, p5.js ;
  - front-end : TypeScript, Vue, React, Astro ;
  - 3D et motion : Blender, After Effects, Premiere Pro ;
  - design : Figma, Illustrator, Photoshop.
- **Parcours** : le diplôme d'ingénieur multimédia IMAC, et les expériences reprises du CV.
- **CV** en PDF, en français et en anglais.

### 7.4 À fournir par Grégoire

- le CV à jour, en français et en anglais ;
- l'adresse email à afficher ;
- l'URL LinkedIn à jour ;
- la validation des années et des rôles ;
- facultatif : un portrait, et les visuels et vidéos originaux.

## 8. Qualité

### 8.1 Commandes

| Commande            | Rôle                                                       |
| ------------------- | ---------------------------------------------------------- |
| `pnpm lint`         | ESLint (TypeScript, Astro)                                 |
| `pnpm format:check` | Prettier                                                   |
| `pnpm check`        | `astro check` : typage, clés de traduction comprises       |
| `pnpm test`         | tests unitaires (Vitest)                                   |
| `pnpm build`        | build, vérifications de contenu comprises                  |
| `pnpm test:e2e`     | tests de bout en bout (Playwright, sur le site construit)  |

### 8.2 Tests unitaires

- la correspondance FR ↔ EN de chaque page ;
- l'ajout du chemin de base aux URL ;
- les vérifications du contenu (paire FR/EN, `order` unique) ;
- les calculs du moteur WebGL (passage d'un rectangle DOM à un plan, recadrage avec point focal).

### 8.3 Tests de bout en bout (Chromium)

- chaque page répond et s'affiche, en français et en anglais ;
- le sélecteur de langue mène à la page équivalente ;
- aucun lien interne n'est cassé et la console ne montre aucune erreur ;
- le contenu reste visible sans JavaScript ;
- avec « réduire les animations », le contenu reste visible et la caméra ne bouge pas ;
- l'audit axe ne relève aucune violation sur l'accueil, une étude de cas et À propos, dans les deux langues.

### 8.4 Budgets de performance

- JavaScript initial de 60 Ko compressés au plus, sans compter le moteur WebGL chargé en différé ;
- LCP de 2,5 s au plus (Lighthouse, mobile) ;
- deux fichiers de police préchargés au plus.

## 9. Mise en ligne

- **CI** (`.github/workflows/ci.yml`), à chaque push et à chaque pull request : installation, lint, formatage, `astro check`, tests unitaires, build, tests e2e.
- **Déploiement** (`.github/workflows/deploy.yml`), à chaque push sur `main` : build, puis publication sur GitHub Pages.
- **Branches** : `main` est la branche publiée. Le travail se fait sur une branche dédiée, intégrée à `main` étape par étape.
- **Prévisualisation** : pendant la construction, le site est publié sur `https://greg0s.github.io/portfoliov2/`. L'ancien site reste en ligne sur `gregoiretinn.es`.
- **Mise en service** (étape 10), faite avec l'accord explicite de Grégoire au moment venu :
  1. retirer le domaine personnalisé du repo `Greg0s/portfolio` ;
  2. déclarer `gregoiretinn.es` dans les réglages GitHub Pages de `Greg0s/portfoliov2`, et passer le chemin de base à `/` ;
  3. vérifier le HTTPS et les redirections des anciennes URL ;
  4. archiver `Greg0s/portfolio`.

  Les DNS ne changent pas, puisque les deux repos sont sur GitHub Pages. Les sous-domaines `whatweplay` et `topaventura` ne sont pas concernés.
- **Langue des documents** : le `README.md` du repo est en anglais, parce que le repo est public et lu par des recruteurs. Cette spec et les échanges de travail restent en français.

## 10. Étapes de construction

Chaque étape se termine avec une CI verte et le site à jour sur la prévisualisation.

| #   | Étape           | Contenu                                                                                                                                  | Terminée quand                                                                                                   |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Fondations      | Projet Astro, TypeScript strict, ESLint, Prettier, Vitest, Playwright, CI, déploiement, `README.md`, `CLAUDE.md`, page « bientôt »          | la page « bientôt » est en ligne et la CI est verte                                                              |
| 2   | Design system   | Jetons CSS, choix des polices, grille, en-tête, pied de page, routage FR/EN, sélecteur de langue, textes d'interface typés               | les pages vides existent en FR et en EN, le sélecteur fonctionne et les tests de routes passent                  |
| 3   | Contenu         | Schémas, vérifications, page d'étude de cas, import des 8 projets en brouillon, images optimisées                                        | les 8 études de cas s'affichent en FR et en EN, et supprimer un `fr.md` fait échouer le build                    |
| 4   | Pages           | Accueil (ouverture statique, index), À propos, 404, SEO de base, redirections des anciennes URL                                          | le site est complet et utilisable sans JavaScript, et les tests e2e de base passent                              |
| 5   | Motion          | Lenis, apparitions avec GSAP, routeur client (avec un test de canvas persistant), mode « réduire les animations »                       | la navigation se fait sans rechargement et le test e2e « réduire les animations » passe                          |
| 6   | WebGL, partie 1 | Moteur, plans synchronisés, modes, chargement différé, shaders de grain, vignettage, exposition et mise au point                         | les médias sont rendus en WebGL avec un repli identique, et la performance Lighthouse reste à 90 ou plus         |
| 7   | WebGL, partie 2 | Plan fixe vivant, survol de l'index, transition vers l'étude de cas, travelling au défilement                                            | le parcours complet est fluide (60 images/s sur un ordinateur de milieu de gamme) et se dégrade proprement sur mobile |
| 8   | Rédaction       | Études de cas complètes en FR et en EN, bio, CV, visuels HD                                                                              | Grégoire a tout relu et validé                                                                                   |
| 9   | Finitions       | Accessibilité, performance, SEO, images de partage, sitemap, tests e2e complets                                                          | les objectifs Lighthouse sont atteints                                                                           |
| 10  | Mise en service | Transfert du domaine (voir section 9)                                                                                                    | `gregoiretinn.es` sert le nouveau site en HTTPS et l'ancien repo est archivé                                     |

## 11. Risques et parades

| Risque                                                                 | Parade                                                                                                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Transitions WebGL entre pages délicates avec le routeur client d'Astro | un canvas persistant est testé dès l'étape 5 ; si la transition bloque, repli sur un simple fondu                       |
| Performance sur mobile (WebGL, vidéos)                                 | densité de pixels réduite, textures à la taille affichée, pause hors écran, passage automatique en mode `reduced` (section 6.4) |
| Anciens visuels en basse résolution                                    | traitement grain et vignettage commun, originaux en haute définition, nouvelles captures                                |
| Charge de rédaction bilingue                                           | premières versions rédigées par Claude et relues par Grégoire ; le build bloque toute traduction manquante              |
