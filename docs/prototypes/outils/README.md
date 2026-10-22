# Outils : vérifier le canevas hors du canevas

Les composants de la maquette (le canevas Claude Design, voir `docs/specs/2026-10-20-maquette-v3-parcours.md`) ne tournent que dans le canevas. Ces outils permettent de les contrôler et d'en faire des images ailleurs, par exemple dans une session cloud, avant de publier.

- `verifier.cjs` : exécute le script d'un composant dans un faux environnement, appelle `renderVals` pour chaque jeu de propriétés et signale les trous du gabarit (`{{…}}`) restés sans valeur.
- `rendre.cjs` : écrit une page HTML statique d'un composant (trous, `sc-if`, `sc-for` et composants importés), dans son premier état, sans animation ni interaction.
- `photographier.cjs` : capture ces pages dans Chromium sans interface, en les servant en local : les masques CSS faits d'une image ne se chargent pas dans une page ouverte en `file://`.

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

## Limites

- La page montre le premier état : ni minuteries, ni `requestAnimationFrame`, ni animations Web, ni gestionnaires d'évènements.
- Les composants importés reçoivent leurs attributs comme dans le canevas (`dive-index` devient `diveIndex`) ; les attributs `hint-*` sont ignorés.
- Les polices des balises `<helmet>` (Google Fonts) demandent un accès au réseau.
- Les fichiers du canevas ne sont jamais versionnés : la référence est l'artefact publié.
