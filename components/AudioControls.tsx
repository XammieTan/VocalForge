import React, { useCallback, useRef } from 'react';
import { formatAudioTime } from '../utils/audio';

interface AudioControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  onDownload?: () => void;
  disabled?: boolean;
}

const AudioControls: React.FC<AudioControlsProps> = ({ 
  isPlaying, 
  currentTime, 
  duration, 
  onSeek, 
  onTogglePlay,
  onDownload,
  disabled 
}) => {
  const progressBarRef = useRef<HTMLDivElement>(null);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || disabled) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * duration);
  }, [duration, onSeek, disabled]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isLive = Math.abs(currentTime - duration) < 0.5 && duration > 0;

  return (
    <div className={`w-full bg-slate-800/80 backdrop-blur border-t border-slate-700 p-4 transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <div className="max-w-3xl mx-auto flex items-center space-x-4">
        
        {/* Play/Pause Button */}
        <button 
          onClick={onTogglePlay}
          className="p-2 rounded-full hover:bg-slate-700 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
              <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
            </svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
               <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
             </svg>
          )}
        </button>

        {/* Time Display */}
        <span className="text-xs font-mono text-slate-400 w-12 text-right">
          {formatAudioTime(currentTime)}
        </span>

        {/* Progress Bar */}
        <div 
          ref={progressBarRef}
          onClick={handleSeek}
          className="flex-1 h-8 flex items-center cursor-pointer group"
        >
          <div className="w-full h-1.5 bg-slate-600 rounded-full overflow-hidden relative">
            {/* Played amount */}
            <div 
              className="absolute top-0 left-0 h-full bg-blue-500 rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
            {/* Scrubber Handle (Visible on Hover) */}
            <div 
              className="absolute top-1/2 -mt-1.5 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
               style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>

        {/* Total Duration */}
        <span className="text-xs font-mono text-slate-400 w-12">
           {formatAudioTime(duration)}
        </span>
        
        {/* Download Button */}
        {onDownload && (
          <button
            onClick={onDownload}
            className="p-2 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            title="Download Audio"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M12 12.75l-3-3m0 0l-3 3m3-3v7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}

        {/* Live Indicator */}
        <div className={`flex items-center space-x-1.5 px-2 py-1 rounded border ${isLive ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-slate-600 text-slate-400'}`}>
           <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`} />
           <span className="text-[10px] font-bold uppercase tracking-wider">
             {isLive ? 'Live' : 'History'}
           </span>
        </div>

      </div>
    </div>
  );
};

export default AudioControls;