// Exemple d'utilisation de la nouvelle structure de traductions françaises

// Méthode 1 : Importer toutes les traductions (rétrocompatible)
import allTranslations from './index';

// Méthode 2 : Importer des fichiers de traduction spécifiques
import { common, auth, dashboard } from './index';

// Méthode 3 : Importer des fichiers individuels directement
import commonTranslations from './common.json';
import authTranslations from './auth.json';

// Exemples d'utilisation :

// Utilisation de toutes les traductions (comme avant)
const welcomeMessage = allTranslations.common.loading; // "Chargement..."
const loginTitle = allTranslations.auth.login.title; // "Connexion"

// Utilisation d'imports spécifiques (plus efficace)
const saveButton = common.common.save; // "Enregistrer"
const dashboardTitle = dashboard.dashboard.title; // "Tableau de bord"

// Utilisation d'imports directs (plus efficace pour des composants spécifiques)
const errorMessage = commonTranslations.common.error; // "Erreur"
const registerButton = authTranslations.register.registerButton; // "Créer un compte"

// Exemple d'utilisation dans un composant React :
/*
import React from 'react';
import { common, auth } from '../locales/fr';

const LoginForm = () => {
  return (
    <div>
      <h1>{auth.login.title}</h1>
      <button>{common.common.save}</button>
      <button>{common.common.cancel}</button>
    </div>
  );
};
*/

// Exemple avec des imports dynamiques pour le code splitting :
/*
const loadDashboardTranslations = async () => {
  const { dashboard } = await import('../locales/fr/dashboard.json');
  return dashboard;
};
*/

export {
  allTranslations,
  common,
  auth,
  dashboard,
  commonTranslations,
  authTranslations,
};
