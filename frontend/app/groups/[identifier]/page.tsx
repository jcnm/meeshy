'use client';

import { GroupsLayout } from '@/components/groups/groups-layout';
import { Suspense, use } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

interface GroupPageProps {
  params: Promise<{
    identifier: string;
  }>;
}

function GroupPageContent({ params }: GroupPageProps) {
  const resolvedParams = use(params);
  return <GroupsLayout selectedGroupIdentifier={resolvedParams.identifier} />;
}

function GroupPageFallback() {
  const { t } = useTranslations('groups');
  return <div>Chargement du groupe...</div>;
}

export default function GroupPage({ params }: GroupPageProps) {
  return (
    <Suspense fallback={<GroupPageFallback />}>
      <GroupPageContent params={params} />
    </Suspense>
  );
}
