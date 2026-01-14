import React, { useRef, useEffect } from 'react';
import { ICONS } from '../constants';

interface RawTerminalProps {
  logs: string[];
}

const RawTerminal: React.FC<RawTerminalProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  return (
    <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 flex flex-col h-[250px] overflow-hidden">
      <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400"><ICONS.Terminal size={14} /></span>
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Serial Terminal</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-slate-700"></div>
        </div>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto font-mono text-xs custom-scrollbar space-y-1"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">Awaiting connection...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-4 group">
              <span className="text-slate-600 flex-shrink-0 select-none">[{new Date().toLocaleTimeString()}]</span>
              <span className={log.includes('failed') ? 'text-red-400' : log.includes('Sent') ? 'text-indigo-400' : 'text-slate-300'}>
                {log}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RawTerminal;