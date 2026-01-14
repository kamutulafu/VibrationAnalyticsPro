import { 
  Activity, 
  Settings, 
  Terminal, 
  LineChart, 
  Cpu, 
  ArrowUpCircle, 
  Play, 
  Square,
  RefreshCw,
  Save,
  AlertCircle
} from 'lucide-react';

export const COMMANDS = {
  START_X: new Uint8Array([0x55, 0xAA]),
  START_Y: new Uint8Array([0x55, 0xBB]),
  START_Z: new Uint8Array([0x55, 0xCC]),
  STOP: new Uint8Array([0x55, 0xFF]),
};

export const G_CONVERSION_FACTOR = 16393.0; // 0x4009 = 1g
export const PACKET_SIZE = 4;
export const SAMPLING_INTERVAL_MS = 0.5; // 500us

export const ICONS = {
  Activity: Activity,
  Settings: Settings,
  Terminal: Terminal,
  Chart: LineChart,
  Upgrade: ArrowUpCircle,
  Chip: Cpu,
  Play: Play,
  Stop: Square,
  Refresh: RefreshCw,
  Save: Save,
  Alert: AlertCircle
};