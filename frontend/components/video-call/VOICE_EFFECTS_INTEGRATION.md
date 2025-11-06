# Voice Effects Integration Guide

## Overview

This guide explains how to integrate the new voice effects system into the video call flow.

## Components

### 1. PreCallSetup Component
**Purpose**: Allow users to configure audio/video settings and test voice effects BEFORE joining the call.

**Features**:
- Video preview with live feed
- Audio level monitoring
- Device selection (camera/microphone)
- Voice effects selection with 8 different effects
- Effect intensity slider (0-100%)
- Test voice effect button (5-second preview)
- Visual feedback with emoji icons

**Usage**:
```tsx
import { PreCallSetup, type CallSettings } from '@/components/video-call/PreCallSetup';

function MyCallPage() {
  const [showSetup, setShowSetup] = useState(true);

  const handleJoinCall = (settings: CallSettings) => {
    // Settings include:
    // - audioEnabled: boolean
    // - videoEnabled: boolean
    // - voiceEffect: VoiceEffectType
    // - voiceEffectIntensity: number (0-100)
    // - audioDeviceId: string
    // - videoDeviceId: string

    // Apply settings to your call
    startCallWithSettings(settings);
    setShowSetup(false);
  };

  return (
    <>
      {showSetup && (
        <PreCallSetup
          onJoinCall={handleJoinCall}
          onCancel={() => router.back()}
        />
      )}
    </>
  );
}
```

### 2. EnhancedCallControls Component
**Purpose**: Provide in-call controls including voice effects that can be changed during the call.

**Features**:
- Standard mute/video/hangup buttons
- Voice effects button with active indicator
- Expandable effects panel
- Quick effect switching
- Real-time intensity adjustment

**Usage**:
```tsx
import { EnhancedCallControls } from '@/components/video-call/EnhancedCallControls';

function CallInterface() {
  const { audioEnabled, videoEnabled } = useCallStore();
  const { currentEffect, intensity, changeEffect } = useVoiceEffects();

  return (
    <div className="call-interface">
      {/* Video grid */}

      <EnhancedCallControls
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onHangUp={endCall}
        voiceEffect={currentEffect}
        voiceEffectIntensity={intensity}
        onVoiceEffectChange={(effect, intensity) => {
          changeEffect(effect);
          // Apply to your media stream
          applyEffectToStream(effect, intensity);
        }}
      />
    </div>
  );
}
```

### 3. VoiceEffectsProcessor Class
**Purpose**: Core audio processing using Web Audio API.

**Available Effects**:
1. **None** 🎤 - Natural voice
2. **Robot** 🤖 - Robotic modulation
3. **Deep** 🐻 - Lower pitch
4. **Chipmunk** 🐿️ - Higher pitch
5. **Echo** 🔊 - Echo/delay effect
6. **Reverb** 🎭 - Concert hall reverb
7. **Telephone** 📞 - Old phone quality
8. **Cave** 🏔️ - Large cave acoustics

**Usage**:
```tsx
import { VoiceEffectsProcessor } from '@/lib/audio/voice-effects';

const processor = new VoiceEffectsProcessor();

// Apply effect to stream
const processedStream = processor.applyEffect(originalStream, {
  type: 'robot',
  intensity: 75
});

// Use processed stream in WebRTC
peerConnection.addTrack(processedStream.getAudioTracks()[0], processedStream);

// Cleanup
processor.destroy();
```

### 4. useVoiceEffects Hook
**Purpose**: React hook for managing voice effects state.

**Features**:
- Effect and intensity state management
- Apply effects to streams
- Change effects on-the-fly
- Reset to default
- Get current effect info

**Usage**:
```tsx
import { useVoiceEffects } from '@/hooks/use-voice-effects';

function MyComponent() {
  const {
    currentEffect,
    intensity,
    isProcessing,
    applyEffect,
    changeEffect,
    changeIntensity,
    resetEffect,
    getCurrentEffectInfo,
  } = useVoiceEffects({
    initialEffect: 'none',
    initialIntensity: 50,
  });

  // Apply to stream
  const processedStream = applyEffect(localStream);

  // Change effect
  changeEffect('robot');

  // Adjust intensity
  changeIntensity(80);

  // Get info
  const effectInfo = getCurrentEffectInfo();
  console.log(effectInfo.label, effectInfo.icon);
}
```

## Integration Flow

### Complete Call Flow with Voice Effects

```tsx
'use client';

import { useState, useEffect } from 'react';
import { PreCallSetup, type CallSettings } from '@/components/video-call/PreCallSetup';
import { EnhancedCallControls } from '@/components/video-call/EnhancedCallControls';
import { useVoiceEffects } from '@/hooks/use-voice-effects';
import { useCallStore } from '@/stores/call-store';

export function VideoCallPage({ callId }: { callId: string }) {
  const [showPreCallSetup, setShowPreCallSetup] = useState(true);
  const [callSettings, setCallSettings] = useState<CallSettings | null>(null);

  const { localStream, setLocalStream, audioEnabled, videoEnabled } = useCallStore();
  const { applyEffect, changeEffect, currentEffect, intensity } = useVoiceEffects();

  // Step 1: User configures settings in PreCallSetup
  const handleJoinCall = async (settings: CallSettings) => {
    setCallSettings(settings);

    // Get media stream with selected devices
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: settings.audioEnabled ? { deviceId: settings.audioDeviceId } : false,
      video: settings.videoEnabled ? { deviceId: settings.videoDeviceId } : false,
    });

    // Apply voice effect if selected
    let finalStream = stream;
    if (settings.voiceEffect !== 'none') {
      finalStream = applyEffect(stream, settings.voiceEffect, settings.voiceEffectIntensity);
    }

    // Store in call store
    setLocalStream(finalStream);

    // Initialize WebRTC with processed stream
    await initializeWebRTC(finalStream, callId);

    // Hide setup, show call interface
    setShowPreCallSetup(false);
  };

  // Step 2: During call, user can change effects
  const handleVoiceEffectChange = (effect: VoiceEffectType, intensity: number) => {
    if (!localStream) return;

    // Apply new effect
    const processedStream = applyEffect(localStream, effect, intensity);

    // Update WebRTC tracks
    const audioTrack = processedStream.getAudioTracks()[0];
    updateWebRTCAudioTrack(audioTrack);

    changeEffect(effect);
  };

  return (
    <>
      {/* Pre-call setup */}
      {showPreCallSetup && (
        <PreCallSetup
          onJoinCall={handleJoinCall}
          onCancel={() => router.back()}
        />
      )}

      {/* In-call interface */}
      {!showPreCallSetup && (
        <div className="call-interface">
          {/* Video grid */}
          <VideoGrid />

          {/* Enhanced controls with voice effects */}
          <EnhancedCallControls
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onHangUp={endCall}
            voiceEffect={currentEffect}
            voiceEffectIntensity={intensity}
            onVoiceEffectChange={handleVoiceEffectChange}
          />
        </div>
      )}
    </>
  );
}
```

## Key Features

### Pre-Call Testing
✅ Users can test voice effects with a 5-second preview
✅ Real-time audio level monitoring
✅ Device selection before call starts
✅ Visual feedback with icons and descriptions

### During Call
✅ Change voice effects without disconnecting
✅ Adjust intensity on-the-fly
✅ Visual indicator when effect is active
✅ Smooth transitions between effects

### Performance
✅ Efficient Web Audio API usage
✅ Proper cleanup on unmount
✅ No audio glitches during effect changes
✅ Low latency processing

## Browser Compatibility

- ✅ Chrome/Edge 88+
- ✅ Firefox 85+
- ✅ Safari 14.1+
- ✅ Opera 74+

## Tips for Best Results

1. **Testing**: Always test effects before joining important calls
2. **Intensity**: Start with 50% and adjust based on preference
3. **Network**: Voice effects don't affect network bandwidth
4. **Performance**: Effects are processed locally (no server load)
5. **Fun**: Experiment with combinations during casual calls!

## Troubleshooting

### No effect applied
- Check browser compatibility
- Ensure microphone permission granted
- Try refreshing the page

### Audio distortion
- Reduce effect intensity
- Check microphone quality
- Ensure stable internet connection

### Effect won't change
- Click "Reset" and reapply
- Check console for errors
- Restart the call if needed

## Future Enhancements

- [ ] Custom effect presets
- [ ] Save favorite effects
- [ ] Background noise suppression
- [ ] Voice beautification
- [ ] Real-time voice translation effects
