/**
 * VIDEO CALLS FEATURE - Zustand Store
 * Phase 1A: P2P Video Calls MVP
 *
 * Manages call state, WebRTC connections, and media streams
 */

import { create } from 'zustand';
import type {
  CallSession,
  CallState,
  CallControls,
  CallParticipant,
  CallMode,
  Transcription,
  Translation,
} from '@shared/types/video-call';

interface CallStore extends CallState {
  // ===== ACTIONS =====

  // Call lifecycle
  setCurrentCall: (call: CallSession | null) => void;
  updateCallMode: (mode: CallMode) => void;
  addParticipant: (participant: CallParticipant) => void;
  removeParticipant: (participantId: string) => void;

  // Media streams
  setLocalStream: (stream: MediaStream | null) => void;
  addRemoteStream: (participantId: string, stream: MediaStream) => void;
  removeRemoteStream: (participantId: string) => void;
  clearRemoteStreams: () => void;

  // Peer connections (P2P)
  addPeerConnection: (participantId: string, pc: RTCPeerConnection) => void;
  removePeerConnection: (participantId: string) => void;
  clearPeerConnections: () => void;

  // SFU state (Phase 1B)
  setSfuDevice: (device: any) => void;
  setSfuTransport: (transport: any) => void;

  // Controls
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  setControls: (controls: Partial<CallControls>) => void;

  // UI state
  setConnecting: (isConnecting: boolean) => void;
  setInCall: (isInCall: boolean) => void;
  setError: (error: string | null) => void;

  // Transcription (Phase 2A/2B)
  addTranscription: (transcription: Transcription) => void;
  setTranscribing: (isTranscribing: boolean) => void;

  // Translation (Phase 3)
  addTranslation: (transcriptionId: string, translation: Translation) => void;

  // Reset
  reset: () => void;
}

const initialState: CallState = {
  currentCall: null,
  localStream: null,
  remoteStreams: new Map(),
  peerConnections: new Map(),
  sfuDevice: null,
  sfuTransport: null,
  controls: {
    audioEnabled: true,
    videoEnabled: true,
    screenShareEnabled: false,
  },
  isConnecting: false,
  isInCall: false,
  error: null,
  transcriptions: [],
  isTranscribing: false,
  translations: new Map(),
};

export const useCallStore = create<CallStore>((set, get) => ({
  ...initialState,

  // ===== CALL LIFECYCLE =====

  setCurrentCall: (call) => set({ currentCall: call }),

  updateCallMode: (mode) =>
    set((state) => ({
      currentCall: state.currentCall
        ? { ...state.currentCall, mode }
        : null,
    })),

  addParticipant: (participant) =>
    set((state) => ({
      currentCall: state.currentCall
        ? {
            ...state.currentCall,
            participants: [...state.currentCall.participants, participant],
          }
        : null,
    })),

  removeParticipant: (participantId) =>
    set((state) => ({
      currentCall: state.currentCall
        ? {
            ...state.currentCall,
            participants: state.currentCall.participants.filter(
              (p) => p.id !== participantId
            ),
          }
        : null,
    })),

  // ===== MEDIA STREAMS =====

  setLocalStream: (stream) => {
    const currentStream = get().localStream;
    if (currentStream && currentStream !== stream) {
      // Stop all tracks of the old stream
      currentStream.getTracks().forEach((track) => track.stop());
    }
    set({ localStream: stream });
  },

  addRemoteStream: (participantId, stream) =>
    set((state) => {
      const newRemoteStreams = new Map(state.remoteStreams);
      newRemoteStreams.set(participantId, stream);
      return { remoteStreams: newRemoteStreams };
    }),

  removeRemoteStream: (participantId) =>
    set((state) => {
      const newRemoteStreams = new Map(state.remoteStreams);
      const stream = newRemoteStreams.get(participantId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      newRemoteStreams.delete(participantId);
      return { remoteStreams: newRemoteStreams };
    }),

  clearRemoteStreams: () =>
    set((state) => {
      state.remoteStreams.forEach((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });
      return { remoteStreams: new Map() };
    }),

  // ===== PEER CONNECTIONS =====

  addPeerConnection: (participantId, pc) =>
    set((state) => {
      const newPeerConnections = new Map(state.peerConnections);
      newPeerConnections.set(participantId, pc);
      return { peerConnections: newPeerConnections };
    }),

  removePeerConnection: (participantId) =>
    set((state) => {
      const newPeerConnections = new Map(state.peerConnections);
      const pc = newPeerConnections.get(participantId);
      if (pc) {
        pc.close();
      }
      newPeerConnections.delete(participantId);
      return { peerConnections: newPeerConnections };
    }),

  clearPeerConnections: () =>
    set((state) => {
      state.peerConnections.forEach((pc) => {
        pc.close();
      });
      return { peerConnections: new Map() };
    }),

  // ===== SFU STATE =====

  setSfuDevice: (device) => set({ sfuDevice: device }),

  setSfuTransport: (transport) => set({ sfuTransport: transport }),

  // ===== CONTROLS =====

  toggleAudio: () =>
    set((state) => {
      const newControls = {
        ...state.controls,
        audioEnabled: !state.controls.audioEnabled,
      };

      // Update local stream audio track
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => {
          track.enabled = newControls.audioEnabled;
        });
      }

      return { controls: newControls };
    }),

  toggleVideo: () =>
    set((state) => {
      const newControls = {
        ...state.controls,
        videoEnabled: !state.controls.videoEnabled,
      };

      // Update local stream video track
      if (state.localStream) {
        state.localStream.getVideoTracks().forEach((track) => {
          track.enabled = newControls.videoEnabled;
        });
      }

      return { controls: newControls };
    }),

  toggleScreenShare: () =>
    set((state) => ({
      controls: {
        ...state.controls,
        screenShareEnabled: !state.controls.screenShareEnabled,
      },
    })),

  setControls: (controls) =>
    set((state) => ({
      controls: { ...state.controls, ...controls },
    })),

  // ===== UI STATE =====

  setConnecting: (isConnecting) => set({ isConnecting }),

  setInCall: (isInCall) => set({ isInCall }),

  setError: (error) => set({ error }),

  // ===== TRANSCRIPTION =====

  addTranscription: (transcription) =>
    set((state) => ({
      transcriptions: [...state.transcriptions, transcription],
    })),

  setTranscribing: (isTranscribing) => set({ isTranscribing }),

  // ===== TRANSLATION =====

  addTranslation: (transcriptionId, translation) =>
    set((state) => {
      const newTranslations = new Map(state.translations);
      const existing = newTranslations.get(transcriptionId) || [];
      newTranslations.set(transcriptionId, [...existing, translation]);
      return { translations: newTranslations };
    }),

  // ===== RESET =====

  reset: () => {
    const state = get();

    // Stop local stream
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => track.stop());
    }

    // Stop remote streams
    state.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });

    // Close peer connections
    state.peerConnections.forEach((pc) => {
      pc.close();
    });

    // Reset to initial state
    set(initialState);
  },
}));

// ===== SELECTORS =====

// Get active participants count
export const selectActiveParticipantsCount = (state: CallStore) =>
  state.currentCall?.participants.length || 0;

// Get current call mode
export const selectCallMode = (state: CallStore) =>
  state.currentCall?.mode || 'p2p';

// Check if user is in call
export const selectIsInCall = (state: CallStore) =>
  state.isInCall && state.currentCall !== null;

// Get remote streams as array
export const selectRemoteStreamsArray = (state: CallStore) =>
  Array.from(state.remoteStreams.entries()).map(([participantId, stream]) => ({
    participantId,
    stream,
  }));

// Get current participant (by userId)
export const selectCurrentParticipant = (state: CallStore, userId: string) =>
  state.currentCall?.participants.find((p) => p.userId === userId);
