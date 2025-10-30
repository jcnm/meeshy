/**
 * VIDEO CALLS - Types TypeScript Partagés
 * @package @meeshy/shared
 *
 * Types partagés entre frontend, gateway et translator
 * pour la feature d'appels vidéo avec traduction automatique
 */

// ===== CALL MODES & STATUS =====

/**
 * Mode d'appel: P2P (2 participants) ou SFU (3+ participants)
 */
export type CallMode = 'p2p' | 'sfu';

/**
 * Statut du call
 */
export type CallStatus = 'initiated' | 'ringing' | 'active' | 'ended';

/**
 * Rôle du participant
 */
export type ParticipantRole = 'initiator' | 'participant';

/**
 * Source de transcription
 */
export type TranscriptionSource = 'client' | 'server';

// ===== CALL SESSION =====

/**
 * Session d'appel vidéo/audio
 * Aligné avec le modèle Prisma CallSession
 */
export interface CallSession {
  readonly id: string;                    // MongoDB ObjectId
  readonly conversationId: string;
  readonly mode: CallMode;
  readonly status: CallStatus;
  readonly initiatorId: string;
  readonly startedAt: Date;
  readonly answeredAt?: Date;
  readonly endedAt?: Date;
  readonly duration?: number;             // Secondes
  readonly participants: CallParticipant[];
  readonly metadata?: CallMetadata;
}

/**
 * Métadonnées optionnelles d'un appel
 */
export interface CallMetadata {
  readonly maxParticipants?: number;
  readonly recordingEnabled?: boolean;
  readonly screenShareEnabled?: boolean;
  readonly transcriptionEnabled?: boolean;
  readonly translationEnabled?: boolean;
}

// ===== CALL PARTICIPANT =====

/**
 * Participant dans un appel
 * Aligné avec le modèle Prisma CallParticipant
 */
export interface CallParticipant {
  readonly id: string;
  readonly callSessionId: string;
  readonly userId?: string;               // null pour anonymes
  readonly anonymousId?: string;
  readonly role: ParticipantRole;
  readonly joinedAt: Date;
  readonly leftAt?: Date;
  readonly isAudioEnabled: boolean;
  readonly isVideoEnabled: boolean;
  readonly connectionQuality?: ConnectionQuality;

  // Champs populés (non dans Prisma)
  readonly username?: string;
  readonly displayName?: string;
  readonly avatar?: string;
}

/**
 * Qualité de connexion WebRTC
 */
export interface ConnectionQuality {
  readonly latency: number;               // ms
  readonly packetLoss: number;            // 0-1 (percentage)
  readonly bandwidth: number;             // kbps
  readonly jitter?: number;               // ms
}

// ===== CALL CONTROLS =====

/**
 * État des contrôles média
 */
export interface CallControls {
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareEnabled: boolean;
}

// ===== WEBRTC SIGNALING =====

/**
 * Signal WebRTC (SDP ou ICE candidate)
 */
export interface WebRTCSignal {
  readonly type: 'offer' | 'answer' | 'ice-candidate';
  readonly from: string;                  // userId ou anonymousId
  readonly to: string;                    // userId ou anonymousId
  readonly signal: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

// ===== TRANSCRIPTION (Phase 2A/2B) =====

/**
 * Transcription d'audio en texte
 * Aligné avec le modèle Prisma Transcription
 */
export interface Transcription {
  readonly id: string;
  readonly callSessionId: string;
  readonly participantId: string;
  readonly source: TranscriptionSource;
  readonly text: string;
  readonly language: string;
  readonly confidence?: number;           // 0-1
  readonly timestamp: Date;
  readonly offsetMs?: number;             // Offset depuis début appel
}

// ===== TRANSLATION (Phase 3) =====

/**
 * Traduction d'une transcription
 * Aligné avec le modèle Prisma Translation
 */
export interface Translation {
  readonly id: string;
  readonly transcriptionId: string;
  readonly targetLanguage: string;
  readonly translatedText: string;
  readonly confidence?: number;           // 0-1
  readonly model?: string;                // ex: "gpt-4", "google-translate"
  readonly cached: boolean;
  readonly createdAt: Date;
}

// ===== API REQUEST/RESPONSE TYPES =====

/**
 * Requête pour initier un appel
 */
export interface InitiateCallRequest {
  readonly conversationId: string;
  readonly type: 'video' | 'audio';
  readonly settings?: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
    screenShareEnabled?: boolean;
  };
}

/**
 * Réponse d'initiation d'appel
 */
export interface InitiateCallResponse {
  readonly success: boolean;
  readonly data: CallSession;
}

/**
 * Requête pour rejoindre un appel
 */
export interface JoinCallRequest {
  readonly callId: string;
  readonly settings?: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
  };
}

/**
 * Réponse de join call
 */
export interface JoinCallResponse {
  readonly success: boolean;
  readonly data: {
    callSession: CallSession;
    iceServers: RTCIceServer[];
  };
}

// ===== SOCKET.IO EVENTS =====

/**
 * Event: call:initiate (Client → Server)
 */
export interface CallInitiateEvent {
  readonly conversationId: string;
  readonly type: 'video' | 'audio';
  readonly settings?: CallMetadata;
}

/**
 * Event: call:initiated (Server → Client)
 */
export interface CallInitiatedEvent {
  readonly callId: string;
  readonly conversationId: string;
  readonly mode: CallMode;
  readonly initiator: {
    userId: string;
    username: string;
    avatar?: string;
  };
  readonly participants: CallParticipant[];
}

/**
 * Event: call:join (Client → Server)
 */
export interface CallJoinEvent {
  readonly callId: string;
  readonly settings?: {
    audioEnabled?: boolean;
    videoEnabled?: boolean;
  };
}

/**
 * Event: call:participant-joined (Server → Client)
 */
export interface CallParticipantJoinedEvent {
  readonly callId: string;
  readonly participant: CallParticipant;
  readonly mode: CallMode;              // Peut changer (P2P→SFU)
  readonly iceServers?: RTCIceServer[]; // Pour le nouveau participant
}

/**
 * Event: call:participant-left (Server → Client)
 */
export interface CallParticipantLeftEvent {
  readonly callId: string;
  readonly participantId: string;
  readonly mode: CallMode;              // Peut changer (SFU→P2P)
}

/**
 * Event: call:signal (Client ↔ Server)
 */
export interface CallSignalEvent {
  readonly callId: string;
  readonly signal: WebRTCSignal;
}

/**
 * Event: call:ended (Server → Client)
 */
export interface CallEndedEvent {
  readonly callId: string;
  readonly duration: number;
  readonly endedBy: string;             // userId ou anonymousId
}

/**
 * Event: call:mode-changed (Server → Client)
 */
export interface CallModeChangedEvent {
  readonly callId: string;
  readonly oldMode: CallMode;
  readonly newMode: CallMode;
  readonly reason: string;
}

/**
 * Event: call:media-toggled (Server → Client)
 */
export interface CallMediaToggleEvent {
  readonly callId: string;
  readonly participantId: string;
  readonly mediaType: 'audio' | 'video';
  readonly enabled: boolean;
}

/**
 * Event: call:transcription (Client/Server → Server/Client)
 */
export interface CallTranscriptionEvent {
  readonly callId: string;
  readonly transcription: Transcription;
}

/**
 * Event: call:translation (Server → Client)
 */
export interface CallTranslationEvent {
  readonly callId: string;
  readonly translation: Translation;
}

// ===== FRONTEND STATE (pour Zustand store) =====

/**
 * État complet du call store (frontend)
 */
export interface CallState {
  // Current call
  currentCall: CallSession | null;

  // WebRTC connections
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;

  // Peer connections (P2P mode)
  peerConnections: Map<string, RTCPeerConnection>;

  // SFU state (Phase 1B)
  sfuDevice: any | null;                // mediasoup-client Device
  sfuTransport: any | null;             // mediasoup Transport

  // UI state
  controls: CallControls;
  isConnecting: boolean;
  isInCall: boolean;
  error: string | null;

  // Transcription state (Phase 2A/2B)
  transcriptions: Transcription[];
  isTranscribing: boolean;

  // Translation state (Phase 3)
  translations: Map<string, Translation[]>;  // transcriptionId → translations
}

// ===== SOCKET.IO EVENT NAMES =====

/**
 * Noms des événements Socket.IO pour les appels
 */
export const CALL_EVENTS = {
  // Client → Server
  INITIATE: 'call:initiate',
  JOIN: 'call:join',
  LEAVE: 'call:leave',
  SIGNAL: 'call:signal',
  TOGGLE_AUDIO: 'call:toggle-audio',
  TOGGLE_VIDEO: 'call:toggle-video',
  TOGGLE_SCREEN_SHARE: 'call:toggle-screen-share',

  // Server → Client
  INITIATED: 'call:initiated',
  PARTICIPANT_JOINED: 'call:participant-joined',
  PARTICIPANT_LEFT: 'call:participant-left',
  SIGNAL_RECEIVED: 'call:signal',
  MODE_CHANGED: 'call:mode-changed',
  MEDIA_TOGGLED: 'call:media-toggled',
  ENDED: 'call:ended',
  ERROR: 'call:error',

  // Transcription & Translation (Phase 2/3)
  TRANSCRIPTION: 'call:transcription',
  TRANSLATION: 'call:translation',
} as const;

export type CallEventName = typeof CALL_EVENTS[keyof typeof CALL_EVENTS];

// ===== ERROR TYPES =====

/**
 * Erreur d'appel vidéo
 */
export interface CallError {
  readonly code: CallErrorCode;
  readonly message: string;
  readonly details?: any;
}

/**
 * Codes d'erreur pour les appels vidéo
 */
export const CALL_ERROR_CODES = {
  // Authentication errors
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',

  // Connection errors
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  PEER_CONNECTION_FAILED: 'PEER_CONNECTION_FAILED',
  ICE_CONNECTION_FAILED: 'ICE_CONNECTION_FAILED',
  SIGNAL_FAILED: 'SIGNAL_FAILED',

  // Permission errors
  MEDIA_PERMISSION_DENIED: 'MEDIA_PERMISSION_DENIED',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  NOT_A_PARTICIPANT: 'NOT_A_PARTICIPANT',

  // Call state errors
  CALL_NOT_FOUND: 'CALL_NOT_FOUND',
  CALL_ALREADY_ACTIVE: 'CALL_ALREADY_ACTIVE',
  CALL_ENDED: 'CALL_ENDED',
  MAX_PARTICIPANTS_REACHED: 'MAX_PARTICIPANTS_REACHED',

  // Media control errors
  MEDIA_TOGGLE_FAILED: 'MEDIA_TOGGLE_FAILED',

  // Feature errors
  VIDEO_CALLS_NOT_SUPPORTED: 'VIDEO_CALLS_NOT_SUPPORTED',  // PUBLIC/GLOBAL conversations
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',

  // Security errors (CVE fixes)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_SIGNAL: 'INVALID_SIGNAL',
  SIGNAL_SENDER_MISMATCH: 'SIGNAL_SENDER_MISMATCH',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export type CallErrorCode = typeof CALL_ERROR_CODES[keyof typeof CALL_ERROR_CODES];

// ===== TYPE GUARDS =====

/**
 * Vérifie si un CallSession est actif
 */
export function isActiveCall(call: CallSession): boolean {
  return call.status === 'active' || call.status === 'ringing';
}

/**
 * Vérifie si un appel est en mode P2P
 */
export function isP2PCall(call: CallSession): boolean {
  return call.mode === 'p2p';
}

/**
 * Vérifie si un appel est en mode SFU
 */
export function isSFUCall(call: CallSession): boolean {
  return call.mode === 'sfu';
}

/**
 * Détermine le mode d'appel basé sur le nombre de participants
 */
export function determineCallMode(participantCount: number): CallMode {
  return participantCount <= 2 ? 'p2p' : 'sfu';
}
