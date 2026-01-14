
export enum SensorModel {
  LH_ST_232 = 'LH-ST-232',
  LH_ST_USB = 'LH-ST-USB'
}

export enum Axis {
  X = 'X',
  Y = 'Y',
  Z = 'Z',
  NONE = 'NONE'
}

export interface VibrationDataPoint {
  index: number; // 采集点序号 (Integer)
  time: number;  // 保留时间戳供分析使用
  value: number; // 加速度值 (g)
  axis: Axis;
}

export interface RegisterConfig {
  address: string;
  value: string;
  description: string;
}

export interface SerialStatus {
  connected: boolean;
  portName: string | null;
  baudRate: number;
}