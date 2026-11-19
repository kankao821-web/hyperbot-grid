# HyperBot GRID — moteur Hyperliquid TESTNET

Moteur serveur **distinct du site GitHub Pages**. **TESTNET uniquement** (URL codée en dur). Le moteur n'est pas déployé automatiquement, ne détient aucune clé dans GitHub et ne peut pas passer d'ordre avant configuration et démarrage explicite.

## Démarrage local

1. Installer Python 3.11+ et les dépendances : `pip install -r bot/requirements.txt`
2. Créer une **API Wallet dédiée sur le testnet Hyperliquid**, approuvée pour votre compte principal testnet. Copier `bot/.env.example` en `bot/.env` et renseigner l'adresse du **compte principal** et la clé **API Wallet testnet uniquement**. Ne jamais utiliser de phrase de récupération ou de clé de compte principal.
3. Charger les variables de `bot/.env` dans l'environnement de votre machine (le script ne lit pas automatiquement le fichier).
4. Depuis la racine : `python bot/grid_bot.py` : vérifie le marché et propose les ordres **sans rien envoyer**.
5. Après vérification manuelle des ordres et des soldes testnet : `python bot/grid_bot.py --execute` : permet d'envoyer un seul ordre testnet à la fois, en boucle, après confirmation explicite `TESTNET` au clavier. Pour arrêter : Ctrl+C.

**Attention :** prototype prudent, **pas prêt pour production**. L'algorithme propose un seul achat limite GTC au niveau immédiatement inférieur au cours, et ne le remplace pas tant qu'il reste ouvert. Il ne vend pas automatiquement : aucune vente sans suivi fiable des lots, frais et exécutions partielles. La grille affichée est indicative. Il n'y a **pas de moteur de rendement autonome complet** dans cette version.

Garde-fous : domaine testnet figé ; ordres uniquement Spot UBTC/USDC ; contrôle du solde USDC et des ordres existants ; montant par ordre plafonné ; pas de retrait ni transfert ; erreur si la paire Spot est absente du testnet ; aucune clé dans le navigateur. Avant usage réel, ajouter stockage durable, réconciliation des fills, vente de lots, stop de portefeuille, limites de pertes, reprise après incident, audit et tests.

La page statique publique n'est **pas connectée** à ce processus local. Pour un pilotage distant sécurisé, prévoir backend privé avec authentification, HTTPS et hébergement dédié.
