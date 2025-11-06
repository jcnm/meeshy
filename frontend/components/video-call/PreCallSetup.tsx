'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  PhoneCall,
  Wand2,
  Play,
  Pause,
  Volume2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { VoiceEffectsProcessor, type VoiceEffectType } from '@/lib/audio/voice-effects';
import { toast } from 'sonner';

interface PreCallSetupProps {
  onJoinCall: (settings: CallSettings) => void;
  onCancel?: () => void;
}

export interface CallSettings {
  audioEnabled: boolean;
  videoEnabled: boolean;
  voiceEffect: VoiceEffectType;
  voiceEffectIntensity: number;
  audioDeviceId?: string;
  videoDeviceId?: string;
}

export function PreCallSetup({ onJoinCall, onCancel }: PreCallSetupProps) {
  // Media state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Devices
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');

  // Voice effects
  const [voiceEffect, setVoiceEffect] = useState<VoiceEffectType>('none');
  const [effectIntensity, setEffectIntensity] = useState(50);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const voiceProcessorRef = useRef<VoiceEffectsProcessor | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Get available effects
  const availableEffects = VoiceEffectsProcessor.getAvailableEffects();

  // Initialize media devices
  useEffect(() => {
    const initializeDevices = async () => {
      try {
        // Request permissions first
        const tempStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        // Get devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const videoInputs = devices.filter(d => d.kind === 'videoinput');

        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);

        // Set defaults
        if (audioInputs.length > 0) setSelectedAudioDevice(audioInputs[0].deviceId);
        if (videoInputs.length > 0) setSelectedVideoDevice(videoInputs[0].deviceId);

        // Stop temp stream
        tempStream.getTracks().forEach(track => track.stop());

      } catch (error) {
        console.error('Failed to enumerate devices:', error);
        toast.error('Could not access camera or microphone');
      }
    };

    initializeDevices();
  }, []);

  // Initialize stream when devices change
  useEffect(() => {
    if (!selectedAudioDevice || !selectedVideoDevice) return;

    const initializeStream = async () => {
      try {
        // Stop previous stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: audioEnabled ? { deviceId: selectedAudioDevice } : false,
          video: videoEnabled ? { deviceId: selectedVideoDevice } : false,
        });

        setStream(newStream);

        // Set video element
        if (videoRef.current && videoEnabled) {
          videoRef.current.srcObject = newStream;
        }

        // Setup audio level monitoring
        if (audioEnabled) {
          setupAudioMonitoring(newStream);
        }

      } catch (error) {
        console.error('Failed to get media stream:', error);
        toast.error('Failed to access media devices');
      }
    };

    initializeStream();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedAudioDevice, selectedVideoDevice, audioEnabled, videoEnabled]);

  // Setup audio level monitoring
  const setupAudioMonitoring = useCallback((mediaStream: MediaStream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      source.connect(analyser);
      analyserRef.current = analyser;

      // Start monitoring
      const monitorAudioLevel = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average);

        animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
      };

      monitorAudioLevel();

    } catch (error) {
      console.error('Failed to setup audio monitoring:', error);
    }
  }, []);

  // Test voice effect
  const handleTestVoiceEffect = useCallback(async () => {
    if (!stream) return;

    setIsTestingVoice(!isTestingVoice);

    if (!isTestingVoice) {
      try {
        if (!voiceProcessorRef.current) {
          voiceProcessorRef.current = new VoiceEffectsProcessor();
        }

        const processedStream = voiceProcessorRef.current.applyEffect(stream, {
          type: voiceEffect,
          intensity: effectIntensity,
        });

        // Play it back to hear the effect
        const audio = new Audio();
        audio.srcObject = processedStream;
        audio.play();

        toast.success(`Testing ${voiceEffect} effect - speak now!`);

        // Auto-stop after 5 seconds
        setTimeout(() => {
          setIsTestingVoice(false);
          audio.pause();
          audio.srcObject = null;
        }, 5000);

      } catch (error) {
        console.error('Failed to test voice effect:', error);
        toast.error('Failed to test voice effect');
        setIsTestingVoice(false);
      }
    }
  }, [stream, voiceEffect, effectIntensity, isTestingVoice]);

  // Handle join call
  const handleJoinCall = useCallback(() => {
    const settings: CallSettings = {
      audioEnabled,
      videoEnabled,
      voiceEffect,
      voiceEffectIntensity: effectIntensity,
      audioDeviceId: selectedAudioDevice,
      videoDeviceId: selectedVideoDevice,
    };

    onJoinCall(settings);
  }, [
    audioEnabled,
    videoEnabled,
    voiceEffect,
    effectIntensity,
    selectedAudioDevice,
    selectedVideoDevice,
    onJoinCall,
  ]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (voiceProcessorRef.current) {
        voiceProcessorRef.current.destroy();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Call Setup
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Configure your audio and video settings before joining
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Video Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Video Preview</h3>

            <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
              {videoEnabled && stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <VideoOff className="w-16 h-16 text-gray-600" />
                </div>
              )}

              {/* Audio level indicator */}
              {audioEnabled && (
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-2 rounded-full">
                    <Volume2 className="w-4 h-4 text-white" />
                    <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all duration-100"
                        style={{ width: `${(audioLevel / 255) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Device selection */}
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-300 mb-1 block">Camera</label>
                <Select value={selectedVideoDevice} onValueChange={setSelectedVideoDevice}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDevices.map(device => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || 'Camera'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-1 block">Microphone</label>
                <Select value={selectedAudioDevice} onValueChange={setSelectedAudioDevice}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audioDevices.map(device => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || 'Microphone'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Toggle buttons */}
            <div className="flex gap-3">
              <Button
                variant={audioEnabled ? 'default' : 'destructive'}
                onClick={() => setAudioEnabled(!audioEnabled)}
                className="flex-1"
              >
                {audioEnabled ? <Mic className="w-4 h-4 mr-2" /> : <MicOff className="w-4 h-4 mr-2" />}
                {audioEnabled ? 'Mute' : 'Unmute'}
              </Button>

              <Button
                variant={videoEnabled ? 'default' : 'destructive'}
                onClick={() => setVideoEnabled(!videoEnabled)}
                className="flex-1"
              >
                {videoEnabled ? <Video className="w-4 h-4 mr-2" /> : <VideoOff className="w-4 h-4 mr-2" />}
                {videoEnabled ? 'Stop Video' : 'Start Video'}
              </Button>
            </div>
          </div>

          {/* Voice Effects */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Wand2 className="w-5 h-5" />
              Voice Effects
            </h3>

            <div className="space-y-4 bg-gray-800/50 p-4 rounded-lg">
              <div>
                <label className="text-sm text-gray-300 mb-2 block">Effect Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableEffects.map(effect => (
                    <Button
                      key={effect.value}
                      variant={voiceEffect === effect.value ? 'default' : 'outline'}
                      onClick={() => setVoiceEffect(effect.value)}
                      className={cn(
                        'justify-start text-left h-auto py-3',
                        voiceEffect === effect.value
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-gray-700 hover:bg-gray-600'
                      )}
                    >
                      <div>
                        <div className="text-lg mb-1">{effect.icon}</div>
                        <div className="font-semibold text-sm">{effect.label}</div>
                        <div className="text-xs text-gray-400">{effect.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {voiceEffect !== 'none' && (
                <div>
                  <label className="text-sm text-gray-300 mb-2 block">
                    Effect Intensity: {effectIntensity}%
                  </label>
                  <Slider
                    value={[effectIntensity]}
                    onValueChange={(values) => setEffectIntensity(values[0])}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              )}

              {voiceEffect !== 'none' && (
                <Button
                  onClick={handleTestVoiceEffect}
                  variant={isTestingVoice ? 'destructive' : 'secondary'}
                  className="w-full"
                  disabled={!audioEnabled}
                >
                  {isTestingVoice ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Stop Test
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Test Effect (5s)
                    </>
                  )}
                </Button>
              )}

              {voiceEffect !== 'none' && (
                <div className="text-xs text-gray-400 p-3 bg-blue-900/20 rounded border border-blue-800">
                  <p className="font-semibold mb-1">💡 Tip:</p>
                  <p>Speak naturally while testing to hear how your voice will sound to others. Adjust the intensity to your liking!</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-between">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="border-gray-600">
              Cancel
            </Button>
          )}

          <Button
            onClick={handleJoinCall}
            className="bg-green-600 hover:bg-green-700 text-white ml-auto"
            size="lg"
          >
            <PhoneCall className="w-5 h-5 mr-2" />
            Join Call
          </Button>
        </div>
      </div>
    </div>
  );
}
