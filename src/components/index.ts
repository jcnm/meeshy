// Index principal des composants organisés par domaine

// Composants communs et UI
export * from './common';
export * from './ui';

// Layout et navigation
export * from './layout';

// Authentification
export * from './auth';

// Domaines métier
export * from './conversations';
export * from './groups';
export * from './translation';
export * from './settings';
export * from './notifications';
export * from './models';

// Composants legacy à migrer (temporaire)
export { DashboardLayout } from './dashboard-layout';
export { NotFoundPage } from './not-found-page';
export { MeeshyLogo } from './meeshy-logo';
