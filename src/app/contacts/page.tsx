'use client';

import { NotFoundPage } from '@/components/not-found-page';

export default function ContactsPage() {
  return (
    <NotFoundPage
      title="Contacts"
      description="La gestion des contacts sera bientôt disponible."
      suggestions={[
        "Créer une nouvelle conversation",
        "Rejoindre un groupe existant",
        "Consulter vos paramètres"
      ]}
    />
  );
}
