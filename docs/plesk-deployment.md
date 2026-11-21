# Déploiement de la plateforme indépendante PepsiCo sur Plesk

## Réglages de l’application Node.js

Dans le dépôt Git configuré dans Plesk, choisir :

| Réglage Plesk | Valeur |
| --- | --- |
| Application root | Racine du dépôt, le dossier qui contient `package.json` |
| Document root | `dist/public` (relatif à l’application root) |
| Application startup file | `dist/index.cjs` (relatif à l’application root) |
| Node.js | Node 20.20 ou une version compatible plus récente |
| Mode | Production (`NODE_ENV=production`) |

Le serveur écoute sur `PORT` fourni par Plesk. Ne pas fixer le port dans le code.

## Première installation et mises à jour

1. Connecter le dépôt GitHub à Plesk et vérifier que la branche déployée est la bonne.
2. Installer les dépendances dans l’application root (`npm ci`, ou **NPM Install** dans Plesk).
3. Avant chaque push contenant des changements d’application, exécuter localement :

   ```bash
   npm run check
   npm run build
   ```

4. Inclure le dossier `dist/` généré dans le commit : le serveur Plesk démarre `dist/index.cjs` et sert `dist/public`. Le bouton **Pull + Deploy Now** récupère ces fichiers; il ne remplace pas la compilation locale.
5. Dans Plesk, faire **Pull + Deploy Now**, puis **Restart** l’application Node.js.
6. Vérifier la page d’accueil, la connexion et les logs de l’application.

`npm start` lance également `NODE_ENV=production node dist/index.cjs`.

## Variables d’environnement Plesk

Dans Plesk, ouvre les paramètres de l’application Node.js et ajoute les valeurs dans sa section de variables d’environnement. Plesk a son propre environnement : les Secrets configurés dans Replit ne sont pas transférés automatiquement. Ne place aucune valeur secrète dans Git, `.replit` ou un fichier `.env` versionné.

### Nécessaires à l’application

- `SESSION_SECRET`
- `SUPABASE_DATABASE_URL` **ou** `DATABASE_URL`. Si les deux sont définis, l’application privilégie `SUPABASE_DATABASE_URL`.
- `NODE_ENV=production`

Plesk fournit `PORT`. Ne pas copier les Secrets Replit automatiquement : saisir les valeurs requises dans l’environnement de Plesk.

### Provisionnement du compte Super Admin

- `ADMIN_PHONE`, `ADMIN_PASSWORD` et `ADMIN_PIN`. Au démarrage, le provisionnement Admin lit ces valeurs et met à jour le compte associé à `ADMIN_PHONE`.

### Selon les fonctions activées

- URL publique et callbacks : après activation du certificat SSL, définir `PUBLIC_APP_URL=https://geenergy.top` (ne pas utiliser l’URL HTTP fournie pour les paiements).
- Telegram : `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- PPayPros : ajouter le triplet de chaque pays utilisé :

  | Pays | Numéro marchand | ID d’application | Clé privée |
  | --- | --- | --- | --- |
  | Bénin | `PPAYPROS_MCH_NO_BJ` | `PPAYPROS_APP_ID_BJ` | `PPAYPROS_PRIVATE_KEY_BJ` |
  | Togo | `PPAYPROS_MCH_NO_TG` | `PPAYPROS_APP_ID_TG` | `PPAYPROS_PRIVATE_KEY_TG` |
  | Côte d’Ivoire | `PPAYPROS_MCH_NO_CI` | `PPAYPROS_APP_ID_CI` | `PPAYPROS_PRIVATE_KEY_CI` |
  | Cameroun | `PPAYPROS_MCH_NO_CM` | `PPAYPROS_APP_ID_CM` | `PPAYPROS_PRIVATE_KEY_CM` |
  | Burkina Faso | `PPAYPROS_MCH_NO_BF` | `PPAYPROS_APP_ID_BF` | `PPAYPROS_PRIVATE_KEY_BF` |

  Les anciens noms sans suffixe (`PPAYPROS_MCH_NO`, `PPAYPROS_APP_ID`, `PPAYPROS_PRIVATE_KEY`) ne sont conservés que pour la compatibilité historique du Bénin; privilégier les noms par pays.
- InPay : `INPAY_API_BASE_URL`, puis `INPAY_API_KEY_<CC>` et, si nécessaire, `INPAY_MERCHANT_ID_<CC>` pour chaque code pays activé (par exemple `_TG` ou `_CI`). Le marchand peut aussi être configuré dans le panneau Admin.
- Autres fournisseurs activés : `ASHTECHPAY_API_KEY`, `ASHTECHPAY_USER_ID`, `ASHTECHPAY_WEBHOOK_SECRET`, `DRIMPAY_API_KEY`, `DRIMPAY_WEBHOOK_SECRET`, `WESTPAY_MERCHANT_SLUG`, `WESTPAY_WEBHOOK_SECRET`, les `WESTPAY_API_KEY_<CC>` nécessaires, `SENDAVAPAY_API_KEY`, `SENDAVAPAY_WEBHOOK_SECRET`, `SOLEASPAY_API_KEY` et `OMNIPAY_API_KEY`.

Routes à enregistrer chez les fournisseurs activés, avec le domaine HTTPS :

- WestPay webhook : `https://geenergy.top/api/webhooks/westpay` ; retour navigateur WestPay : `https://geenergy.top/api/westpay/callback` (ce retour n’est pas le webhook).
- DrimPay : `https://geenergy.top/api/webhooks/drimpay`
- AshTechPay : `https://geenergy.top/api/webhooks/ashtechpay`
- InPay : `https://geenergy.top/api/webhooks/inpay`
- SendavaPay : `https://geenergy.top/api/webhooks/sendavapay`
- PPayPros : `https://geenergy.top/api/webhooks/ppaypros/payin` et `https://geenergy.top/api/webhooks/ppaypros/payout`

Activer HTTPS dans Plesk avant de configurer ces URLs : certains fournisseurs rejettent les callbacks en HTTP.

## Avant de basculer le site public

Le Supabase actuellement configuré contient la copie de la base **de développement** Replit. La base de production n’a pas été migrée ni vérifiée. Ne pas brancher le site public sur ce Supabase avant d’avoir migré et contrôlé les données de production séparément.

Les Secrets présents dans Replit restent séparés de l’environnement Plesk : configure séparément dans Plesk chaque variable requise par les fonctions que tu actives. Ne jamais mettre leurs valeurs dans Git ni dans un fichier `.env` versionné.
