/**
 * Types TypeScript pour le système d'internationalisation (i18n) modulaire
 * Distinct du système de traduction des messages utilisateurs
 */

// Langues supportées pour l'interface
export type SupportedLanguage = 'en' | 'fr' | 'pt' | 'es' | 'de' | 'it' | 'zh' | 'ja' | 'ar' | 'ru';

// Modules d'i18n disponibles pour l'interface
export type I18nModule = 
  | 'common'
  | 'auth'
  | 'landing'
  | 'dashboard'
  | 'conversations'
  | 'settings'
  | 'pages'
  | 'components'
  | 'modals'
  | 'features'
  | 'legal';

// Structure des traductions d'interface communes
export interface CommonI18nMessages {
  languageNames: Record<SupportedLanguage, string>;
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    submit: string;
    confirm: string;
    yes: string;
    no: string;
    insufficientRights: string;
  };
  navigation: {
    home: string;
    dashboard: string;
    settings: string;
    profile: string;
    logout: string;
  };
  validation: {
    required: string;
    invalidEmail: string;
    invalidPhone: string;
    minLength: string;
    maxLength: string;
    passwordMismatch: string;
  };
  errors: {
    generic: string;
    network: string;
    unauthorized: string;
    forbidden: string;
    notFound: string;
    invalidCredentials: string;
    sessionExpired: string;
    validationError: string;
  };
  success: {
    saved: string;
    deleted: string;
    updated: string;
    created: string;
    welcome: string;
  };
}

// Structure des messages d'interface d'authentification
export interface AuthI18nMessages {
  auth: {
    login: {
      title: string;
      description: string;
      email: string;
      password: string;
      loginButton: string;
      forgotPassword: string;
      noAccount: string;
      registerLink: string;
    };
    register: {
      title: string;
      description: string;
      firstName: string;
      lastName: string;
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
      registerButton: string;
      hasAccount: string;
      loginLink: string;
    };
    joinConversation: {
      title: string;
      description: string;
      resumeTitle: string;
      resumeDescription: string;
      ongoingConversation: string;
      ongoingDescription: string;
      resumeButton: string;
      orJoinNew: string;
      newConversationDescription: string;
      linkPlaceholder: string;
      joinButton: string;
    };
  };
  login: {
    title: string;
    subtitle: string;
    formTitle: string;
    formDescription: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    usernameHelp: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    passwordHelp: string;
    showPassword: string;
    hidePassword: string;
    loginButton: string;
    loggingIn: string;
    verifyingAuth: string;
    redirecting: string;
    loading: string;
    validation: {
      required: string;
    };
    noAccount: string;
    registerLink: string;
    success: {
      loginSuccess: string;
    };
    errors: {
      loginFailed: string;
    };
  };
  register: {
    title: string;
    description: string;
    subtitle: string;
    formTitle: string;
    formDescription: string;
    firstNameLabel: string;
    firstNamePlaceholder: string;
    lastNameLabel: string;
    lastNamePlaceholder: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    usernameHelp: string;
    emailLabel: string;
    emailPlaceholder: string;
    emailHelp: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    passwordHelp: string;
    confirmPasswordLabel: string;
    confirmPasswordPlaceholder: string;
    confirmPasswordHelp: string;
    showPassword: string;
    hidePassword: string;
    registerButton: string;
    registering: string;
    verifyingRegistration: string;
    redirecting: string;
    loading: string;
    validation: {
      required: string;
      emailInvalid: string;
      passwordTooShort: string;
      passwordMismatch: string;
      usernameInvalid: string;
    };
    hasAccount: string;
    loginLink: string;
    success: {
      registrationSuccess: string;
    };
    errors: {
      registrationFailed: string;
      emailExists: string;
      usernameExists: string;
    };
  };
  joinConversation: {
    title: string;
    description: string;
    resumeTitle: string;
    resumeDescription: string;
    ongoingConversation: string;
    ongoingDescription: string;
    resumeButton: string;
    orJoinNew: string;
    newConversationDescription: string;
    linkPlaceholder: string;
    joinButton: string;
    loading: string;
    validating: string;
    invalidLink: string;
    expiredLink: string;
    linkError: string;
    validLink: string;
  };
}

// Interface générique pour tous les messages d'interface
export interface I18nMessages {
  [key: string]: any;
}

// Options pour le hook useI18n
export interface UseI18nOptions {
  language?: SupportedLanguage;
  modules?: I18nModule[];
  preload?: boolean;
}

// Retour du hook useI18n
export interface UseI18nReturn {
  t: (key: string, variables?: Record<string, string | number>) => string;
  isLoading: boolean;
  currentLanguage: SupportedLanguage;
  loadModule: (module: I18nModule) => Promise<void>;
  switchLanguage: (language: SupportedLanguage) => Promise<void>;
}

// Configuration du système d'internationalisation
export interface I18nConfig {
  defaultLanguage: SupportedLanguage;
  supportedLanguages: SupportedLanguage[];
  availableModules: I18nModule[];
  fallbackLanguage: SupportedLanguage;
  enableCache: boolean;
  enableLocalStorage: boolean;
  preloadEssentials: boolean;
}

// Résultat du chargement d'un module d'interface
export interface I18nModuleLoadResult {
  module: I18nModule;
  language: SupportedLanguage;
  data: I18nMessages;
  cached: boolean;
  loadTime: number;
}

// Statistiques du système d'internationalisation
export interface I18nStats {
  loadedLanguages: SupportedLanguage[];
  loadedModules: Record<SupportedLanguage, I18nModule[]>;
  cacheHits: number;
  cacheMisses: number;
  totalLoadTime: number;
  lastActivity: Date;
}

// Erreur d'internationalisation
export interface I18nError {
  type: 'MODULE_NOT_FOUND' | 'LANGUAGE_NOT_SUPPORTED' | 'NETWORK_ERROR' | 'PARSE_ERROR';
  message: string;
  module?: I18nModule;
  language?: SupportedLanguage;
  originalError?: Error;
}

// Événement de changement de langue d'interface
export interface LanguageChangeEvent {
  previousLanguage: SupportedLanguage;
  newLanguage: SupportedLanguage;
  timestamp: Date;
  source: 'USER' | 'AUTO_DETECT' | 'FALLBACK';
}

// Contexte d'internationalisation (distinct du contexte de traduction des messages)
export interface I18nContext {
  currentLanguage: SupportedLanguage;
  availableLanguages: SupportedLanguage[];
  isLoading: boolean;
  error: I18nError | null;
  stats: I18nStats;
  switchLanguage: (language: SupportedLanguage) => Promise<void>;
  loadModule: (module: I18nModule) => Promise<void>;
  clearCache: () => void;
  getModuleStatus: (module: I18nModule) => 'loaded' | 'loading' | 'error' | 'not_loaded';
}
