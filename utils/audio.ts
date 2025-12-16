
/**
 * Interface representing the data structure expected by Gemini API for audio input.
 */
export interface GeminiAudioData {
  data: string;
  mimeType: string;
}

/**
 * Decodes a base64 string into a Uint8Array.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array into a base64 string.
 */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Calculates the Root Mean Square (RMS) amplitude of a signal.
 * Used for noise gating and volume detection.
 */
export function calculateRMS(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / data.length);
}

/**
 * Converts Float32 audio data (Web Audio API standard) to Int16 PCM (Gemini API standard).
 * And wraps it in the structure expected by the API.
 */
export function createPcmBlob(data: Float32Array): GeminiAudioData {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to [-1, 1] before converting to Int16 to avoid overflow artifacts
    const clamped = Math.max(-1, Math.min(1, data[i]));
    int16[i] = clamped * 32768;
  }
  return {
    data: encodeBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

/**
 * Decodes raw PCM byte data into an AudioBuffer for playback.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize Int16 back to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Formats seconds into MM:SS format
 */
export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Reads a File object and returns a Promise resolving to a base64 string (without the data URL prefix).
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:audio/mpeg;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Exports multiple AudioBuffers as a single WAV Blob.
 */
export function exportWav(buffers: AudioBuffer[], sampleRate: number): Blob {
  // 1. Calculate total length in frames
  const totalFrames = buffers.reduce((acc, b) => acc + b.length, 0);
  const numChannels = buffers.length > 0 ? buffers[0].numberOfChannels : 1;
  
  if (totalFrames === 0) return new Blob([], { type: 'audio/wav' });

  // 2. Create buffer for WAV file
  // Header: 44 bytes
  // Data: totalFrames * numChannels * 2 bytes (16-bit)
  const bufferLength = 44 + totalFrames * numChannels * 2;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // 3. Write WAV Header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + totalFrames * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * 2, true); // ByteRate
  view.setUint16(32, numChannels * 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data');
  view.setUint32(40, totalFrames * numChannels * 2, true); // Subchunk2Size
  
  // 4. Write Data
  let offset = 44;
  for (const buffer of buffers) {
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = buffer.getChannelData(channel)[i];
        // Clamp and scale to 16-bit PCM
        const s = Math.max(-1, Math.min(1, sample));
        const int16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, int16, true);
        offset += 2;
      }
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Generates a SHA-256 cryptographic signature (hex string) from audio buffers.
 * This acts as a 'Quantum' fingerprint for the audio content.
 */
export async function generateSignature(buffers: AudioBuffer[]): Promise<string> {
  if (buffers.length === 0) return '';
  
  // Combine all channel data into one large buffer for hashing
  let totalLength = 0;
  buffers.forEach(b => totalLength += b.length);
  
  const combinedData = new Float32Array(totalLength);
  let offset = 0;
  buffers.forEach(b => {
    combinedData.set(b.getChannelData(0), offset);
    offset += b.length;
  });

  // Convert to Uint8 for hashing
  const bufferView = new Uint8Array(combinedData.buffer);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bufferView);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}