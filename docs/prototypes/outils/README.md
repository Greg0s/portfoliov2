# Outils : vérifier le canevas hors du canevas

Les composants de la maquette (le canevas Claude Design, voir `docs/specs/2026-10-20-maquette-v3-parcours.md`) ne tournent que dans le canevas. Ces outils permettent de les contrôler et d'en faire des images ailleurs, par exemple dans une session cloud, avant de publier.

- `verifier.cjs` : exécute le script d'un composant dans un faux environnement, appelle `renderVals` pour chaque jeu de propriétés et signale les trous du gabarit (`{{…}}`) restés sans valeur.
- `rendre.cjs` : écrit une page HTML statique d'un composant (trous, `sc-if`, `sc-for` et composants importés), dans son premier état, sans animation ni interaction.
- `photographier.cjs` : capture ces pages dans Chromium sans interface, en les servant en local : les masques CSS faits d'une image ne se chargent pas dans une page ouverte en `file://`.
- `interactions/` : déroule les interactions de certains composants (voir plus bas).

## Mise en route

```sh
npm install
```

Les navigateurs de Playwright doivent être installés, ou `CHROMIUM_PATH` renseigné.

## Méthode

1. Récupérer les fichiers dans `essais/` (non versionné) : les fichiers publiés `project/*.dc.html` de l'artefact dans `essais/canevas/`, puis les images utiles dans `essais/blobs/`, lues par leur identifiant (l'outil Artifact de Claude les enregistre sous la forme `<identifiant>.<extension>`).
2. Vérifier un composant :

   ```sh
   node verifier.cjs essais/canevas/Bureau.dc.html '{}' '{"mode":"Mobile","arrival":0.5}'
   ```

3. Le rendre en page statique :

   ```sh
   node rendre.cjs essais/canevas/Scene.dc.html '{"progress":0.96,"mode":"desktop","heure":"Crépuscule","still":true}' essais/scene.html --blobs=essais/blobs
   ```

   `--state='{"preview":"GitHub"}'` complète l'état du premier composant (ici, le navigateur ouvert sur l'écran du bureau) ; `--reduce` simule le réglage « Réduire les animations ». Les images absentes de `--blobs` sont listées à la fin.

4. La photographier :

   ```sh
   node photographier.cjs essais 1440x900 scene.html   # écrit essais/scene.png
   ```

## Tester les interactions

Les pages statiques ne réagissent pas. Les scripts de `interactions/` exécutent la logique d'un composant dans un faux environnement, sans navigateur, et en déroulent les interactions, avec « ok » ou « FAIL » à chaque étape :

- `contact.cjs` : les actions de l'email du bureau (bouton de copie sur ordinateur, bulle sur mobile) ;
- `cartels.cjs` : les images du mur et du bureau (tirage, calage, cartels au survol et au toucher) ;
- `corbeille.cjs` : la Corbeille de l'écran (fenêtre de confirmation, passage par le noir, nouveau tirage, message) ; il prend le dossier qui contient `Ecran`, `Bureau` et `Main` ;
- `menu.cjs` : l'ouverture et la fermeture du menu mobile (ajouter `reduce` pour le mouvement réduit).

```sh
node interactions/cartels.cjs essais/canevas/Bureau.dc.html
node interactions/corbeille.cjs essais/canevas
node interactions/menu.cjs essais/canevas/Mobile.dc.html reduce
```

À relancer après chaque modification de ces composants ; quand un changement voulu fait échouer un test, le test se met à jour avec lui.

## Limites

- La page montre le premier état : ni minuteries, ni `requestAnimationFrame`, ni animations Web, ni gestionnaires d'évènements.
- Les composants importés reçoivent leurs attributs comme dans le canevas (`dive-index` devient `diveIndex`) ; les attributs `hint-*` sont ignorés.
- Les polices des balises `<helmet>` (Google Fonts) demandent un accès au réseau.
- Les fichiers du canevas ne sont jamais versionnés : la référence est l'artefact publié.
