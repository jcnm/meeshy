// Types pour le système d'affiliation

export interface AffiliateToken {
  id: string;
  token: string;
  name: string;
  createdBy: string;
  maxUses?: number;
  currentUses: number;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  creator?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
  };
  _count?: {
    affiliations: number;
  };
}

export interface AffiliateRelation {
  id: string;
  affiliateTokenId: string;
  affiliateUserId: string;
  referredUserId: string;
  status: 'pending' | 'completed' | 'expired';
  createdAt: Date;
  completedAt?: Date;
  affiliateToken?: {
    name: string;
    token: string;
    createdAt: Date;
  };
  referredUser?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
    isOnline: boolean;
    createdAt: Date;
  };
  affiliateUser?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
  };
}

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: Date;
  updatedAt: Date;
  sender?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
    isOnline: boolean;
  };
  receiver?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
    isOnline: boolean;
  };
}

export interface AffiliateStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  expiredReferrals: number;
  referrals: AffiliateRelation[];
  tokens: AffiliateToken[];
}

export interface CreateAffiliateTokenRequest {
  name: string;
  maxUses?: number;
  expiresAt?: string;
}

export interface AffiliateTokenResponse {
  id: string;
  token: string;
  name: string;
  affiliateLink: string;
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  createdAt: string;
}

export interface AffiliateValidationResponse {
  isValid: boolean;
  token?: {
    id: string;
    name: string;
    token: string;
    maxUses?: number;
    currentUses: number;
    expiresAt?: string;
  };
  affiliateUser?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    displayName?: string;
    avatar?: string;
  };
}

export interface AffiliateVisitData {
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  country?: string;
  language?: string;
}

export interface AffiliateRegisterRequest {
  token: string;
  referredUserId: string;
  sessionKey?: string;
}

export interface AffiliateRegisterResponse {
  id: string;
  status: string;
}
