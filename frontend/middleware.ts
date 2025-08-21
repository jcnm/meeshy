// Middleware désactivé pour éviter les redirections d'URL avec préfixe de langue
// L'internationalisation est gérée côté client via le LanguageContext

import { NextRequest, NextResponse } from 'next/server';

export default function middleware(request: NextRequest) {
  // Pas de redirection, laisser passer toutes les requêtes
  return NextResponse.next();
}

export const config = {
  // Matcher vide pour ne pas intercepter les requêtes
  matcher: []
};
