/**
 * Types pour le système de tracking de liens
 */

// ============================================================================
// Types de base TrackingLink
// ============================================================================

export interface TrackingLink {
  id: string;
  token: string; // Token unique de 6 caractères
  originalUrl: string; // URL originale complète
  shortUrl: string; // URL courte (meeshy.me/l/<token>)
  createdBy?: string; // ID de l'utilisateur créateur (null si anonyme)
  conversationId?: string; // ID de la conversation
  messageId?: string; // ID du message contenant le lien
  totalClicks: number; // Nombre total de clics
  uniqueClicks: number; // Nombre de clics uniques
  isActive: boolean; // Le lien est-il actif
  expiresAt?: Date; // Date d'expiration
  createdAt: Date;
  updatedAt: Date;
  lastClickedAt?: Date; // Date du dernier clic
}

export interface TrackingLinkClick {
  id: string;
  trackingLinkId: string;
  userId?: string; // ID utilisateur connecté
  anonymousId?: string; // ID participant anonyme
  ipAddress?: string;
  country?: string;
  city?: string;
  region?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: string; // mobile, desktop, tablet
  language?: string;
  referrer?: string;
  deviceFingerprint?: string;
  clickedAt: Date;
}

// ============================================================================
// DTOs pour l'API
// ============================================================================

export interface CreateTrackingLinkRequest {
  originalUrl: string;
  conversationId?: string;
  messageId?: string;
  expiresAt?: Date;
}

export interface CreateTrackingLinkResponse {
  success: boolean;
  data?: {
    trackingLink: TrackingLink;
  };
  error?: string;
}

export interface GetTrackingLinkRequest {
  token: string;
}

export interface GetTrackingLinkResponse {
  success: boolean;
  data?: {
    trackingLink: TrackingLink;
    clicks?: TrackingLinkClick[];
  };
  error?: string;
}

export interface RecordClickRequest {
  token: string;
  userId?: string;
  anonymousId?: string;
  ipAddress?: string;
  country?: string;
  city?: string;
  region?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: string;
  language?: string;
  referrer?: string;
  deviceFingerprint?: string;
}

export interface RecordClickResponse {
  success: boolean;
  data?: {
    originalUrl: string;
    trackingLink: TrackingLink;
  };
  error?: string;
}

export interface TrackingLinkStatsRequest {
  token: string;
  startDate?: Date;
  endDate?: Date;
}

export interface TrackingLinkStatsResponse {
  success: boolean;
  data?: {
    trackingLink: TrackingLink;
    totalClicks: number;
    uniqueClicks: number;
    clicksByCountry: { [country: string]: number };
    clicksByDevice: { [device: string]: number };
    clicksByBrowser: { [browser: string]: number };
    clicksByDate: { [date: string]: number };
    topReferrers: { referrer: string; count: number }[];
  };
  error?: string;
}

// ============================================================================
// Utilitaires
// ============================================================================

export interface ParsedMessage {
  text: string;
  type: 'text' | 'link' | 'tracking-link';
  originalUrl?: string;
  trackingUrl?: string;
  token?: string;
}

export interface LinkParserOptions {
  createTrackingLinks?: boolean; // Créer automatiquement des liens de tracking
  domain?: string; // Domaine pour les liens courts (par défaut: meeshy.me)
}

// ============================================================================
// Constantes
// ============================================================================

export const TRACKING_LINK_TOKEN_LENGTH = 6;
export const TRACKING_LINK_BASE_URL = 'meeshy.me/l/';
export const TRACKING_LINK_REGEX = /https?:\/\/(?:www\.)?meeshy\.me\/l\/([a-zA-Z0-9]{6})/g;
export const URL_REGEX = /(https?:\/\/[^\s]+)/g;

