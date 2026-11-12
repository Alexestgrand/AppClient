import { existsSync } from 'node:fs';

// Charge .env si présent (sans écraser les variables déjà définies, ex. en CI).
if (existsSync('.env')) process.loadEnvFile('.env');
// Les tests d'intégration utilisent TEST_DATABASE_URL, jamais la base de développement.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
