# Le Rempart

Site d'actualité Next.js pour [le-rempart.org](https://le-rempart.org) : articles publics, admin protégé par mot de passe, génération d'articles via Kimi (Moonshot AI), Postgres + Prisma.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Postgres (Vercel Postgres / Neon) + Prisma
- Kimi (Moonshot AI, API compatible OpenAI) pour la rédaction assistée
- Déploiement prévu sur Vercel

## Démarrage local

1. Copier l'environnement :

```bash
cp .env.example .env
```

2. Renseigner `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `MOONSHOT_API_KEY`.

3. Installer et migrer :

```bash
npm install
npx prisma migrate deploy
npm run dev
```

4. Ouvrir [http://localhost:3000](http://localhost:3000) et l'admin sur [http://localhost:3000/admin](http://localhost:3000/admin).

## Déploiement Vercel

1. Créer un projet Vercel lié à ce dépôt.
2. Ajouter une base **Postgres** (Vercel Postgres ou Neon) et lier `DATABASE_URL`.
3. Définir les variables d'environnement :
   - `DATABASE_URL`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET` (chaîne longue aléatoire)
   - `MOONSHOT_API_KEY`
   - `NEXT_PUBLIC_ADSENSE_CLIENT` (plus tard, optionnel)
4. Le script `build` exécute `prisma generate` puis `next build`. Après le premier déploiement, lancer les migrations :

```bash
npx prisma migrate deploy
```

   (ou ajouter une commande de release / hook de build qui exécute `prisma migrate deploy`).

5. Attacher le domaine custom `le-rempart.org` dans Vercel.

## Flux admin

1. Connexion avec le mot de passe partagé.
2. **Nouvel article** : titre + texte source et/ou URL.
3. **Générer avec Kimi** : article Markdown + chapô.
4. Relire / éditer, puis **Enregistrer brouillon** ou **Publier**.

## Bot Telegram

1. Crée un bot avec [@BotFather](https://t.me/BotFather), récupère `TELEGRAM_BOT_TOKEN`.
2. Ajoute les variables sur Vercel : `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`, `NEXT_PUBLIC_SITE_URL`.
3. Envoie `/start` au bot → il te donne ton user id → mets-le dans `TELEGRAM_ALLOWED_USER_IDS` → Redeploy.
4. Enregistre le webhook (**www**, pas apex) :

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://www.le-rempart.org/api/telegram/webhook"
```

5. Envoie une créative (image + légende) → article publié + lien renvoyé (+ Facebook si configuré).

## Illustrations (site)

Ordre de recherche :
1. **Wikimedia Commons** (Macron, Attal, ministres, etc. — images libres) — aucune clé
2. **Unsplash** (thèmes génériques) si `UNSPLASH_ACCESS_KEY` est défini
3. Sinon la **créative Canva** envoyée sur Telegram

Facebook utilise toujours la **créative Canva**.

## Facebook Page (post auto)

Le token collé depuis **Graph API Explorer** expire en **1–2 heures**. Sans token **Page longue durée**, le blog publie mais Facebook échoue silencieusement (ou avec un message Telegram « token expired »).

### Créer un token Page qui ne expire pas

1. [developers.facebook.com](https://developers.facebook.com) → ton App → **Paramètres** → **Général** : note `App ID` + `App Secret`.
2. **Outils** → **Graph API Explorer** :
   - Permissions : `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `pages_manage_engagement`, `pages_manage_metadata`
   - Génère un **User Token** (toi, admin de la Page), pas encore le Page token.
3. Échange en **User Token long-lived** (~60 jours) — dans le navigateur ou curl :

```text
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=APP_ID
  &client_secret=APP_SECRET
  &fb_exchange_token=TOKEN_COURT_EXPLORER
```

4. Avec ce token long-lived, récupère le **Page Access Token** (celui-là ne expire en pratique pas tant que tu ne changes pas le mot de passe / les droits) :

```text
GET https://graph.facebook.com/v21.0/me/accounts?access_token=USER_TOKEN_LONG_LIVED
```

Dans la réponse, prends `id` (Page ID) et `access_token` de la Page **Le Rempart**.

5. Sur **Vercel** → Project → Settings → Environment Variables :
   - `FACEBOOK_PAGE_ID` = l’`id` de la Page
   - `FACEBOOK_PAGE_ACCESS_TOKEN` = l’`access_token` de la Page (pas le User token)
6. **Redeploy** (obligatoire après changement d’env).
7. Sur Telegram : `/fb` → doit répondre `Facebook OK` + nom de la Page.

Le bot publie alors : créative + texte « ‼️🇫🇷 𝗙𝗟𝗔𝗦𝗛 𝗜𝗡𝗙𝗢 — », puis un **commentaire épinglé** avec le lien article.

## AdSense

Le composant `AdSlot` n'affiche rien tant que `NEXT_PUBLIC_ADSENSE_CLIENT` n'est pas défini. Emplacements prévus : sous le header de l'accueil (`home-below-header`) et en bas d'article (`article-bottom`).
