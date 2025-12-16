import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { LiveConfig, Message, LedgerItem } from '../types';
import { createPcmBlob, decodeBase64, decodeAudioData, exportWav, calculateRMS, generateSignature, fileToBase64 } from '../utils/audio';

interface AudioChunk {
  buffer: AudioBuffer;
  startTime: number;
  duration: number;
}

export const useLiveGemini = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentVolume, setCurrentVolume] = useState({ input: 0, output: 0 });
  
  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // Audio Processing State
  const [humFilterEnabled, setHumFilterEnabled] = useState(true);
  const [noiseThreshold, setNoiseThreshold] = useState(0.01);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Quantum Ledger State
  const [ledger, setLedger] = useState<LedgerItem[]>([]);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Processing Node Refs
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  
  // Audio Scheduling Refs
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioChunksRef = useRef<AudioChunk[]>([]);
  const isLiveRef = useRef<boolean>(true);
  const startOffsetRef = useRef<number>(0); // To track seek offset vs context time

  // Refs for current values to use inside callbacks/closures
  const humFilterEnabledRef = useRef(humFilterEnabled);
  const noiseThresholdRef = useRef(noiseThreshold);

  // Temporary buffers for transcript
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');

  // Config
  const API_KEY = process.env.API_KEY || '';

  // Sync state to refs
  useEffect(() => {
    humFilterEnabledRef.current = humFilterEnabled;
    if (filterNodeRef.current && inputContextRef.current) {
        // Toggle filter frequency or bypass
        // To bypass effectively, we can set frequency to 0 or very low, or disconnect/reconnect. 
        // Simplest for Biquad highpass is to set frequency very low when disabled.
        const targetFreq = humFilterEnabled ? 85 : 0;
        filterNodeRef.current.frequency.setTargetAtTime(targetFreq, inputContextRef.current.currentTime, 0.1);
    }
  }, [humFilterEnabled]);

  useEffect(() => {
    noiseThresholdRef.current = noiseThreshold;
  }, [noiseThreshold]);

  const cleanup = useCallback(() => {
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => {
         try { session.close(); } catch(e) { console.error("Error closing session", e); }
      });
      sessionPromiseRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (inputContextRef.current) {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    
    // Cleanup nodes
    filterNodeRef.current = null;

    // Note: We do NOT close output audioContextRef here to allow static playback to continue if needed,
    // unless we are fully resetting. For now, let's keep it alive or re-init if null.
    
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    // Do NOT clear audioChunksRef if we want to keep history for playback after disconnect.
    // However, if we start a new session, we should clear it.
    // For now, let's assume cleanup implies resetting session state.
    audioChunksRef.current = [];
    
    setIsConnected(false);
    setIsConnecting(false);
    setIsPlaying(false);
    setPlaybackTime(0);
    setTotalDuration(0);
    nextStartTimeRef.current = 0;
    isLiveRef.current = true;
    startOffsetRef.current = 0;
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      
      const outputAnalyser = outputCtx.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyserRef.current = outputAnalyser;
      outputAnalyser.connect(outputCtx.destination);
    }
    return audioContextRef.current;
  }, []);

  const calibrateBackgroundNoise = useCallback(async () => {
     if (isCalibrating || isConnected) return; // Only allow calibration when not connected
     
     setIsCalibrating(true);
     try {
       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
       const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
       const source = ctx.createMediaStreamSource(stream);
       const analyser = ctx.createAnalyser();
       analyser.fftSize = 256;
       source.connect(analyser);

       // Sample for 2 seconds
       const samples: number[] = [];
       const startTime = Date.now();
       
       await new Promise<void>(resolve => {
          const interval = setInterval(() => {
             const data = new Float32Array(analyser.fftSize);
             analyser.getFloatTimeDomainData(data);
             const rms = calculateRMS(data);
             samples.push(rms);
             
             if (Date.now() - startTime > 2000) {
                clearInterval(interval);
                resolve();
             }
          }, 50);
       });

       // Calculate max noise floor and set threshold slightly above it
       const maxNoise = Math.max(...samples);
       const newThreshold = Math.min(Math.max(0.005, maxNoise * 2.5), 0.5); // Cap at 0.5, min 0.005
       
       setNoiseThreshold(newThreshold);
       
       // Cleanup
       stream.getTracks().forEach(t => t.stop());
       ctx.close();
       
     } catch (e) {
        console.error("Calibration failed", e);
     } finally {
        setIsCalibrating(false);
     }
  }, [isCalibrating, isConnected]);

  const stopAllSources = () => {
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) { /* ignore already stopped */ }
    });
    sourcesRef.current.clear();
  };

  const playFromTime = useCallback((time: number) => {
    const ctx = ensureAudioContext();
    if (!outputAnalyserRef.current) return;

    stopAllSources();
    
    // Resume context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const startTime = ctx.currentTime;
    
    audioChunksRef.current.forEach(chunk => {
      const chunkEnd = chunk.startTime + chunk.duration;
      if (chunkEnd > time) {
        const source = ctx.createBufferSource();
        source.buffer = chunk.buffer;
        source.connect(outputAnalyserRef.current!);
        
        const offset = Math.max(0, time - chunk.startTime);
        const delay = Math.max(0, chunk.startTime - time);
        
        source.start(startTime + delay, offset);
        sourcesRef.current.add(source);
        
        source.onended = () => sourcesRef.current.delete(source);
      }
    });

    startOffsetRef.current = startTime - time;
    setIsPlaying(true);
  }, [ensureAudioContext]);

  const seek = useCallback((time: number) => {
    const ctx = ensureAudioContext();
    
    const targetTime = Math.max(0, Math.min(time, totalDuration));
    setPlaybackTime(targetTime);
    
    const isLive = Math.abs(targetTime - totalDuration) < 0.5;
    isLiveRef.current = isLive;

    playFromTime(targetTime);
  }, [totalDuration, playFromTime, ensureAudioContext]);

  const pause = useCallback(() => {
    if (audioContextRef.current?.state === 'running') {
      audioContextRef.current.suspend();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
      setIsPlaying(true);
    } else if (!isPlaying && audioContextRef.current) {
       playFromTime(playbackTime);
    }
  }, [playbackTime, isPlaying, playFromTime]);

  const playStaticAudio = useCallback(async (base64Audio: string) => {
    // Reset state for new static audio
    cleanup();
    const ctx = ensureAudioContext();

    try {
      const audioData = decodeBase64(base64Audio);
      // For static generation (e.g. from generateContent), sample rate might differ. 
      // Gemini 2.5 Flash native output is usually 24kHz.
      const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
      
      const newChunk: AudioChunk = {
        buffer: audioBuffer,
        startTime: 0,
        duration: audioBuffer.duration
      };
      
      audioChunksRef.current = [newChunk];
      setTotalDuration(audioBuffer.duration);
      isLiveRef.current = false;
      
      // Auto play
      playFromTime(0);
      
    } catch (e) {
      console.error("Error playing static audio", e);
    }
  }, [cleanup, ensureAudioContext, playFromTime]);

  const downloadAudio = useCallback(() => {
    if (audioChunksRef.current.length === 0) return;
    
    // Use the sample rate of the first chunk or default 24000
    const sampleRate = audioChunksRef.current[0].buffer.sampleRate;
    const buffers = audioChunksRef.current.map(c => c.buffer);
    const blob = exportWav(buffers, sampleRate);
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocalforge-session-${new Date().toISOString().replace(/[:.]/g, '-')}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // --- Quantum Guard Functions ---

  const protectCurrentWork = useCallback(async () => {
     if (audioChunksRef.current.length === 0) return null;
     
     const buffers = audioChunksRef.current.map(c => c.buffer);
     const signature = await generateSignature(buffers);
     const totalDuration = buffers.reduce((acc, b) => acc + b.duration, 0);

     // Check if already exists
     if (ledger.some(item => item.signature === signature)) {
        return signature;
     }

     const newItem: LedgerItem = {
        id: crypto.randomUUID(),
        signature,
        timestamp: new Date(),
        duration: totalDuration,
        name: `Work #${ledger.length + 1}`
     };

     setLedger(prev => [newItem, ...prev]);
     return signature;
  }, [ledger]);

  const verifyFile = useCallback(async (file: File): Promise<{ verified: boolean, item?: LedgerItem }> => {
     try {
        const base64 = await fileToBase64(file);
        const ctx = ensureAudioContext();
        // Decode to buffer to hash raw audio data (independent of file container metadata)
        const rawData = decodeBase64(base64);
        
        // Note: For robust verification, sample rate must match. 
        // We assume files are 24kHz if they came from this app, but real-world robust hashing is more complex.
        // This is a "simulated" Quantum Guard for the scope of this web app.
        const buffer = await decodeAudioData(rawData, ctx, 24000, 1);
        const signature = await generateSignature([buffer]);

        const item = ledger.find(l => l.signature === signature);
        return { verified: !!item, item };
     } catch (e) {
        console.error("Verification failed", e);
        return { verified: false };
     }
  }, [ensureAudioContext, ledger]);


  const connect = useCallback(async (config: LiveConfig) => {
    if (!API_KEY) {
      alert("API Key is missing in environment variables.");
      return;
    }

    // Clean up previous session if any
    cleanup();

    try {
      setIsConnecting(true);

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;
      
      // Output context
      const outputCtx = ensureAudioContext();
      await outputCtx.resume();
      setIsPlaying(true);
      isLiveRef.current = true;

      // Input Processing Graph
      // Source -> HighPassFilter (Deep Hum) -> Analyser -> ScriptProcessor -> Destination
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const source = inputCtx.createMediaStreamSource(stream);
      
      // High Pass Filter Node
      const filter = inputCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = humFilterEnabledRef.current ? 85 : 0; // 85Hz cutoff for hum
      filter.Q.value = 0.707;
      filterNodeRef.current = filter;

      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyserRef.current = inputAnalyser;

      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = scriptProcessor;

      // Connect Graph
      source.connect(filter);
      filter.connect(inputAnalyser);
      inputAnalyser.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);

      const ai = new GoogleGenAI({ apiKey: API_KEY });

      // Init session state
      audioChunksRef.current = [];
      setTotalDuration(0);
      nextStartTimeRef.current = outputCtx.currentTime;
      startOffsetRef.current = outputCtx.currentTime; 

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voiceName } },
          },
          systemInstruction: config.systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log('Gemini Live Session Opened');
            setIsConnected(true);
            setIsConnecting(false);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!sessionPromiseRef.current) return;
              
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Noise Gate Logic
              const rms = calculateRMS(inputData);
              const threshold = noiseThresholdRef.current;
              
              // If RMS is below threshold, silence the buffer
              if (rms < threshold) {
                 inputData.fill(0);
              }

              const pcmBlob = createPcmBlob(inputData);
              sessionPromiseRef.current.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Transcript Logic
            const serverContent = msg.serverContent;
            if (serverContent?.outputTranscription) {
              currentOutputTransRef.current += serverContent.outputTranscription.text;
              updateMessage('model', currentOutputTransRef.current, true);
            }
            if (serverContent?.inputTranscription) {
              currentInputTransRef.current += serverContent.inputTranscription.text;
              updateMessage('user', currentInputTransRef.current, true);
            }
            if (serverContent?.turnComplete) {
               if (currentInputTransRef.current) {
                  updateMessage('user', currentInputTransRef.current, false);
                  currentInputTransRef.current = '';
               }
               if (currentOutputTransRef.current) {
                  updateMessage('model', currentOutputTransRef.current, false);
                  currentOutputTransRef.current = '';
               }
            }

            // Audio Logic
            const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputCtx) {
              const audioData = decodeBase64(base64Audio);
              const audioBuffer = await decodeAudioData(audioData, outputCtx, 24000, 1);
              
              // 1. Add to buffer history
              const chunkStartTime = audioChunksRef.current.length > 0 
                ? audioChunksRef.current[audioChunksRef.current.length - 1].startTime + audioChunksRef.current[audioChunksRef.current.length - 1].duration
                : 0;
              
              const newChunk: AudioChunk = {
                buffer: audioBuffer,
                startTime: chunkStartTime,
                duration: audioBuffer.duration
              };
              audioChunksRef.current.push(newChunk);
              setTotalDuration(prev => prev + audioBuffer.duration);

              // 2. Play if Live
              if (isLiveRef.current) {
                  const scheduledTime = Math.max(outputCtx.currentTime, nextStartTimeRef.current);
                  nextStartTimeRef.current = scheduledTime + audioBuffer.duration;

                  const bufferSource = outputCtx.createBufferSource();
                  bufferSource.buffer = audioBuffer;
                  bufferSource.connect(outputAnalyserRef.current!);
                  
                  bufferSource.start(scheduledTime);
                  sourcesRef.current.add(bufferSource);
                  bufferSource.onended = () => sourcesRef.current.delete(bufferSource);
              }
            }

            if (serverContent?.interrupted) {
               console.log("Model interrupted");
               sourcesRef.current.forEach(s => s.stop());
               sourcesRef.current.clear();
               nextStartTimeRef.current = outputCtx.currentTime;
               
               if (currentOutputTransRef.current) {
                  updateMessage('model', currentOutputTransRef.current, false);
                  currentOutputTransRef.current = '';
               }
            }
          },
          onclose: () => {
            console.log('Session Closed');
            setIsConnected(false);
            setIsConnecting(false);
          },
          onerror: (err) => {
            console.error('Session Error', err);
            setIsConnected(false);
            setIsConnecting(false);
          }
        }
      });
      sessionPromiseRef.current = sessionPromise;

    } catch (error) {
      console.error("Failed to connect", error);
      cleanup();
    }
  }, [API_KEY, cleanup, ensureAudioContext, playFromTime]);

  const updateMessage = (role: 'user' | 'model' | 'system', text: string, isPartial: boolean) => {
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === role && lastMsg.isPartial) {
        const newMsg = { ...lastMsg, text, isPartial };
        return [...prev.slice(0, -1), newMsg];
      }
      if (!isPartial && !text.trim()) return prev;
      if ((!lastMsg || !lastMsg.isPartial) && isPartial) {
         return [...prev, { id: Date.now().toString(), role, text, timestamp: new Date(), isPartial }];
      }
      if (lastMsg && lastMsg.role === role && !isPartial) {
         const newMsg = { ...lastMsg, text, isPartial };
         return [...prev.slice(0, -1), newMsg];
      }
      return [...prev, { id: Date.now().toString(), role, text, timestamp: new Date(), isPartial }];
    });
  };

  const addMessage = (role: 'user' | 'model' | 'system', text: string) => {
     setMessages(prev => [...prev, { id: Date.now().toString(), role, text, timestamp: new Date(), isPartial: false }]);
  }
  
  const clearMessages = () => setMessages([]);

  // Animation Loop for Volume and Playback Time
  useEffect(() => {
    let animationId: number;
    const loop = () => {
      // Volume
      let inputVol = 0;
      let outputVol = 0;
      if (inputAnalyserRef.current) {
        const data = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
        inputAnalyserRef.current.getByteFrequencyData(data);
        inputVol = data.reduce((a, b) => a + b, 0) / data.length / 255;
      }
      if (outputAnalyserRef.current) {
        const data = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
        outputAnalyserRef.current.getByteFrequencyData(data);
        outputVol = data.reduce((a, b) => a + b, 0) / data.length / 255;
      }
      setCurrentVolume({ input: inputVol, output: outputVol });

      // Playback Time
      if (audioContextRef.current && isPlaying) {
        // Calculate logical time based on context time and our offset
        const rawTime = audioContextRef.current.currentTime - startOffsetRef.current;
        // Clamp for UI
        const displayTime = Math.max(0, Math.min(rawTime, totalDuration));
        setPlaybackTime(displayTime);
        
        // Auto-pause if we hit end and we are not live (and not receiving data)
        if (!isLiveRef.current && displayTime >= totalDuration && totalDuration > 0) {
           setIsPlaying(false);
        }
      }

      animationId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying, totalDuration]);

  return {
    isConnected,
    isConnecting,
    connect,
    disconnect: cleanup,
    messages,
    addMessage,
    clearMessages,
    currentVolume,
    // Playback Interface
    isPlaying,
    playbackTime,
    totalDuration,
    seek,
    pause,
    resume,
    playStaticAudio,
    downloadAudio,
    // Processing Config
    humFilterEnabled,
    setHumFilterEnabled,
    noiseThreshold,
    setNoiseThreshold,
    calibrateBackgroundNoise,
    isCalibrating,
    // Quantum Guard
    ledger,
    protectCurrentWork,
    verifyFile
  };
};