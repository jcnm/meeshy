'use client';

import { NotFoundPage } from '@/components/not-found-page';

export default function LinksPage() {
  return (
    <NotFoundPage
      title="Liens d'invitation"
      description="La gestion des liens d'invitation sera bientôt disponible."
      suggestions={[
        "Créer une conversation et l'partager",
        "Inviter des membres dans un groupe",
        "Consulter vos groupes existants"
      ]}
    />
  );
}
