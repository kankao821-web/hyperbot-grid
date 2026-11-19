# HyperBot GRID LAB V3

Interface web autonome en français pour tester un Spot GRID BTC avec 100 USDC fictifs.

## Lancer
Ouvrir `index.html` dans Chrome, Edge ou Firefox. Aucun Python, installation ou connexion n'est requis.

## Mettre en ligne
Le dépôt contient un workflow GitHub Actions (`.github/workflows/deploy.yml`) qui publie automatiquement le site sur GitHub Pages à chaque modification de `main`, une fois Pages configuré avec **Source : GitHub Actions**. Adresse prévue : https://kankao821-web.github.io/hyperbot-grid/ . Vérifier l'exécution dans l'onglet Actions avant de considérer le site comme publié.

## Importer des cours
CSV avec une colonne `Close` ou `Price`, éventuellement `Date`. Trier les lignes de la plus ancienne à la plus récente. Le moteur traite chaque ligne comme une observation et n'utilise que les clôtures. Les fichiers sont lus localement dans le navigateur et ne sont pas envoyés à un serveur.

## Modèle de simulation et limites
- Pas de connexion Hyperliquid, de portefeuille, ni d'ordre réel.
- Le moteur crée une grille arithmétique fixe autour du premier cours, avec une tranche d'achat par intervalle et une revente au palier supérieur.
- Les franchissements sont détectés à partir des clôtures consécutives; les ordres sont exécutés au niveau franchi, une approximation optimiste qui ne modélise pas les gaps, la profondeur du carnet, le spread ni le slippage.
- Les frais sont paramétrables, non vérifiés sur Hyperliquid. Les tailles minimales sont hypothétiques.
- Le stop portefeuille suspend les nouveaux achats mais ne liquide pas les BTC déjà détenus.
- Le portefeuille est valorisé au dernier prix; les profits réalisés sont les profits nets sur les lots revendus. Le taux de réussite concerne uniquement les ventes clôturées.
- La comparaison achat-conservation suppose 100 % de BTC sans frais, ce qui n'est pas une stratégie de même risque.
- Le capital est exprimé en USDC fictifs et non en euros convertis.
- Aucun gain ni revenu n'est garanti. Prototype de recherche et démonstration, pas un système de trading validé.