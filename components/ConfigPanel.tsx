import React, { useState } from 'react';
import { ICONS } from '../constants';
import { RegisterConfig } from '../types';

interface ConfigPanelProps {
  connected: boolean;
  onLog: (msg: string) => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ connected, onLog }) => {
  const [configs, setConfigs] = useState<RegisterConfig[]>([
    { address: '0x01', value: '0x00', description: 'Sampling Rate' },
    { address: '0x02', value: '0x01', description: 'Sensitivity' },
    { address: '0x03', value: '0x04', description: 'Filter Mode' },
  ]);

  const readConfig = () => {
    if (!connected) return;
    onLog("Requesting configuration from device...");
    // Mocking response
    setTimeout(() => {
      onLog("Configuration read successfully: 3 registers.");
    }, 500);
  };

  const writeConfig = () => {
    if (!connected) return;
    onLog("Writing configuration to device...");
    // Mocking response
    setTimeout(() => {
      onLog("Configuration written and verified.");
    }, 800);
  };

  const updateVal = (index: number, val: string) => {
    const next = [...configs];
    next[index].value = val;
    setConfigs(next);
  };

  return (
    <section className="bg-slate-50 rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <ICONS.Settings size={14} /> Device Configuration
      </h3>
      
      <div className="space-y-3 mb-4">
        {configs.map((cfg, idx) => (
          <div key={cfg.address} className="bg-white rounded-lg border border-gray-100 p-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold text-indigo-500 bg-indigo-50 px-1 rounded">{cfg.address}</span>
              <p className="text-[10px] text-gray-500 font-medium">{cfg.description}</p>
            </div>
            <input 
              type="text" 
              value={cfg.value}
              onChange={(e) => updateVal(idx, e.target.value)}
              className="w-14 text-xs font-mono font-bold text-right border-b border-gray-200 focus:border-indigo-500 focus:outline-none py-0.5"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={readConfig}
          disabled={!connected}
          className="flex-1 py-2 px-3 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1 transition-all disabled:opacity-50"
        >
          <ICONS.Refresh size={12} /> Read
        </button>
        <button
          onClick={writeConfig}
          disabled={!connected}
          className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1 transition-all shadow-sm disabled:opacity-50"
        >
          <ICONS.Save size={12} /> Write
        </button>
      </div>
    </section>
  );
};

export default ConfigPanel;