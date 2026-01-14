
import React from 'react';

interface StatCardProps {
  label: string;
  value: number;
  amplitude: number;
  color: 'indigo' | 'emerald' | 'amber';
  active: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, amplitude, color, active }) => {
  const colorMap = {
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
  };

  const ringMap = {
    indigo: 'ring-indigo-100',
    emerald: 'ring-emerald-100',
    amber: 'ring-amber-100',
  };

  const accentMap = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-600',
  };

  return (
    <div className={`relative bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 ${active ? 'ring-2 ' + ringMap[color] + ' border-transparent' : 'border-gray-100'}`}>
      {active && (
        <div className={`absolute top-0 right-0 m-4 w-2 h-2 rounded-full animate-ping ${accentMap[color]}`} />
      )}
      
      <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>
        <div className="flex items-baseline gap-2 mt-2">
          <span className={`text-4xl font-black tracking-tight ${active ? 'text-gray-900' : 'text-gray-400'}`}>
            {value.toFixed(4)}
          </span>
          <span className="text-sm font-bold text-gray-400">g</span>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-gray-400 uppercase font-bold block">Amplitude (Vpp)</span>
          <span className={`text-lg font-bold ${active ? 'text-gray-700' : 'text-gray-300'}`}>
            {amplitude.toFixed(4)} <span className="text-xs opacity-50 font-medium">g</span>
          </span>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorMap[color]}`}>
          <span className="font-bold text-xs">{label.charAt(0)}</span>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
