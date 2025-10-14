/**
 * Types pour le système de tracking de liens
 */
export interface TrackingLink {
    id: string;
    token: string;
    originalUrl: string;
    shortUrl: string;
    createdBy?: string;
    conversationId?: string;
    messageId?: string;
    totalClicks: number;
    uniqueClicks: number;
    isActive: boolean;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    lastClickedAt?: Date;
}
export interface TrackingLinkClick {
    id: string;
    trackingLinkId: string;
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
    clickedAt: Date;
}
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
        clicksByCountry: {
            [country: string]: number;
        };
        clicksByDevice: {
            [device: string]: number;
        };
        clicksByBrowser: {
            [browser: string]: number;
        };
        clicksByDate: {
            [date: string]: number;
        };
        topReferrers: {
            referrer: string;
            count: number;
        }[];
    };
    error?: string;
}
export interface ParsedMessage {
    text: string;
    type: 'text' | 'link' | 'tracking-link';
    originalUrl?: string;
    trackingUrl?: string;
    token?: string;
}
export interface LinkParserOptions {
    createTrackingLinks?: boolean;
    domain?: string;
}
export declare const TRACKING_LINK_TOKEN_LENGTH = 6;
export declare const TRACKING_LINK_BASE_URL = "meeshy.me/l/";
export declare const TRACKING_LINK_REGEX: RegExp;
export declare const URL_REGEX: RegExp;
//# sourceMappingURL=tracking-link.d.ts.map