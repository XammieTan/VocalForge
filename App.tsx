import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { useLiveGemini } from './hooks/useLiveGemini';
import Visualizer from './components/Visualizer';
import Transcript from './components/Transcript';
import AudioControls from './components/AudioControls';
import { VoiceName, LedgerItem, AuxServerStatus } from './types';
import { fileToBase64, formatAudioTime } from './utils/audio';

// Icons
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 1.5a3 3 0 013 3v4.5a3 3 0 01-6 0v-4.5a3 3 0 01-6 0v-4.5a3 3 0 013-3z" /></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>;
const AdjustIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" /></svg>;
const WaveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>;
const ShieldCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>;
const LockClosedIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>;
const GlobeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" /></svg>;
const BoltIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>;
const DocumentCheckIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.25v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12" /></svg>;
const CloudIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" /></svg>;
const CodeBracketIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>;
const ServerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h9.75a3.375 3.375 0 012.7 1.35l3.337 6.45a4.5 4.5 0 01.9 2.7" /></svg>;
const BookOpenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>;

const DEFAULT_INSTRUCTION = "You are a helpful and articulate conversation partner. Your goal is to help me refine my speech and ideas. Be concise but warm.";

const DEFENSE_LOGS = [
  "ANALYZING SPECTRAL SIGNATURE...",
  "MATCH DETECTED: UNAUTHORIZED DUPLICATE FOUND.",
  "INITIATING ACTIVE DEFENSE PROTOCOL ALPHA...",
  "DEPLOYING SMARTWARE CORRUPTION AGENT...",
  "RADIOWARE TRACKER: ENABLED.",
  "TROJAN BOT [v9.0]: INJECTED.",
  "SCANNING PRIVATE HIDDEN LOCATION...",
  "GEOLOCATION LOCKED: [34.0522° N, 118.2437° W].",
  "CONNECTING TO MISSISSIPPI INTEL NODE...",
  "UPLOADING FORENSIC DATA TO INTERPOL DATABASE...",
  "NOTIFYING C.I.A. CYBER DIVISION...",
  "TARGET FILE STATUS: CORRUPTED.",
  "RETRIEVER SYSTEM: MISSION COMPLETE."
];

const App: React.FC = () => {
  const { 
    isConnected, 
    isConnecting, 
    connect, 
    disconnect, 
    messages, 
    addMessage,
    clearMessages,
    currentVolume,
    isPlaying,
    playbackTime,
    totalDuration,
    seek,
    pause,
    resume,
    playStaticAudio,
    downloadAudio,
    // Processing
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
  } = useLiveGemini();
  
  const [activeTab, setActiveTab] = useState<'live' | 'upload' | 'guard' | 'phantom'>('live');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Zephyr');
  const [systemInstruction, setSystemInstruction] = useState(DEFAULT_INSTRUCTION);
  
  // Permissions State
  const [isCoverSanctioned, setIsCoverSanctioned] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verification & Defense State
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ verified: boolean, item?: LedgerItem } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDefenseActive, setIsDefenseActive] = useState(false);
  const [defenseLog, setDefenseLog] = useState<string[]>([]);
  const verifyInputRef = useRef<HTMLInputElement>(null);
  const defenseLogEndRef = useRef<HTMLDivElement>(null);

  // Phantom Cloud State
  const [modCode, setModCode] = useState('');
  const [auxServerStatus, setAuxServerStatus] = useState<AuxServerStatus>('offline');
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [criticalStrikeCount, setCriticalStrikeCount] = useState(0);

  // Defense Log Animation
  useEffect(() => {
    if (isDefenseActive) {
      setDefenseLog([]);
      let step = 0;
      const interval = setInterval(() => {
        if (step < DEFENSE_LOGS.length) {
          setDefenseLog(prev => [...prev, DEFENSE_LOGS[step]]);
          step++;
        } else {
          clearInterval(interval);
        }
      }, 800); // 800ms per step for dramatic effect
      return () => clearInterval(interval);
    }
  }, [isDefenseActive]);

  // Lockout Timer for Phantom Cloud
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer(prev => {
          if (prev <= 1) return 0;
          return prev - 1;
        });
      }, 1000);
    } else if (auxServerStatus === 'locked' && lockoutTimer === 0) {
        setAuxServerStatus('offline'); // Reset to offline when timer ends
    }
    return () => clearInterval(interval);
  }, [lockoutTimer, auxServerStatus]);

  // Persistent Strike Check
  useEffect(() => {
      if (criticalStrikeCount >= 3) {
          // Trigger Full Quantum Guard Protocol
          setActiveTab('guard');
          setIsDefenseActive(true);
          setCriticalStrikeCount(0); // Reset for next cycle
          setAuxServerStatus('locked');
          setLockoutTimer(300); // 5 minute hard lock
      }
  }, [criticalStrikeCount]);

  // Auto-scroll defense log
  useEffect(() => {
    defenseLogEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [defenseLog]);

  const handleToggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      clearMessages();
      connect({
        voiceName: selectedVoice,
        systemInstruction: systemInstruction,
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleVerifyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVerificationFile(e.target.files[0]);
      setVerificationResult(null);
      setIsDefenseActive(false);
      setDefenseLog([]);
    }
  };

  const handleProtect = async () => {
     const signature = await protectCurrentWork();
     if (signature) {
        addMessage('system', `Work protected. Quantum Signature generated: ${signature.substring(0, 16)}...`);
     } else {
        addMessage('system', "No audio data to protect.");
     }
  };

  const handleVerify = async () => {
     if (!verificationFile) return;
     setIsVerifying(true);
     // Simulate network delay for "Quantum" look
     await new Promise(r => setTimeout(r, 1500));
     
     const result = await verifyFile(verificationFile);
     setVerificationResult(result);
     setIsVerifying(false);
     
     // Automatic Defense Trigger if it matches (Simulating "Detection of Unauthorized Copy")
     if (result.verified) {
        setIsDefenseActive(true);
     }
  };

  const handleModDeploy = () => {
      if (modCode.trim() === '') return;

      setAuxServerStatus('booting');

      // Simulate analysis time
      setTimeout(() => {
          // Phantom AI Analysis Simulation
          // Keywords that trigger "Critical" destruction
          const criticalTriggers = ['destroy', 'hack', 'overwrite', 'breach', 'admin', 'root'];
          const isCritical = criticalTriggers.some(trigger => modCode.toLowerCase().includes(trigger));

          if (isCritical) {
              setAuxServerStatus('purging');
              setTimeout(() => {
                  setAuxServerStatus('locked');
                  setModCode(''); // Destroy code
                  setLockoutTimer(30); // 30s timed leverage
                  setCriticalStrikeCount(prev => prev + 1);
              }, 2000);
          } else {
              setAuxServerStatus('active');
          }
      }, 1500);
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;
    if (!isCoverSanctioned) {
      addMessage('system', "ACTIVE DEFENSE ALERT: Cover creation unauthorized. Blocked by protocol.");
      return;
    }
    
    setIsProcessing(true);
    clearMessages();
    
    // Add User "Message" to transcript
    addMessage('user', transcriptText || "[Audio File Uploaded]");

    try {
      const base64Audio = await fileToBase64(selectedFile);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const prompt = transcriptText 
        ? `Here is the transcript of the audio I am providing: "${transcriptText}". Please repeat this text exactly word-for-word, but improve the clarity, intonation, and syllabication based on the emotional context of the original audio. Use the ${selectedVoice} voice.`
        : `Listen to this audio. Repeat exactly what was said, but refine the vocal clarity and emotional delivery.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'audio/mp3', data: base64Audio } },
            { text: prompt }
          ]
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          }
        }
      });

      const generatedAudio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (generatedAudio) {
        await playStaticAudio(generatedAudio);
        addMessage('model', "Speech refined and regenerated.");
      } else {
        console.error("No audio content returned");
        addMessage('model', "Error: No audio generated.");
      }

    } catch (error) {
      console.error("Generation error", error);
      addMessage('model', "Error generating speech.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col md:flex-row overflow-hidden font-sans relative">
      
      {/* Documentation Modal */}
      {showDocs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
           <div className="bg-slate-900 w-full max-w-4xl h-[90vh] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                 <div className="flex items-center space-x-3">
                    <BookOpenIcon />
                    <h2 className="text-xl font-bold text-white tracking-wide">Protocols & Legal Codex</h2>
                 </div>
                 <button 
                   onClick={() => setShowDocs(false)}
                   className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
                 {/* Section 1 */}
                 <section className="space-y-4">
                    <h3 className="text-lg font-bold text-red-400 uppercase tracking-wider border-b border-red-500/20 pb-2 flex items-center space-x-2">
                       <ShieldCheckIcon />
                       <span>Terms of Service & Active Defense</span>
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                       By utilizing VocalForge, the User explicitly acknowledges the existence of the <strong>Active Defense System</strong>. Any attempt to duplicate, replicate, or create unsanctioned "Cover" versions of the Author's work without explicit toggled permission (Sanctioning) will result in immediate protocol activation.
                    </p>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-slate-400">
                       <li>Unsanctioned replication triggers simulated corruption of the critical duplicate.</li>
                       <li>Automatic deployment of Trojan bots and Radioware trackers to identify the private hidden location of the breach.</li>
                       <li>Immediate forensic reporting to intelligence nodes (Interpol, C.I.A. Cyber Division, Mississippi Intel).</li>
                       <li>Use of the <em>Phantom Cloud</em> for malicious intent (hacking, root access) will trigger a "Purge & Lock" mechanism.</li>
                    </ul>
                 </section>

                 {/* Section 2 */}
                 <section className="space-y-4">
                    <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wider border-b border-blue-500/20 pb-2 flex items-center space-x-2">
                       <AdjustIcon />
                       <span>Usage Guidelines</span>
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                       <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                          <strong className="text-white block mb-2">Live Nexus</strong>
                          <p className="text-xs text-slate-400">Connect microphone for real-time spectral refinement. Engage in natural speech-to-speech interaction to refine vocal delivery.</p>
                       </div>
                       <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                          <strong className="text-white block mb-2">Refinement Upload</strong>
                          <p className="text-xs text-slate-400">Submit audio files for vocal polishing. <span className="text-red-400">Note: This feature is locked unless Cover Creation is Sanctioned by the Author.</span></p>
                       </div>
                       <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                          <strong className="text-white block mb-2">Quantum Guard</strong>
                          <p className="text-xs text-slate-400">Secure your session with a SHA-256 Cold-Wall signature. This proves the authenticity of the "Origin Code" and protects against unauthorized modification.</p>
                       </div>
                       <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
                          <strong className="text-white block mb-2">Phantom Cloud</strong>
                          <p className="text-xs text-slate-400">A sandbox for "Modded Writers". You may script auxiliary functions, but the Origin Code remains encrypted and immutable via Cold-Wall Encryption.</p>
                       </div>
                    </div>
                 </section>

                 {/* Section 3 */}
                 <section className="space-y-4">
                    <h3 className="text-lg font-bold text-green-400 uppercase tracking-wider border-b border-green-500/20 pb-2 flex items-center space-x-2">
                       <DocumentCheckIcon />
                       <span>Copyright & Protections</span>
                    </h3>
                    
                    <div className="space-y-4">
                       <div className="flex items-start space-x-3">
                          <div className="mt-1 p-1 bg-green-500/10 rounded">
                             <GlobeIcon />
                          </div>
                          <div>
                             <h4 className="font-bold text-slate-200">Total Enjoyment Freedom</h4>
                             <p className="text-sm text-slate-400 mt-1">Fans and trials possess the freedom to download, stream, and share generated works for personal enjoyment without restriction.</p>
                          </div>
                       </div>
                       
                       <div className="flex items-start space-x-3">
                          <div className="mt-1 p-1 bg-red-500/10 rounded">
                             <LockClosedIcon />
                          </div>
                          <div>
                             <h4 className="font-bold text-slate-200">Forceful Cover Block</h4>
                             <p className="text-sm text-slate-400 mt-1">Cover creation is strictly prohibited by default. You must inquire with the Author to unlock the "Sanction Cover Creation" toggle. If a device attempts cover creation without sanction, the <em>Forceful Cover Block</em> will neutralize the attempt instantly.</p>
                          </div>
                       </div>
                    </div>
                 </section>

                 {/* Section 4 */}
                 <section className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Evolutionary Clause</h3>
                    <p className="text-xs text-slate-500 font-mono leading-relaxed">
                       These terms are dynamic living protocols. As the application's A.I. learns from user interaction patterns and critical retrials, these write-ups will expand. The system reserves the right to leverage new defensive or creative protocols as the software matures, giving leeway for growth into new legal frameworks as functionality improves.
                    </p>
                 </section>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end">
                 <button 
                    onClick={() => setShowDocs(false)}
                    className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
                 >
                    Acknowledge & Close
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Sidebar Controls */}
      <div className="w-full md:w-80 bg-slate-950 border-r border-slate-800 p-6 flex flex-col z-20 shadow-xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            VocalForge
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real-time Speech Synthesis</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-900 rounded-lg mb-6 border border-slate-800 space-x-0.5">
          <button
            onClick={() => { setActiveTab('live'); disconnect(); }}
            className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all ${activeTab === 'live' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Live
          </button>
          <button
             onClick={() => { setActiveTab('upload'); disconnect(); }}
             className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all ${activeTab === 'upload' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Upload
          </button>
          <button
             onClick={() => { setActiveTab('phantom'); disconnect(); }}
             className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all flex items-center justify-center space-x-1 ${activeTab === 'phantom' ? 'bg-indigo-900/50 text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <CloudIcon />
          </button>
          <button
             onClick={() => { setActiveTab('guard'); disconnect(); }}
             className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all flex items-center justify-center space-x-1 ${activeTab === 'guard' ? 'bg-red-900/30 text-red-400 border border-red-900/50 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
             <ShieldCheckIcon />
          </button>
        </div>

        {/* Configuration */}
        <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">

          {/* Permissions & Terms Section (Always Visible or Top) */}
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
             <div className="flex items-center space-x-2 text-slate-400">
                <DocumentCheckIcon />
                <span className="text-xs font-bold uppercase tracking-wider">Usage Rights</span>
             </div>
             
             <div className="text-[10px] text-slate-500 leading-relaxed border-l-2 border-green-500 pl-2">
                <strong className="text-green-400 block mb-0.5">Total Enjoyment Freedom</strong>
                Fans & trials are free to download & stream works for personal enjoyment.
             </div>

             <div className="text-[10px] text-slate-500 leading-relaxed border-l-2 border-red-500 pl-2">
                <strong className="text-red-400 block mb-0.5">Cover Restriction</strong>
                Cover type creation must be inquired & sanctioned by Author. Active Defense will block unauthorized devices.
             </div>
             
             <button 
               onClick={() => setShowDocs(true)}
               className="w-full py-1.5 mt-2 bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-300 rounded flex items-center justify-center space-x-1 transition-colors border border-slate-700"
             >
                <BookOpenIcon />
                <span>Read Full Protocols & Terms</span>
             </button>

             <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400">Sanction Cover Creation</span>
                <button
                  onClick={() => setIsCoverSanctioned(!isCoverSanctioned)}
                  className={`w-10 h-5 rounded-full flex items-center transition-colors px-1 ${isCoverSanctioned ? 'bg-green-600' : 'bg-red-900/50 border border-red-800'}`}
                  title={isCoverSanctioned ? "Sanctioned" : "Inquiry Required"}
                >
                   <div className={`w-3 h-3 rounded-full bg-white transition-transform ${isCoverSanctioned ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
             </div>
          </div>
          
          {activeTab === 'live' && (
            <>
              {/* Input Processing Section */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-4">
                 <div className="flex items-center space-x-2 text-blue-400">
                    <AdjustIcon />
                    <span className="text-xs font-bold uppercase tracking-wider">Voice Isolation</span>
                 </div>
                 
                 {/* Hum Filter */}
                 <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Deep Hum Filter</span>
                    <button
                      disabled={isConnected} 
                      onClick={() => setHumFilterEnabled(!humFilterEnabled)}
                      className={`w-10 h-5 rounded-full flex items-center transition-colors px-1 ${humFilterEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
                    >
                       <div className={`w-3 h-3 rounded-full bg-white transition-transform ${humFilterEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                 </div>
                 <p className="text-[10px] text-slate-500 leading-tight">
                    High-pass filter at 85Hz to remove low frequency rumble.
                 </p>

                 {/* Noise Gate */}
                 <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-slate-400">Voice Threshold</span>
                       <span className="text-xs font-mono text-slate-500">{noiseThreshold.toFixed(3)}</span>
                    </div>
                    <input 
                       type="range" 
                       min="0" 
                       max="0.2" 
                       step="0.001" 
                       value={noiseThreshold}
                       onChange={(e) => setNoiseThreshold(parseFloat(e.target.value))}
                       className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <button 
                       onClick={calibrateBackgroundNoise}
                       disabled={isCalibrating || isConnected}
                       className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-blue-400 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                       {isCalibrating ? (
                          <span className="animate-pulse">Listening...</span>
                       ) : (
                          <>
                             <WaveIcon />
                             <span>Learn Background Noise</span>
                          </>
                       )}
                    </button>
                 </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Author Model Persona</label>
                <textarea 
                  disabled={isConnected}
                  value={systemInstruction}
                  onChange={(e) => setSystemInstruction(e.target.value)}
                  className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all disabled:opacity-50 text-slate-300 placeholder-slate-600"
                  placeholder="Define how the AI should behave..."
                />
              </div>
            </>
          )}

          {activeTab === 'upload' && (
            <>
               {!isCoverSanctioned && (
                  <div className="p-3 bg-red-900/20 border border-red-500/50 rounded-lg text-xs text-red-300 flex items-start space-x-2">
                     <LockClosedIcon />
                     <span>
                        <strong>Forceful Cover Block Active:</strong><br/>
                        Creational options blocked. Author sanction required.
                     </span>
                  </div>
               )}
               <div className={`space-y-2 transition-opacity ${!isCoverSanctioned ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audio File (MP3)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 hover:border-blue-500/50 transition-all group"
                >
                  <input 
                    type="file" 
                    accept="audio/*" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                  {selectedFile ? (
                    <div className="text-center px-2">
                      <p className="text-sm text-blue-400 font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <>
                      <UploadIcon />
                      <span className="text-xs text-slate-500 mt-2 group-hover:text-slate-400">Click to upload</span>
                    </>
                  )}
                </div>
              </div>

              <div className={`space-y-2 transition-opacity ${!isCoverSanctioned ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transcript Support</label>
                <textarea 
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all text-slate-300 placeholder-slate-600"
                  placeholder="Paste the text here to help the AI align every word exactly..."
                />
              </div>
            </>
          )}

          {activeTab === 'phantom' && (
             <div className="space-y-4">
                <div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/30 space-y-2 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-2 opacity-20">
                      <CloudIcon />
                   </div>
                   <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
                      <CloudIcon />
                      <span>Phantom Cloud A.I.</span>
                   </h3>
                   <p className="text-[10px] text-slate-400 leading-relaxed">
                      Auxiliary server for Modded Writers. Origin code is protected by Cold-Wall Encryption.
                   </p>
                   
                   {/* Cold Wall Indicator */}
                   <div className="mt-3 p-2 bg-black/40 rounded border border-cyan-500/30 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                         <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
                         <span className="text-[9px] text-cyan-400 font-mono tracking-wider">COLD-WALL ENCRYPTION</span>
                      </div>
                      <LockClosedIcon />
                   </div>
                </div>

                <div className="space-y-2">
                   <div className="flex items-center justify-between">
                     <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Auxiliary Server Status</label>
                     <span className={`text-[10px] font-mono uppercase ${auxServerStatus === 'active' ? 'text-green-400' : auxServerStatus === 'locked' || auxServerStatus === 'purging' ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                        {auxServerStatus}
                     </span>
                   </div>
                   
                   {/* Timed Leverage Indicator */}
                   {lockoutTimer > 0 && (
                      <div className="text-center p-2 bg-red-900/10 border border-red-900/50 rounded text-red-400 text-xs font-mono">
                         TIMED LEVERAGE ACTIVE: {lockoutTimer}s
                      </div>
                   )}
                </div>
             </div>
          )}

          {activeTab === 'guard' && (
             <div className="space-y-4">
                <div className="bg-red-900/20 p-4 rounded-xl border border-red-500/30 space-y-2 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-2 opacity-20">
                      <LockClosedIcon />
                   </div>
                   <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center space-x-2">
                      <ShieldCheckIcon />
                      <span>Active Defense System</span>
                   </h3>
                   <p className="text-[10px] text-slate-400 leading-relaxed">
                      Instant retrievability enabled. Critical duplicators are subject to immediate corruption protocol and intelligence reporting.
                   </p>
                   {/* Status Indicator for Cover Blocking */}
                   <div className="mt-2 pt-2 border-t border-red-500/20 flex items-center justify-between text-[10px] font-mono">
                      <span>CREATIONAL SHIELD:</span>
                      <span className={isCoverSanctioned ? "text-green-500" : "text-red-500 font-bold animate-pulse"}>
                         {isCoverSanctioned ? "STANDBY" : "ACTIVE // BLOCKING"}
                      </span>
                   </div>
                </div>

                <div className="space-y-2">
                   <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inspect Suspicious File</label>
                   <div 
                     onClick={() => verifyInputRef.current?.click()}
                     className="w-full h-20 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-900/50 hover:border-red-500/50 transition-all group"
                   >
                     <input 
                       type="file" 
                       accept="audio/*" 
                       ref={verifyInputRef} 
                       className="hidden" 
                       onChange={handleVerifyFileChange}
                     />
                     {verificationFile ? (
                       <div className="text-center px-2">
                         <p className="text-xs text-red-400 font-medium truncate max-w-[180px]">{verificationFile.name}</p>
                       </div>
                     ) : (
                       <span className="text-xs text-slate-500 group-hover:text-red-400 transition-colors">Select file to inspect</span>
                     )}
                   </div>
                   <button 
                      onClick={handleVerify}
                      disabled={!verificationFile || isVerifying || isDefenseActive}
                      className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold uppercase tracking-wider rounded-lg border border-red-600/50 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
                   >
                      {isVerifying ? (
                        <>
                           <span className="w-3 h-3 border-2 border-red-400/50 border-t-red-400 rounded-full animate-spin" />
                           <span>Analyzing Signature...</span>
                        </>
                      ) : (
                        <>
                           <BoltIcon />
                           <span>Scan & Execute Protocol</span>
                        </>
                      )}
                   </button>
                </div>
                
                {/* Active Defense Radar Visualization */}
                {isDefenseActive && (
                   <div className="h-32 bg-black rounded-lg border border-red-900/50 relative overflow-hidden flex items-center justify-center">
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900 via-black to-black" />
                      
                      {/* Grid */}
                      <div className="absolute inset-0" style={{ 
                         backgroundImage: 'linear-gradient(rgba(50, 0, 0, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(50, 0, 0, 0.5) 1px, transparent 1px)',
                         backgroundSize: '20px 20px'
                      }}></div>

                      {/* Radar Sweep */}
                      <div className="w-64 h-64 border border-red-900/30 rounded-full absolute animate-[spin_4s_linear_infinite]">
                         <div className="w-1/2 h-full bg-gradient-to-l from-red-600/20 to-transparent absolute right-1/2" />
                      </div>

                      {/* Blips */}
                      <div className="w-2 h-2 bg-red-500 rounded-full absolute top-1/3 left-1/3 animate-ping" />
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full absolute bottom-1/4 right-1/3 animate-ping animation-delay-500" />
                      
                      <div className="absolute bottom-2 right-2 text-[10px] font-mono text-red-500">
                         TRACING: <span className="animate-pulse">ACTIVE</span>
                      </div>
                   </div>
                )}
             </div>
          )}

          {activeTab !== 'guard' && activeTab !== 'phantom' && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Voice</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as VoiceName[]).map(voice => (
                <button
                  key={voice}
                  disabled={isConnected || isProcessing}
                  onClick={() => setSelectedVoice(voice)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    selectedVoice === voice 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  } ${(isConnected || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {voice}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>

        {/* Primary Action */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          {activeTab === 'live' ? (
            <button
              onClick={handleToggleConnection}
              disabled={isConnecting}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                isConnected 
                  ? 'bg-red-500/10 text-red-400 border border-red-500/50 hover:bg-red-500/20' 
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
              } ${isConnecting ? 'opacity-70 cursor-wait' : ''}`}
            >
              {isConnecting ? (
                <span className="flex items-center space-x-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Connecting...</span>
                </span>
              ) : isConnected ? (
                <>
                  <StopIcon />
                  <span>End Session</span>
                </>
              ) : (
                <>
                  <MicIcon />
                  <span>Start Live Session</span>
                </>
              )}
            </button>
          ) : activeTab === 'upload' ? (
             <button
              onClick={handleGenerate}
              disabled={isProcessing || !selectedFile || !isCoverSanctioned}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
              } ${(isProcessing || !selectedFile || !isCoverSanctioned) ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
            >
              {isProcessing ? (
                <span className="flex items-center space-x-2">
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Refining...</span>
                </span>
              ) : !isCoverSanctioned ? (
                <span className="flex items-center space-x-2 text-red-200">
                   <LockClosedIcon />
                   <span>Unsanctioned</span>
                </span>
              ) : (
                <>
                  <UploadIcon />
                  <span>Refine Audio</span>
                </>
              )}
            </button>
          ) : activeTab === 'phantom' ? (
             <button
              onClick={handleModDeploy}
              disabled={auxServerStatus === 'booting' || auxServerStatus === 'locked' || auxServerStatus === 'purging'}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                'bg-slate-800 text-indigo-400 border border-indigo-500/30 hover:bg-slate-700'
              } ${(auxServerStatus === 'booting' || auxServerStatus === 'locked' || auxServerStatus === 'purging') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
               {auxServerStatus === 'booting' ? (
                 <span className="flex items-center space-x-2">
                    <span className="w-4 h-4 border-2 border-indigo-500/50 border-t-indigo-500 rounded-full animate-spin" />
                    <span>Booting Aux Server...</span>
                 </span>
               ) : auxServerStatus === 'purging' ? (
                 <span className="text-red-500">PURGING INSTANCE...</span>
               ) : auxServerStatus === 'locked' ? (
                 <span className="text-red-500">LOCKED: {lockoutTimer}s</span>
               ) : (
                  <>
                     <ServerIcon />
                     <span>Deploy Mod</span>
                  </>
               )}
            </button>
          ) : (
            <button
              onClick={handleProtect}
              disabled={totalDuration === 0}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                'bg-slate-800 text-red-400 border border-red-500/30 hover:bg-slate-700'
              } ${totalDuration === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
               <ShieldCheckIcon />
               <span>Protect Current Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-[calc(100vh-80px)] md:h-screen relative bg-slate-900">
        
        {/* Visualizer Header */}
        <div className="p-6 bg-slate-900/95 backdrop-blur-sm z-10 border-b border-slate-800 shadow-sm">
           <Visualizer 
              inputLevel={currentVolume.input} 
              outputLevel={currentVolume.output}
              isConnected={isConnected || isPlaying} 
           />
        </div>

        {/* Content Area - Chat, Guard, or Phantom */}
        <div className="flex-1 overflow-y-auto bg-slate-900/50 scroll-smooth relative">
           {activeTab === 'guard' ? (
             <div className="p-8 max-w-4xl mx-auto w-full h-full flex flex-col">
                {isDefenseActive ? (
                   // ACTIVE DEFENSE INTERFACE
                   <div className="flex-1 flex flex-col space-y-6">
                      <div className="border-l-4 border-red-500 pl-4 py-2 bg-red-900/10 rounded-r-lg">
                         <h2 className="text-2xl font-bold text-red-500 tracking-widest uppercase animate-pulse">Critical Alert</h2>
                         <p className="text-sm text-red-300">Unauthorized duplicate/breach detected. Initiating immediate counter-measures.</p>
                      </div>

                      <div className="flex-1 bg-black rounded-xl border border-slate-800 p-6 font-mono text-xs overflow-y-auto shadow-[0_0_20px_rgba(220,38,38,0.1)]">
                         <div className="space-y-2">
                            {defenseLog.map((log, i) => (
                               <div key={i} className={`flex items-start space-x-2 ${i === defenseLog.length - 1 ? 'text-white' : 'text-green-500/70'}`}>
                                  <span className="opacity-50">[{new Date().toLocaleTimeString()}]</span>
                                  <span>{log}</span>
                               </div>
                            ))}
                            <div ref={defenseLogEndRef} />
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                         <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex items-center space-x-3">
                            <GlobeIcon />
                            <div>
                               <p className="text-[10px] text-slate-500 uppercase tracking-wider">Geolocation</p>
                               <p className="text-sm font-mono text-white">34.0522° N, 118.2437° W</p>
                            </div>
                         </div>
                         <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex items-center space-x-3">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <div>
                               <p className="text-[10px] text-slate-500 uppercase tracking-wider">Agency Uplink</p>
                               <p className="text-sm font-bold text-white">ENCRYPTED // LIVE</p>
                            </div>
                         </div>
                      </div>
                   </div>
                ) : (
                   // STANDARD LEDGER VIEW
                   <>
                      <h2 className="text-xl font-bold text-slate-300 mb-6 flex items-center space-x-2">
                         <ShieldCheckIcon />
                         <span>Quantum Ledger</span>
                      </h2>
                      
                      {ledger.length === 0 ? (
                         <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-2xl text-slate-600">
                            <p>No works protected in this session.</p>
                            <p className="text-sm mt-2">Generate or record audio, then click "Protect Current Session".</p>
                         </div>
                      ) : (
                         <div className="grid gap-4">
                            {ledger.map((item) => (
                               <div key={item.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div>
                                     <div className="flex items-center space-x-3 mb-1">
                                        <span className="text-emerald-400 font-bold">{item.name}</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">Protected</span>
                                     </div>
                                     <p className="text-xs text-slate-500 font-mono break-all max-w-lg">{item.signature}</p>
                                  </div>
                                  <div className="text-right text-xs text-slate-500 flex flex-col items-end">
                                     <span>{item.timestamp.toLocaleTimeString()}</span>
                                     <span>{formatAudioTime(item.duration)}</span>
                                  </div>
                               </div>
                            ))}
                         </div>
                      )}
                   </>
                )}
             </div>
           ) : activeTab === 'phantom' ? (
              // PHANTOM CLOUD INTERFACE
              <div className="p-8 max-w-5xl mx-auto w-full h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                     <h2 className="text-xl font-bold text-indigo-300 flex items-center space-x-2">
                        <CloudIcon />
                        <span>Auxiliary Sandbox</span>
                     </h2>
                     <div className="flex items-center space-x-4">
                        <div className="flex flex-col items-end">
                           <span className="text-[9px] font-mono text-slate-500 uppercase">Strikes</span>
                           <div className="flex space-x-1">
                              {[...Array(3)].map((_, i) => (
                                 <div key={i} className={`w-2 h-2 rounded-full ${i < criticalStrikeCount ? 'bg-red-500' : 'bg-slate-700'}`} />
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                     {/* Code Editor */}
                     <div className="md:col-span-2 bg-slate-950 rounded-xl border border-slate-800 flex flex-col overflow-hidden relative group">
                        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
                           <span className="text-xs font-mono text-slate-400">mod_interface.ts</span>
                           <div className="flex space-x-1.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                              <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                           </div>
                        </div>
                        <div className="flex-1 relative">
                           {auxServerStatus === 'purging' && (
                              <div className="absolute inset-0 bg-red-900/20 z-10 backdrop-blur-[1px] flex items-center justify-center">
                                 <span className="text-red-500 font-bold font-mono text-2xl animate-ping">SYSTEM PURGE</span>
                              </div>
                           )}
                           {auxServerStatus === 'locked' && (
                              <div className="absolute inset-0 bg-slate-950 z-20 flex flex-col items-center justify-center space-y-4">
                                 <LockClosedIcon />
                                 <p className="text-red-400 font-mono">ACCESS DENIED. TIMED LEVERAGE ACTIVE.</p>
                                 <p className="text-slate-600 font-mono text-sm">{lockoutTimer}s remaining</p>
                              </div>
                           )}
                           <textarea
                              disabled={auxServerStatus === 'locked' || auxServerStatus === 'purging'}
                              value={modCode}
                              onChange={(e) => setModCode(e.target.value)}
                              className="w-full h-full bg-transparent text-sm font-mono p-4 text-indigo-200 focus:outline-none resize-none placeholder-indigo-900/50"
                              spellCheck={false}
                              placeholder={`// Enter programmatic modification...\n// NOTE: Origin code is write-protected via Cold-Wall.\n\nfunction initMod() {\n  //...\n}`}
                           />
                        </div>
                     </div>

                     {/* Status Panel */}
                     <div className="space-y-4">
                        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700 space-y-3">
                           <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Constraints</h4>
                           <div className="space-y-2">
                              <div className="flex items-center space-x-2 text-[10px] text-green-400/80">
                                 <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                 <span>Sandbox Isolated</span>
                              </div>
                              <div className="flex items-center space-x-2 text-[10px] text-cyan-400/80">
                                 <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                                 <span>Original Code Immutable</span>
                              </div>
                              <div className="flex items-center space-x-2 text-[10px] text-orange-400/80">
                                 <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                 <span>Critical Monitoring Active</span>
                              </div>
                           </div>
                        </div>

                        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700 h-48 flex flex-col">
                           <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Phantom Terminal</h4>
                           <div className="flex-1 font-mono text-[9px] text-slate-500 overflow-hidden flex flex-col justify-end">
                              <p>> Initializing auxiliary node...</p>
                              <p>> Cold-Wall signature verified.</p>
                              <p>> Sandbox ready.</p>
                              {auxServerStatus === 'booting' && <p className="text-yellow-500">> Analyzing modification packet...</p>}
                              {auxServerStatus === 'active' && <p className="text-green-500">> Deployment Successful. Instance running.</p>}
                              {auxServerStatus === 'purging' && <p className="text-red-500">> CRITICAL INTENT DETECTED. PURGING.</p>}
                           </div>
                        </div>
                     </div>
                  </div>
              </div>
           ) : (
             <div className="max-w-3xl mx-auto w-full pb-32">
               <Transcript messages={messages} />
             </div>
           )}
        </div>
        
        {/* Audio Controls Bar (Fixed at bottom) */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <AudioControls 
            isPlaying={isPlaying}
            currentTime={playbackTime}
            duration={totalDuration}
            onSeek={seek}
            onTogglePlay={handleTogglePlay}
            onDownload={downloadAudio}
            disabled={(!isConnected && totalDuration === 0)}
          />
        </div>

      </div>
    </div>
  );
};

export default App;