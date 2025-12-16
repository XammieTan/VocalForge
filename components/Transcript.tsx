import React, { useEffect, useRef } from 'react';
import { Message } from '../types';

interface TranscriptProps {
  messages: Message[];
}

const Transcript: React.FC<TranscriptProps> = ({ messages }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
         <p>Start the conversation to see the transcript here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 p-4">
      {messages.map((msg) => (
        <div 
          key={msg.id} 
          className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}
        >
          <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
            msg.role === 'user' 
              ? 'bg-blue-600 text-white rounded-br-none' 
              : 'bg-slate-700 text-slate-100 rounded-bl-none'
          }`}>
            {msg.text}
            {msg.isPartial && <span className="inline-block w-1.5 h-3 ml-1 bg-current opacity-70 animate-pulse" />}
          </div>
          <span className="text-[10px] text-slate-500 mt-1 px-1">
             {msg.role === 'user' ? 'You' : (msg.role === 'system' ? 'System' : 'Gemini')} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};

export default Transcript;