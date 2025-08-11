'use client';

import { useState } from 'react';
import { BubbleMessage } from '@/components/common/bubble-message';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, Languages } from 'lucide-react';

// Données de test pour démontrer les traductions
const mockUser = {
  id: '1',
  username: 'demo_user',
  firstName: 'Demo',
  lastName: 'User',
  email: 'demo@example.com',
  phoneNumber: '+1234567890',
  displayName: 'Demo User',
  avatar: undefined,
  role: 'USER',
  isOnline: true,
  lastSeen: new Date(),
  lastActiveAt: new Date(),
  systemLanguage: 'fr',
  regionalLanguage: 'en',
  customDestinationLanguage: 'es',
  autoTranslateEnabled: true,
  translateToSystemLanguage: true,
  translateToRegionalLanguage: false,
  useCustomDestination: false,
  isActive: true,
  deactivatedAt: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
  permissions: {
    canAccessAdmin: false,
    canManageUsers: false,
    canManageGroups: false,
    canManageConversations: false,
    canViewAnalytics: false,
    canModerateContent: false,
    canViewAuditLogs: false,
    canManageNotifications: false,
    canManageTranslations: false
  }
};

const mockMessage = {
  id: '1',
  content: 'Hello, how are you today?',
  originalContent: 'Hello, how are you today?',
  originalLanguage: 'en',
  senderId: '2',
  conversationId: '1',
  messageType: 'text',
  isEdited: false,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  sender: {
    id: '2',
    username: 'john_doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phoneNumber: '+1234567890',
    displayName: 'John Doe',
    avatar: undefined,
    role: 'USER',
    isOnline: true,
    lastSeen: new Date(),
    lastActiveAt: new Date(),
    systemLanguage: 'en',
    regionalLanguage: 'en',
    customDestinationLanguage: undefined,
    autoTranslateEnabled: true,
    translateToSystemLanguage: true,
    translateToRegionalLanguage: false,
    useCustomDestination: false,
    isActive: true,
    deactivatedAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  translations: [
    {
      language: 'fr',
      content: 'Bonjour, comment allez-vous aujourd\'hui ?',
      status: 'completed' as const,
      confidence: 0.95,
      timestamp: new Date()
    },
    {
      language: 'es',
      content: 'Hola, ¿cómo estás hoy?',
      status: 'completed' as const,
      confidence: 0.92,
      timestamp: new Date()
    },
    {
      language: 'de',
      content: 'Hallo, wie geht es dir heute?',
      status: 'completed' as const,
      confidence: 0.88,
      timestamp: new Date()
    },
    {
      language: 'it',
      content: 'Ciao, come stai oggi?',
      status: 'translating' as const,
      confidence: 0,
      timestamp: new Date()
    }
  ]
};

export function TranslationDemo() {
  const [usedLanguages] = useState(['fr', 'en']);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <span>Démonstration - Icône Globe et Traductions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              <Globe className="h-3 w-3 mr-1" />
              Cliquez sur l'icône globe pour voir les traductions
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700">
              <Languages className="h-3 w-3 mr-1" />
              Icône Languages pour forcer de nouvelles traductions
            </Badge>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Message de test :</h3>
            <p className="text-sm text-gray-600">
              Ce message a 3 traductions complètes (FR, ES, DE) et 1 en cours (IT).
              L'icône globe affichera un badge "3" et ouvrira la liste des traductions.
            </p>
          </div>
        </CardContent>
      </Card>

      <BubbleMessage
        message={mockMessage}
        currentUser={mockUser}
        userLanguage="fr"
        usedLanguages={usedLanguages}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fonctionnalités testées :</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Badge avec nombre de traductions sur l'icône globe</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Animation pulse sur l'icône quand il y a des traductions</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Popover avec liste des traductions disponibles</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Barre de progression pour la qualité des traductions</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Indicateur de traductions en cours</span>
            </li>
            <li className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Changement de langue en cliquant sur une traduction</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
