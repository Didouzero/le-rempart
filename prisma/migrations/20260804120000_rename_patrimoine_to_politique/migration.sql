-- Remplace la rubrique patrimoine par politique (conserve les articles existants).
ALTER TYPE "ArticleCategory" RENAME VALUE 'patrimoine' TO 'politique';
