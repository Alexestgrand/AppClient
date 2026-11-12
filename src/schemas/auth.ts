import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse email invalide.').max(200),
  password: z.string().min(1, 'Mot de passe obligatoire.').max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mot de passe actuel obligatoire.').max(200),
    newPassword: z.string().min(12, 'Au moins 12 caractères.').max(200),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Le nouveau mot de passe doit être différent de l'ancien.",
    path: ['newPassword'],
  });
