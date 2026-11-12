# TVA & Prix : calcul de TVA, prix internationaux et suivi des ventes

Application web responsive (ordinateur, tablette, smartphone) destinée à un client unique. Elle permet de :

- **calculer la TVA** (HT → TTC, TTC → HT) selon le pays et le taux choisis ;
- **calculer un prix de vente cible** qui atteint un objectif financier (ex. 5 € de bénéfice par produit), frais compris, dans la devise du pays ;
- **comparer** ce prix entre plusieurs pays ;
- gérer **produits, catégories, entrepôts, pays / taux de TVA / taux de change** ;
- enregistrer des **ventes (transactions)** et les suivre dans un **tableau de bord graphique** (par pays, par entrepôt, par mois, top produits) ;
- conserver un **historique** des calculs.

> ⚠️ Les résultats sont des estimations fondées sur les taux saisis dans l'application. Ils ne constituent ni un conseil fiscal ni une garantie de conformité.

---

## Stack technique

| Couche           | Technologie                                                |
| ---------------- | ---------------------------------------------------------- |
| Framework        | Astro 5 (SSR, adaptateur Node standalone) + îlots React 19 |
| Langage          | TypeScript strict (`astro/tsconfigs/strictest`)            |
| Style            | Tailwind CSS 4                                             |
| Base de données  | PostgreSQL 16 + Prisma 6 (schéma, migrations, seed)        |
| Calcul monétaire | `decimal.js` (aucun flottant JavaScript dans les calculs)  |
| Authentification | Argon2id (`@node-rs/argon2`) + sessions serveur en base    |
| Validation       | Zod (côté serveur systématiquement)                        |
| Qualité          | ESLint, Prettier, Vitest                                   |

Aucun Redis pour le MVP : le cache (limitation des tentatives de connexion) passe par l'interface `CacheStore` (`src/lib/cache.ts`), implémentée en mémoire et remplaçable par Redis sans toucher au reste.

---

## Architecture

```
src/
├── domain/        Règles métier PURES, sans dépendance (testées à 100 %)
│   ├── money.ts     arrondis, devises, Decimal
│   ├── vat.ts       HT ↔ TTC, montant de TVA
│   ├── pricing.ts   prix cible selon objectif + frais, comparaison multi-pays
│   └── sales.ts     ventilation financière d'une vente
├── services/      Orchestration métier (lit la BDD via les repositories, appelle le domaine)
├── repositories/  Accès aux données (Prisma), seule couche qui touche PostgreSQL
├── schemas/       Schémas Zod (entrées API)
├── pages/         Pages Astro + pages/api/ (endpoints minces : validation → service → JSON)
├── components/    Composants React/Astro (formulaires, calculateur, graphiques SVG, menu)
├── lib/           Session, mots de passe, cache, limitation, erreurs, logs, contrôle d'origine
├── middleware.ts  Protection de TOUTES les routes privées + en-têtes de sécurité
├── types/  utils/
prisma/            schema.prisma, migrations/, seed.ts
scripts/           create-admin.ts
tests/unit/        domaine, schémas
tests/integration/ CRUD, ventes, statistiques, authentification, routes protégées (vraie base PostgreSQL)
```

Le calculateur affiche ses résultats **instantanément dans le navigateur** en réutilisant le même code `src/domain`. Lors de l'enregistrement, le serveur **revalide et recalcule tout** : il ne fait jamais confiance aux résultats envoyés par le client.

### Modèle de données

`User`, `Session`, `Country`, `VatRate`, `ExchangeRate`, `Category`, `Warehouse`, `Product`, `CalculationHistory`, `Sale`, `AppSettings`.

- Les montants sont en `Decimal(14,4)` et les taux en `Decimal(6,3)` (jamais en `Float`).
- Suppressions :
  - une catégorie ou un entrepôt utilisé par des produits ne peut pas être supprimé (refus explicite) ;
  - un pays utilisé par des entrepôts ou des ventes ne peut pas être supprimé (il faut le désactiver) ;
  - supprimer un produit conserve l'historique et les ventes (`SetNull` + instantané du nom et des montants).
- L'historique et les ventes stockent un **instantané** (taux, coût, taux de change) : modifier un taux plus tard ne réécrit pas le passé.

---

## Règles métier

Toutes les grandeurs sont **par unité**. L'analyse financière est exprimée dans la devise principale.

| Terme                 | Définition                                                                      |
| --------------------- | ------------------------------------------------------------------------------- |
| Chiffre d'affaires HT | prix de vente HT                                                                |
| TVA collectée         | HT × taux, **reversée à l'État**, jamais comptée comme un gain                  |
| Marge brute           | CA HT − coût de revient                                                         |
| Bénéfice              | marge brute − frais variables (transport, douane, plateforme, paiement, autres) |

**L'objectif porte sur le bénéfice.** Il peut être exprimé de trois façons :

- un **montant fixe** (5 € par défaut, modifiable dans Paramètres) ;
- un **pourcentage du coût de revient** ;
- un **taux de marque** (pourcentage du prix HT).

```
frais(HT)     = frais fixes + HT × Σ%HT + HT × (1 + t) × Σ%TTC
Prix HT cible = (coût + frais fixes + objectif) / (1 − Σ%HT − Σ%TTC × (1 + t))
```

Exemple : coût 20 €, objectif 5 €, TVA 20 % → HT 25 €, TVA 5 €, TTC 30 €.

- **Base du coût** : le coût de revient du produit, ou à défaut son prix d'achat.
- **Arrondis** :
  - calculs internes en pleine précision ;
  - arrondi monétaire au demi supérieur, selon la devise (0 décimale pour le JPY…) ;
  - le **prix HT cible est arrondi au centime supérieur**, pour garantir que l'objectif est atteint ;
  - la TVA est déduite des montants arrondis : HT + TVA = TTC exactement.
- **Devises** : le coût, l'objectif et les frais fixes sont en devise principale. Le prix de vente est converti avec le **taux de change saisi manuellement** (page « Pays, TVA et devises »). Sans taux renseigné, le calcul est refusé avec un message explicite.
- **Fiscalité** : ventes B2C, TVA du pays de destination. Les taux sont administrables, avec leur source et leur date de vérification. Les taux pré-chargés par le seed apparaissent **« À vérifier »** tant que l'administrateur ne les a pas contrôlés.

---

## Sécurité

- **Mots de passe** : hashés en Argon2id (paramètres OWASP). Un seul compte administrateur, sans inscription publique.
- **Sessions** :
  - jeton aléatoire de 256 bits ; seul son hash SHA-256 est stocké en base ;
  - cookie `HttpOnly`, `SameSite=Lax`, `Secure` en production ;
  - expiration glissante (`SESSION_TTL_HOURS`) ;
  - révocation à la déconnexion et lors de la réinitialisation du compte.
- **Limitation des tentatives** : 5 échecs par IP et par email, puis blocage de 15 minutes. Le temps de réponse est identique, que l'email existe ou non.
- **CSRF** : les requêtes modifiantes doivent avoir un `Origin` (ou `Referer`) égal à `APP_ORIGIN` ou, à défaut, à l'hôte de la requête. Cette vérification complète `SameSite=Lax`.
- **XSS** : rendu React et Astro échappé, en-têtes `Content-Security-Policy`, `X-Frame-Options: DENY`, `nosniff`.
- **Injections SQL** : requêtes Prisma paramétrées. Le seul SQL brut (agrégation mensuelle) est un template paramétré.
- **Contrôle d'accès** : toutes les pages et API sont privées par défaut (middleware), sauf `/login`, `/api/auth/login` et `/api/health`.
- **Erreurs** : les messages renvoyés sont génériques, sans pile ni détail interne. Les erreurs sont journalisées en JSON sur la sortie standard.

---

## Accessibilité et ergonomie

- Menu complet par sections (Pilotage, Transactions, Calculs, Catalogue, Fiscalité, Compte) et bloc **Ajout rapide** (+ Vente, + Produit, + Catégorie, + Entrepôt, + Pays) qui ouvre directement le formulaire.
- Page active en **surbrillance forte** (fond bleu plein, liseré ambre), grandes zones cliquables, icônes.
- Réglage de la **taille du texte** (A / A+ / A++), mémorisé dans le navigateur, A+ par défaut.
- Contrastes renforcés, contour de focus ambre épais pour la navigation au clavier.

---

## Installation locale

Prérequis : Node.js ≥ 20.3 (22 recommandé), pnpm (`corepack enable`), PostgreSQL 16.

1. Installez les dépendances et créez le fichier `.env` :

   ```bash
   pnpm install
   ```

   ```bash
   cp .env.example .env
   ```

2. Éditez `.env` : `DATABASE_URL`, `TEST_DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12 caractères minimum).

3. Créez la base de développement et la base de tests :

   ```bash
   createdb tva && createdb tva_test
   ```

4. Appliquez les migrations :

   ```bash
   pnpm db:migrate
   ```

5. Initialisez les données (paramètres, pays de référence, compte administrateur) :

   ```bash
   pnpm db:seed
   ```

   Facultatif, avec des données de démonstration **fictives** (produits, ventes, taux de change) :

   ```bash
   SEED_DEMO=true pnpm db:seed
   ```

6. Lancez le serveur :

   ```bash
   pnpm dev
   ```

L'application est alors disponible sur http://localhost:4321.

## Commandes utiles

| Commande                                          | Rôle                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev`                                        | serveur de développement                                             |
| `pnpm build`                                      | vérification des types (astro check) + build de production           |
| `pnpm start`                                      | lance le build de production (`dist/server/entry.mjs`)               |
| `pnpm test`                                       | tous les tests (unitaires + intégration)                             |
| `pnpm test:unit` / `pnpm test:integration`        | tests ciblés                                                         |
| `pnpm typecheck`                                  | `astro check` + `tsc --noEmit`                                       |
| `pnpm lint` / `pnpm format` / `pnpm format:check` | ESLint / Prettier                                                    |
| `pnpm db:migrate`                                 | crée et applique une migration (développement)                       |
| `pnpm db:deploy`                                  | applique les migrations (production)                                 |
| `pnpm db:seed`                                    | initialise la base (idempotent, n'écrase pas les pays existants)     |
| `pnpm admin:create`                               | crée ou réinitialise le compte administrateur (révoque ses sessions) |

Les tests d'intégration utilisent **exclusivement** `TEST_DATABASE_URL` et la vident à chaque test. Par sécurité, son nom doit contenir « test ». Sans cette variable, ils sont ignorés.

## Migrations

- Modifier `prisma/schema.prisma`, puis `pnpm db:migrate --name description_courte` : la migration est générée dans `prisma/migrations/` et doit être versionnée.
- En production : `pnpm db:deploy`. Le conteneur Docker le fait automatiquement au démarrage.

---

## Déploiement

### Avec Docker Compose (VPS)

1. Préparez le fichier `.env` :

   ```bash
   cp .env.example .env
   ```

   Renseignez `POSTGRES_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` et `APP_ORIGIN` (ex. `https://tva.mondomaine.fr`).

2. Construisez et démarrez les conteneurs :

   ```bash
   docker compose up -d --build
   ```

3. Initialisez la base (pays de référence et compte administrateur) :

   ```bash
   docker compose exec app pnpm db:seed
   ```

- Au démarrage, le conteneur `app` applique les migrations puis lance le serveur sur le port 4321. Un healthcheck interroge `/api/health`.
- Placez un reverse proxy HTTPS devant (Caddy, Nginx, Traefik). **HTTPS est obligatoire en production** : le cookie de session est `Secure`.
- Les logs sont en JSON sur stdout : `docker compose logs -f app`.
- Sauvegarde : `docker compose exec db pg_dump -U tva tva > sauvegarde.sql`.

### Sans Docker (plateforme Node)

```bash
pnpm install --frozen-lockfile && pnpm build && pnpm db:deploy && pnpm start
```

Variables requises : `DATABASE_URL`, `APP_ORIGIN`, `SESSION_TTL_HOURS` (facultative), `HOST`, `PORT`.

### Variables d'environnement

Voir `.env.example`. Aucune clé secrète n'est exposée au navigateur : aucune variable `PUBLIC_*` n'est utilisée.

---

## Décisions techniques

- **Calculs en `decimal.js`, centralisés dans `src/domain`** : déterministes, testables, partagés entre le client (affichage instantané) et le serveur (référence).
- **Sessions en base plutôt que JWT** : révocation immédiate, rien de sensible côté client.
- **Graphiques en SVG maison, rendus côté serveur** : aucune dépendance supplémentaire, aucun JavaScript client nécessaire.
- **Contrôle d'origine maison** à la place de `security.checkOrigin` d'Astro, dont la comparaison échoue derrière un reverse proxy (origine interne différente).
- **Gestionnaire CRUD générique** (`EntityManager`) : une seule implémentation pour les listes, formulaires, recherches et suppressions.
- **Entité `Sale` ajoutée** (non prévue au cahier des charges initial) pour alimenter le tableau de bord par pays et par entrepôt.
- **Limites connues du MVP** :
  - taux de change manuels, sans API externe ;
  - limitation des tentatives en mémoire (une seule instance) ;
  - pas de gestion des règles B2B, OSS ou des seuils.
