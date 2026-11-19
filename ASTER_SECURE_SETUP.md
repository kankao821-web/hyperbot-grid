# Connexion Aster V3 — secrets Railway

## Configuration préparée
Le service Railway `hyperbot-aster-cloud` utilise l'API Aster V3 en mainnet. Le trading réel est volontairement désactivé tant que la signature, les soldes, la précision des ordres, les filtres des marchés, les limites de risque, les reprises après incident et les tests n'ont pas été validés.

### Secrets à saisir UNIQUEMENT dans Railway
Ouvrir le service **hyperbot-aster-cloud → Variables → New Variable**.
Créer les variables suivantes (ne pas mettre les valeurs dans GitHub, le navigateur ou une conversation) :

- `ASTER_USER_ADDRESS` : adresse **publique du portefeuille principal** Aster (pas l'adresse Agent).
- `ASTER_AGENT_ADDRESS` : adresse **publique de l'API Wallet / Agent** autorisé.
- `ASTER_AGENT_PRIVATE_KEY` : clé privée **de cet Agent seulement** (jamais celle du portefeuille principal). Utiliser une variable scellée si disponible dans Railway.

Ne pas ajouter de droits de retrait à l'Agent. Si une clé a été exposée, révoquer l'Agent et en créer un autre. Vérifier les permissions Spot et Futures et, si possible, restreindre par IP de sortie fixe.

### Variables non secrètes déjà configurées
`ASTER_NETWORK=mainnet`, `ASTER_API_VERSION=v3`, `ASTER_SIGNATURE_CHAIN_ID=1666`,
`ASTER_SPOT_ENABLED=true`, `ASTER_FUTURES_ENABLED=true`,
`ASTER_LIVE_TRADING_ENABLED=false`, `ASTER_WITHDRAWALS_ENABLED=false`,
`ASTER_MAX_CAPITAL_USDT=100`, `ASTER_MAX_OPEN_ORDERS=4`,
`ASTER_MAX_LEVERAGE=1`, `ASTER_REQUIRE_CONFIRMATION=true`.

**Attention :** ces variables préparent la configuration mais ne constituent pas à elles seules une implémentation de trading réel. Ne jamais changer `ASTER_LIVE_TRADING_ENABLED` avant l'intégration complète et les tests.

### Documentation Aster
- https://asterdex.github.io/aster-api-website/spot-v3/general-info/
- https://asterdex.github.io/aster-api-website/futures-v3/general-info/
- https://asterdex.github.io/aster-api-website/asterCode/authentication/
- https://asterdex.github.io/aster-api-website/asterCode/spot-authentication/

Les requêtes authentifiées V3 utilisent la signature EIP-712 `AsterSignTransaction` sur `Message.msg` (chaîne 1666 en mainnet) et un nonce en microsecondes. Une authentification erronée ne doit jamais être contournée en envoyant la clé privée au navigateur.
