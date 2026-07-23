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

## AdSense

Le composant `AdSlot` n'affiche rien tant que `NEXT_PUBLIC_ADSENSE_CLIENT` n'est pas défini. Emplacements prévus : sous le header de l'accueil (`home-below-header`) et en bas d'article (`article-bottom`).
