import { useEffect } from 'react';

/** Ouvre le formulaire de création quand la page est appelée via « Ajout rapide » (?new=1). */
export function useOpenOnNew(open: () => void): void {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('new') !== '1') return;
    open();
    url.searchParams.delete('new');
    window.history.replaceState(null, '', url.pathname + url.search);
    // Exécuté une seule fois au montage.
  }, []);
}
