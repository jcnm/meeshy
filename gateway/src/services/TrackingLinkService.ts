import { PrismaClient } from '../../shared/prisma/client';
import { TrackingLink, TrackingLinkClick } from '../../shared/types/tracking-link';

/**
 * Service pour gérer les liens de tracking
 */
export class TrackingLinkService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Génère un token unique de 6 caractères
   */
  private generateToken(): string {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+=-_';
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return token;
  }

  /**
   * Vérifie si un token existe déjà
   */
  private async tokenExists(token: string): Promise<boolean> {
    const existing = await this.prisma.trackingLink.findUnique({
      where: { token }
    });
    return !!existing;
  }

  /**
   * Génère un token unique qui n'existe pas encore
   */
  private async generateUniqueToken(): Promise<string> {
    let token: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      token = this.generateToken();
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique token after maximum attempts');
      }
    } while (await this.tokenExists(token));

    return token;
  }

  /**
   * Crée un lien de tracking pour une URL
   */
  async createTrackingLink(params: {
    originalUrl: string;
    createdBy?: string;
    conversationId?: string;
    messageId?: string;
    expiresAt?: Date;
  }): Promise<TrackingLink> {
    const token = await this.generateUniqueToken();
    const shortUrl = `meeshy.me/l/${token}`;

    const trackingLink = await this.prisma.trackingLink.create({
      data: {
        token,
        originalUrl: params.originalUrl,
        shortUrl,
        createdBy: params.createdBy,
        conversationId: params.conversationId,
        messageId: params.messageId,
        expiresAt: params.expiresAt,
        isActive: true,
        totalClicks: 0,
        uniqueClicks: 0
      }
    });

    return trackingLink as TrackingLink;
  }

  /**
   * Récupère un lien de tracking par son token
   */
  async getTrackingLinkByToken(token: string): Promise<TrackingLink | null> {
    const trackingLink = await this.prisma.trackingLink.findUnique({
      where: { token }
    });

    return trackingLink as TrackingLink | null;
  }

  /**
   * Vérifie si un lien de tracking existe pour une URL donnée
   */
  async findExistingTrackingLink(originalUrl: string, conversationId?: string): Promise<TrackingLink | null> {
    const where: any = {
      originalUrl,
      isActive: true
    };

    if (conversationId) {
      where.conversationId = conversationId;
    }

    const trackingLink = await this.prisma.trackingLink.findFirst({
      where
    });

    return trackingLink as TrackingLink | null;
  }

  /**
   * Enregistre un clic sur un lien de tracking
   */
  async recordClick(params: {
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
  }): Promise<{ trackingLink: TrackingLink; click: TrackingLinkClick }> {
    // Vérifier que le lien existe et est actif
    const trackingLink = await this.getTrackingLinkByToken(params.token);
    
    if (!trackingLink) {
      throw new Error('Tracking link not found');
    }

    if (!trackingLink.isActive) {
      throw new Error('Tracking link is inactive');
    }

    if (trackingLink.expiresAt && new Date() > trackingLink.expiresAt) {
      throw new Error('Tracking link has expired');
    }

    // Vérifier si c'est un clic unique (basé sur IP + device fingerprint)
    const isUnique = await this.isUniqueClick(
      trackingLink.id,
      params.ipAddress,
      params.deviceFingerprint
    );

    // Enregistrer le clic
    const click = await this.prisma.trackingLinkClick.create({
      data: {
        trackingLinkId: trackingLink.id,
        userId: params.userId,
        anonymousId: params.anonymousId,
        ipAddress: params.ipAddress,
        country: params.country,
        city: params.city,
        region: params.region,
        userAgent: params.userAgent,
        browser: params.browser,
        os: params.os,
        device: params.device,
        language: params.language,
        referrer: params.referrer,
        deviceFingerprint: params.deviceFingerprint
      }
    });

    // Mettre à jour les statistiques du lien
    const updatedLink = await this.prisma.trackingLink.update({
      where: { id: trackingLink.id },
      data: {
        totalClicks: { increment: 1 },
        uniqueClicks: isUnique ? { increment: 1 } : undefined,
        lastClickedAt: new Date()
      }
    });

    return {
      trackingLink: updatedLink as TrackingLink,
      click: click as TrackingLinkClick
    };
  }

  /**
   * Vérifie si un clic est unique
   */
  private async isUniqueClick(
    trackingLinkId: string,
    ipAddress?: string,
    deviceFingerprint?: string
  ): Promise<boolean> {
    if (!ipAddress && !deviceFingerprint) {
      return false;
    }

    const where: any = {
      trackingLinkId
    };

    if (deviceFingerprint) {
      where.deviceFingerprint = deviceFingerprint;
    } else if (ipAddress) {
      where.ipAddress = ipAddress;
    }

    const existingClick = await this.prisma.trackingLinkClick.findFirst({
      where
    });

    return !existingClick;
  }

  /**
   * Récupère les statistiques d'un lien de tracking
   */
  async getTrackingLinkStats(token: string, params?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    trackingLink: TrackingLink;
    totalClicks: number;
    uniqueClicks: number;
    clicksByCountry: { [country: string]: number };
    clicksByDevice: { [device: string]: number };
    clicksByBrowser: { [browser: string]: number };
    clicksByDate: { [date: string]: number };
    topReferrers: { referrer: string; count: number }[];
  }> {
    const trackingLink = await this.getTrackingLinkByToken(token);
    
    if (!trackingLink) {
      throw new Error('Tracking link not found');
    }

    // Construire la requête de filtrage
    const where: any = {
      trackingLinkId: trackingLink.id
    };

    if (params?.startDate || params?.endDate) {
      where.clickedAt = {};
      if (params.startDate) {
        where.clickedAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.clickedAt.lte = params.endDate;
      }
    }

    // Récupérer tous les clics
    const clicks = await this.prisma.trackingLinkClick.findMany({
      where
    });

    // Calculer les statistiques
    const clicksByCountry: { [country: string]: number } = {};
    const clicksByDevice: { [device: string]: number } = {};
    const clicksByBrowser: { [browser: string]: number } = {};
    const clicksByDate: { [date: string]: number } = {};
    const referrerCounts: { [referrer: string]: number } = {};

    clicks.forEach(click => {
      // Par pays
      if (click.country) {
        clicksByCountry[click.country] = (clicksByCountry[click.country] || 0) + 1;
      }

      // Par appareil
      if (click.device) {
        clicksByDevice[click.device] = (clicksByDevice[click.device] || 0) + 1;
      }

      // Par navigateur
      if (click.browser) {
        clicksByBrowser[click.browser] = (clicksByBrowser[click.browser] || 0) + 1;
      }

      // Par date
      const dateKey = click.clickedAt.toISOString().split('T')[0];
      clicksByDate[dateKey] = (clicksByDate[dateKey] || 0) + 1;

      // Par referrer
      if (click.referrer) {
        referrerCounts[click.referrer] = (referrerCounts[click.referrer] || 0) + 1;
      }
    });

    // Top referrers
    const topReferrers = Object.entries(referrerCounts)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Compter les clics uniques
    const uniqueIps = new Set<string>();
    const uniqueFingerprints = new Set<string>();
    clicks.forEach(click => {
      if (click.ipAddress) uniqueIps.add(click.ipAddress);
      if (click.deviceFingerprint) uniqueFingerprints.add(click.deviceFingerprint);
    });

    const uniqueClicks = Math.max(uniqueIps.size, uniqueFingerprints.size);

    return {
      trackingLink: trackingLink as TrackingLink,
      totalClicks: clicks.length,
      uniqueClicks,
      clicksByCountry,
      clicksByDevice,
      clicksByBrowser,
      clicksByDate,
      topReferrers
    };
  }

  /**
   * Récupère tous les liens de tracking d'un utilisateur
   */
  async getUserTrackingLinks(userId: string): Promise<TrackingLink[]> {
    const links = await this.prisma.trackingLink.findMany({
      where: {
        createdBy: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return links as TrackingLink[];
  }

  /**
   * Récupère tous les liens de tracking d'une conversation
   */
  async getConversationTrackingLinks(conversationId: string): Promise<TrackingLink[]> {
    const links = await this.prisma.trackingLink.findMany({
      where: {
        conversationId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return links as TrackingLink[];
  }

  /**
   * Désactive un lien de tracking
   */
  async deactivateTrackingLink(token: string): Promise<TrackingLink> {
    const updatedLink = await this.prisma.trackingLink.update({
      where: { token },
      data: {
        isActive: false
      }
    });

    return updatedLink as TrackingLink;
  }

  /**
   * Supprime un lien de tracking (et ses clics associés)
   */
  async deleteTrackingLink(token: string): Promise<void> {
    const trackingLink = await this.getTrackingLinkByToken(token);
    
    if (!trackingLink) {
      throw new Error('Tracking link not found');
    }

    // Supprimer d'abord tous les clics associés
    await this.prisma.trackingLinkClick.deleteMany({
      where: {
        trackingLinkId: trackingLink.id
      }
    });

    // Puis supprimer le lien
    await this.prisma.trackingLink.delete({
      where: {
        token
      }
    });
  }

  /**
   * Traite le contenu d'un message : détecte les liens, crée des TrackingLinks, et remplace les liens par mshy://<token>
   */
  async processMessageLinks(params: {
    content: string;
    conversationId?: string;
    messageId?: string;
    createdBy?: string;
  }): Promise<{ processedContent: string; trackingLinks: TrackingLink[] }> {
    const { content, conversationId, messageId, createdBy } = params;

    // Regex pour détecter les liens HTTP(S)
    const urlRegex = /(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*))/gi;
    
    // Regex pour détecter les liens meeshy existants
    const meeshyLinkRegex = /https?:\/\/(?:www\.)?meeshy\.me\/l\/([a-zA-Z0-9+\-_=]{6})/gi;

    const trackingLinks: TrackingLink[] = [];
    let processedContent = content;

    // Trouver tous les liens dans le message
    const matches = content.match(urlRegex);
    
    if (!matches || matches.length === 0) {
      return { processedContent: content, trackingLinks: [] };
    }

    console.log(`[TrackingLinkService] Found ${matches.length} link(s) in message`);

    // Traiter chaque lien
    for (const url of matches) {
      // Ignorer les liens meeshy existants
      if (meeshyLinkRegex.test(url)) {
        console.log(`[TrackingLinkService] Skipping existing Meeshy link: ${url}`);
        continue;
      }

      try {
        // Vérifier si un lien existe déjà pour cette URL dans cette conversation
        let trackingLink = await this.findExistingTrackingLink(url, conversationId);

        if (!trackingLink) {
          // Créer un nouveau lien de tracking
          console.log(`[TrackingLinkService] Creating tracking link for: ${url}`);
          trackingLink = await this.createTrackingLink({
            originalUrl: url,
            conversationId,
            messageId, // Note: messageId n'est pas encore disponible, sera null
            createdBy
          });
        } else {
          console.log(`[TrackingLinkService] Reusing existing tracking link: ${trackingLink.token}`);
        }

        trackingLinks.push(trackingLink);

        // Remplacer le lien par mshy://<token>
        const replacement = `mshy://${trackingLink.token}`;
        processedContent = processedContent.replace(url, replacement);

        console.log(`[TrackingLinkService] Replaced ${url} with ${replacement}`);
      } catch (error) {
        console.error(`[TrackingLinkService] Error processing link ${url}:`, error);
        // En cas d'erreur, on garde le lien original
      }
    }

    console.log(`[TrackingLinkService] Message processed: ${trackingLinks.length} tracking link(s) created/reused`);

    return { processedContent, trackingLinks };
  }

  /**
   * Met à jour le messageId d'un ou plusieurs TrackingLinks après création du message
   */
  async updateTrackingLinksMessageId(tokens: string[], messageId: string): Promise<void> {
    if (!tokens || tokens.length === 0) return;

    await this.prisma.trackingLink.updateMany({
      where: {
        token: { in: tokens }
      },
      data: {
        messageId
      }
    });

    console.log(`[TrackingLinkService] Updated messageId for ${tokens.length} tracking link(s)`);
  }
}

