import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { hashPassword, verifyPassword } from '@/lib/password';
import { loginRateLimiter } from '@/lib/rate-limit';
import { createSession } from '@/lib/session';
import { logger } from '@/lib/logger';

// Hash factice (calculé une fois) : la vérification prend le même temps que l'email existe ou non.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword(randomBytes(16).toString('hex')));

export const authService = {
  async login(email: string, password: string, clientKey: string) {
    const limiterKey = `${clientKey}:${email}`;
    if (await loginRateLimiter.isBlocked(limiterKey)) {
      throw new AppError('Trop de tentatives. Réessayez dans 15 minutes.', 429);
    }
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
    if (!user || !valid) {
      await loginRateLimiter.registerFailure(limiterKey);
      logger.warn('Échec de connexion', { clientKey });
      throw new AppError('Identifiants incorrects.', 401);
    }
    await loginRateLimiter.reset(limiterKey);
    return createSession(user.id);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      throw new AppError('Mot de passe actuel incorrect.', 400, {
        currentPassword: ['Mot de passe incorrect.'],
      });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });
  },

  /** Crée ou réinitialise l'unique compte administrateur. */
  async upsertAdmin(email: string, password: string) {
    if (password.length < 12)
      throw new AppError('Le mot de passe administrateur doit faire au moins 12 caractères.');
    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findFirst();
    if (existing) {
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      return prisma.user.update({ where: { id: existing.id }, data: { email, passwordHash } });
    }
    return prisma.user.create({ data: { email, passwordHash } });
  },
};
