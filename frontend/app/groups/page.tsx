'use client';

import { GroupsLayout } from '@/components/groups/groups-layout';
import { Suspense } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

function GroupsPageContent() {
  return <GroupsLayout />;
}

function GroupsPageFallback() {
  const { t } = useTranslations('groups');
  return <div>Chargement des groupes...</div>;
}

export default function GroupsPage() {
  return (
    <Suspense fallback={<GroupsPageFallback />}>
      <GroupsPageContent />
    </Suspense>
  );
}
