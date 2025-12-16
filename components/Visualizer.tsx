import React from 'react';

interface VisualizerProps {
  inputLevel: number;
  outputLevel: number;
  isConnected: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ inputLevel, outputLevel, isConnected }) => {
  // We'll create a simple dual-bar or circle visualization
  // Input (User) = Green/Blue, Output (Model) = Purple/Pink

  const inputHeight = Math.min(100, Math.max(5, inputLevel * 100));
  const outputHeight = Math.min(100, Math.max(5, outputLevel * 100));

  return (
    <div className="flex items-end justify-center h-32 space-x-8 w-full bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      
      {/* User Voice Indicator */}
      <div className="flex flex-col items-center space-y-2">
        <div className="relative w-16 h-24 flex items-end justify-center overflow-hidden bg-slate-900 rounded-lg">
           <div 
             className={`w-full bg-gradient-to-t from-cyan-500 to-blue-500 transition-all duration-75 ease-out ${!isConnected ? 'opacity-20' : 'opacity-100'}`}
             style={{ height: `${isConnected ? inputHeight : 5}%` }}
           />
        </div>
        <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">You</span>
      </div>

      {/* Connection Status Icon */}
      <div className="flex items-center justify-center h-full pb-6">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse' : 'bg-red-500/50'}`} />
      </div>

      {/* Model Voice Indicator */}
      <div className="flex flex-col items-center space-y-2">
        <div className="relative w-16 h-24 flex items-end justify-center overflow-hidden bg-slate-900 rounded-lg">
           <div 
             className={`w-full bg-gradient-to-t from-purple-500 to-pink-500 transition-all duration-75 ease-out ${!isConnected ? 'opacity-20' : 'opacity-100'}`}
             style={{ height: `${isConnected ? outputHeight : 5}%` }}
           />
        </div>
        <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">Gemini</span>
      </div>

    </div>
  );
};

export default Visualizer;