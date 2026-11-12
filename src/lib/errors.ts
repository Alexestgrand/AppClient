/** Erreurs métier : le message est destiné à l'utilisateur (aucune information sensible). */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(entity = 'Élément') {
    super(`${entity} introuvable.`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
