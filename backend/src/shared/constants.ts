// ===== SELECTIONS PRISMA POUR OPTIMISATION =====

export const USER_SELECT_FIELDS = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  displayName: true,
  email: true,
  phoneNumber: true,
  systemLanguage: true,
  regionalLanguage: true,
  customDestinationLanguage: true,
  autoTranslateEnabled: true,
  translateToSystemLanguage: true,
  translateToRegionalLanguage: true,
  useCustomDestination: true,
  avatar: true,
  isOnline: true,
  lastSeen: true,
  role: true,
  isActive: true,
  deactivatedAt: true,
  createdAt: true,
  lastActiveAt: true,
} as const;

export const USER_SAFE_SELECT_FIELDS = {
  id: true,
  username: true,
  firstName: true,
  lastName: true,
  displayName: true,
  avatar: true,
  isOnline: true,
  lastSeen: true,
  systemLanguage: true,
  regionalLanguage: true,
  customDestinationLanguage: true,
  autoTranslateEnabled: true,
  translateToSystemLanguage: true,
  translateToRegionalLanguage: true,
  useCustomDestination: true,
  role: true,
  isActive: true,
  createdAt: true,
  lastActiveAt: true,
} as const;

export const MESSAGE_SELECT_FIELDS = {
  id: true,
  content: true,
  senderId: true,
  conversationId: true,
  originalLanguage: true,
  isEdited: true,
  editedAt: true,
  isDeleted: true,
  replyToId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const CONVERSATION_SELECT_FIELDS = {
  id: true,
  type: true,
  title: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const GROUP_SELECT_FIELDS = {
  id: true,
  conversationId: true,
  title: true,
  description: true,
  image: true,
  isPublic: true,
  maxMembers: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ===== INCLUDES COMPLEXES POUR REQUÊTES =====

export const CONVERSATION_WITH_PARTICIPANTS = {
  include: {
    participants: {
      where: { leftAt: null },
      include: {
        user: {
          select: USER_SAFE_SELECT_FIELDS,
        },
      },
    },
  },
} as const;

export const CONVERSATION_WITH_LAST_MESSAGE = {
  include: {
    messages: {
      take: 1,
      orderBy: { createdAt: 'desc' as const },
      include: {
        sender: {
          select: USER_SAFE_SELECT_FIELDS,
        },
      },
    },
  },
} as const;

export const MESSAGE_WITH_SENDER = {
  include: {
    sender: {
      select: USER_SAFE_SELECT_FIELDS,
    },
    replyTo: {
      select: {
        id: true,
        content: true,
        sender: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
    },
  },
} as const;

export const GROUP_WITH_MEMBERS = {
  include: {
    members: {
      include: {
        user: {
          select: USER_SAFE_SELECT_FIELDS,
        },
      },
    },
    createdBy: {
      select: USER_SAFE_SELECT_FIELDS,
    },
    conversation: {
      select: CONVERSATION_SELECT_FIELDS,
    },
  },
} as const;

// ===== CONSTANTES DE VALIDATION =====

export const VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
  },
  MESSAGE: {
    MAX_LENGTH: 4000,
  },
  GROUP_TITLE: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
  },
  DESCRIPTION: {
    MAX_LENGTH: 500,
  },
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
} as const;

// ===== CONSTANTES MÉTIER =====

export const BUSINESS_RULES = {
  GROUP: {
    DEFAULT_MAX_MEMBERS: 100,
    ABSOLUTE_MAX_MEMBERS: 1000,
  },
  MESSAGE: {
    EDIT_TIME_LIMIT_MINUTES: 60,
    DELETE_TIME_LIMIT_MINUTES: 60 * 24, // 24h
  },
  RATE_LIMITING: {
    MESSAGES_PER_MINUTE: 30,
    API_CALLS_PER_MINUTE: 100,
  },
} as const;
