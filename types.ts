export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
  isPartial?: boolean;
}

export type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface LiveConfig {
  voiceName: VoiceName;
  systemInstruction: string;
}

export interface AudioVisualizerData {
  inputLevel: number; // 0-1
  outputLevel: number; // 0-1
}

export interface LedgerItem {
  id: string;
  signature: string;
  timestamp: Date;
  duration: number;
  name: string;
}

export type AuxServerStatus = 'offline' | 'booting' | 'active' | 'purging' | 'locked';

export interface ModdingSession {
  code: string;
  status: AuxServerStatus;
  strikes: number;
  lockoutTime: number;
}