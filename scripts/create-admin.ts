/**
 * Crée l'unique compte administrateur, ou réinitialise son email / mot de passe
 * (les sessions existantes sont alors révoquées).
 * Usage : ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm admin:create
 */
import { authService } from '../src/services/auth.service';
import { prisma } from '../src/lib/db';

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Définissez ADMIN_EMAIL et ADMIN_PASSWORD (fichier .env ou variables d’environnement).',
  );
  process.exit(1);
}

try {
  const user = await authService.upsertAdmin(ADMIN_EMAIL.trim().toLowerCase(), ADMIN_PASSWORD);
  console.log(`✔ Compte administrateur prêt : ${user.email}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
