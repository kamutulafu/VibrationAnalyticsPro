import React, { useState, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { ICONS, COMMANDS, G_CONVERSION_FACTOR, PACKET_SIZE } from './constants';
import { SensorModel, Axis, VibrationDataPoint } from './types';

// Components
import StatCard from './components/StatCard';
import ConfigPanel from './components/ConfigPanel';
import RawTerminal from './components/RawTerminal';

const MAX_HISTORY_POINTS = 20000; // 历史缓冲区最大点数
const LIVE_VIEW_WINDOW = 2000;   // 实时跟随时的窗口跨度

export default function App() {
  // Serial & Sensor State
  const [port, setPort] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [activeAxis, setActiveAxis] = useState<Axis>(Axis.NONE);
  const [model, setModel] = useState<SensorModel>(SensorModel.LH_ST_232);
  
  // Stats
  const [currentAccel, setCurrentAccel] = useState<{X: number, Y: number, Z: number}>({X: 0, Y: 0, Z: 0});
  const [amplitudes, setAmplitudes] = useState<{X: number, Y: number, Z: number}>({X: 0, Y: 0, Z: 0});
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  
  // View Control State
  const [isLiveMode, setIsLiveMode] = useState(true);

  // High-performance data refs
  const readingRef = useRef(false);
  const activeAxisRef = useRef<Axis>(Axis.NONE);
  const readerRef = useRef<any>(null);
  const dataBufferRef = useRef<VibrationDataPoint[]>([]); 
  const historyRef = useRef<[number, number][]>([]); // 数据存储：[[index, value], ...]
  const lastPacketRef = useRef<number[]>([]);
  const peakTrackerRef = useRef<{max: number, min: number}>({ max: -Infinity, min: Infinity });
  const pointIndexRef = useRef<number>(0); 
  
  // ECharts Instance
  const chartElRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const addLog = (msg: string) => {
    setRawLogs(prev => [msg, ...prev].slice(0, 100));
  };

  // 1. 初始化图表：优化 X 轴布局
  useEffect(() => {
    if (chartElRef.current) {
      chartInstance.current = echarts.init(chartElRef.current);
      const option = {
        animation: false, 
        grid: { 
          top: 40, 
          bottom: 60, // 增加底部间距以容纳居中的标签
          left: 60, 
          right: 30 
        },
        tooltip: { trigger: 'axis', animation: false },
        xAxis: {
          type: 'value',
          name: '采集点序号',
          nameLocation: 'center', // 居中显示
          nameGap: 35,            // 距离轴线的距离
          nameTextStyle: {
            color: '#64748b',
            fontWeight: 'bold',
            fontSize: 12
          },
          scale: true,
          splitLine: { show: true, lineStyle: { color: '#f1f5f9' } },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          name: '加速度 (g)',
          min: -2,
          max: 2,
          splitLine: { show: true, lineStyle: { color: '#f1f5f9' } },
          axisLabel: { color: '#94a3b8', fontSize: 10 }
        },
        dataZoom: [
          { 
            type: 'inside', 
            xAxisIndex: 0, 
            filterMode: 'none',
            zoomOnMouseWheel: true, 
            moveOnMouseMove: true,
            minValueSpan: 50,
            maxValueSpan: 20000,
          }
        ],
        series: [{
          name: 'Vibration',
          type: 'line',
          showSymbol: false,
          data: [],
          lineStyle: { color: '#4f46e5', width: 1.5 },
          sampling: 'lttb'
        }]
      };
      chartInstance.current.setOption(option);

      const resizeHandler = () => chartInstance.current?.resize();
      window.addEventListener('resize', resizeHandler);
      return () => {
        window.removeEventListener('resize', resizeHandler);
        chartInstance.current?.dispose();
      };
    }
  }, []);

  // 2. 串口控制
  const connectSerial = async () => {
    try {
      const p = await (navigator as any).serial.requestPort();
      await p.open({ baudRate: 115200 });
      setPort(p);
      setConnected(true);
      addLog("串口已连接");
    } catch (err: any) {
      addLog(`连接失败: ${err.message}`);
    }
  };

  const disconnectSerial = async () => {
    if (readingRef.current) await stopReading();
    if (port) {
      try { await port.close(); } catch (e) {}
      setPort(null);
      setConnected(false);
      setActiveAxis(Axis.NONE);
      activeAxisRef.current = Axis.NONE;
      addLog("串口已断开");
    }
  };

  const startAxis = async (axis: Axis) => {
    if (!connected) return;
    await sendCommand(COMMANDS.STOP);

    // 开启新一轮采集时彻底重置数据与索引
    peakTrackerRef.current = { max: -Infinity, min: Infinity };
    pointIndexRef.current = 0; 
    historyRef.current = [];
    dataBufferRef.current = [];
    
    // 初始化视口位置
    chartInstance.current?.dispatchAction({
      type: 'dataZoom',
      startValue: 0,
      endValue: LIVE_VIEW_WINDOW
    });

    setActiveAxis(axis);
    activeAxisRef.current = axis;
    setIsLiveMode(true); // 默认开启实时跟随

    const cmd = axis === Axis.X ? COMMANDS.START_X : axis === Axis.Y ? COMMANDS.START_Y : COMMANDS.START_Z;
    await sendCommand(cmd);
    if (!readingRef.current) startReading();
  };

  const stopAll = async () => {
    await sendCommand(COMMANDS.STOP);
    
    // 关键修复：停止后，锁定在当前视野。由于 historyRef 包含最新点，
    // 我们在这里通过 dispatchAction 最后一次同步视口，确保停在尾部。
    if (historyRef.current.length > 0) {
      const latest = historyRef.current[historyRef.current.length - 1][0];
      const earliest = historyRef.current[0][0];
      const startPos = Math.max(earliest, latest - LIVE_VIEW_WINDOW);
      
      chartInstance.current?.dispatchAction({
        type: 'dataZoom',
        startValue: startPos,
        endValue: latest
      });
    }

    setActiveAxis(Axis.NONE);
    activeAxisRef.current = Axis.NONE;
    setIsLiveMode(false); // 进入手动分析模式
    addLog("停止采集：波形已停留在最新位置，可手动平移缩放");
  };

  const sendCommand = async (cmd: Uint8Array) => {
    if (!port || !port.writable) return;
    const writer = port.writable.getWriter();
    await writer.write(cmd);
    writer.releaseLock();
  };

  const startReading = async () => {
    if (!port || readingRef.current) return;
    readingRef.current = true;
    lastPacketRef.current = [];
    try {
      while (port.readable && readingRef.current) {
        readerRef.current = port.readable.getReader();
        try {
          while (readingRef.current) {
            const { value, done } = await readerRef.current.read();
            if (done) break;
            if (value) processBytes(value);
          }
        } finally {
          readerRef.current?.releaseLock();
        }
      }
    } finally {
      readingRef.current = false;
    }
  };

  const stopReading = async () => {
    readingRef.current = false;
    if (readerRef.current) await readerRef.current.cancel();
  };

  const processBytes = (bytes: Uint8Array) => {
    const combined = [...lastPacketRef.current, ...Array.from(bytes)];
    let i = 0;
    while (i <= combined.length - PACKET_SIZE) {
      if (combined[i + 2] === 0x01 && combined[i + 3] === 0x01) {
        let raw = (combined[i] << 8) | combined[i + 1];
        if (raw > 32767) raw -= 65536;
        const gValue = raw / G_CONVERSION_FACTOR;
        
        if (activeAxisRef.current !== Axis.NONE) {
          dataBufferRef.current.push({ 
            index: pointIndexRef.current++, 
            time: 0, 
            value: gValue, 
            axis: activeAxisRef.current 
          });
          if (gValue > peakTrackerRef.current.max) peakTrackerRef.current.max = gValue;
          if (gValue < peakTrackerRef.current.min) peakTrackerRef.current.min = gValue;
        }
        i += PACKET_SIZE;
      } else {
        i++;
      }
    }
    lastPacketRef.current = combined.slice(i);
  };

  // 3. 数据渲染与视口刷新循环
  useEffect(() => {
    const frame = () => {
      if (!chartInstance.current) return;

      if (dataBufferRef.current.length > 0) {
        const batch = [...dataBufferRef.current];
        dataBufferRef.current = [];

        // 将新点添加到历史缓冲区，并保持最大长度 20,000
        const newPairs: [number, number][] = batch.map(p => [p.index, p.value]);
        historyRef.current = [...historyRef.current, ...newPairs].slice(-MAX_HISTORY_POINTS);

        // 更新实时统计数值
        const lastP = batch[batch.length - 1];
        setCurrentAccel(prev => ({ ...prev, [activeAxisRef.current]: lastP.value }));
        if (peakTrackerRef.current.max !== -Infinity) {
          setAmplitudes(prev => ({ ...prev, [activeAxisRef.current]: peakTrackerRef.current.max - peakTrackerRef.current.min }));
        }

        // 全量更新图表数据
        chartInstance.current.setOption({
          series: [{ data: historyRef.current }]
        }, { lazyUpdate: true });

        // 如果是实时模式，强制视口跟随最新数据点
        if (isLiveMode) {
          const latestIdx = lastP.index;
          const earliestIdxInHistory = historyRef.current[0][0];
          // 视口始终锁定在 [最新-2000, 最新]
          const startZoom = Math.max(earliestIdxInHistory, latestIdx - LIVE_VIEW_WINDOW);
          
          chartInstance.current.dispatchAction({
            type: 'dataZoom',
            startValue: startZoom,
            endValue: latestIdx
          });
        }
      }
      requestAnimationFrame(frame);
    };

    const id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [isLiveMode]);

  const toggleLive = () => {
    const nextMode = !isLiveMode;
    setIsLiveMode(nextMode);
    
    if (nextMode) {
      // 恢复实时模式时，瞬间跳回最末尾
      if (historyRef.current.length > 0) {
        const latest = historyRef.current[historyRef.current.length - 1][0];
        const earliest = historyRef.current[0][0];
        chartInstance.current?.dispatchAction({
          type: 'dataZoom',
          startValue: Math.max(earliest, latest - LIVE_VIEW_WINDOW),
          endValue: latest
        });
      }
      addLog("实时跟随已恢复");
    } else {
      addLog("进入分析模式：视口已释放，可手动拖拽查看历史");
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-900 bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-100">
            <ICONS.Activity size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-none tracking-tight">LH Vibration Analytics Pro</h1>
            <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest">震动传感器手动调试平台</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">型号:</span>
            <select value={model} onChange={(e) => setModel(e.target.value as SensorModel)} className="bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer">
              <option value={SensorModel.LH_ST_232}>LH-ST-232</option>
              <option value={SensorModel.LH_ST_USB}>LH-ST-USB</option>
            </select>
          </div>
          <button onClick={connected ? disconnectSerial : connectSerial} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-bold transition-all shadow-sm ${connected ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}>
            {connected ? '断开连接' : '打开串口'}
          </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col p-6 gap-6 overflow-y-auto custom-scrollbar">
          <section>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ICONS.Play size={14} /> 采集任务
            </h3>
            <div className="grid grid-cols-1 gap-2.5">
              {(['X', 'Y', 'Z'] as Axis[]).map((axis) => (
                <button 
                  key={axis} 
                  disabled={!connected} 
                  onClick={() => startAxis(axis)} 
                  className={`w-full py-3 px-4 rounded-xl flex items-center justify-between border transition-all ${activeAxis === axis ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200 hover:bg-slate-50'} disabled:opacity-40`}
                >
                  <span className="text-sm">采集 {axis} 轴数据</span>
                  {activeAxis === axis && <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />}
                </button>
              ))}
              <button disabled={!connected} onClick={stopAll} className="w-full mt-2 py-3 px-4 rounded-xl flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 font-bold transition-all disabled:opacity-40">
                <ICONS.Stop size={16} /> 停止并查看
              </button>
            </div>
          </section>
          <ConfigPanel connected={connected} onLog={addLog} />
        </aside>

        <main className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard label="X 轴加速度" value={currentAccel.X} amplitude={amplitudes.X} color="indigo" active={activeAxis === Axis.X} />
            <StatCard label="Y 轴加速度" value={currentAccel.Y} amplitude={amplitudes.Y} color="emerald" active={activeAxis === Axis.Y} />
            <StatCard label="Z 轴加速度" value={currentAccel.Z} amplitude={amplitudes.Z} color="amber" active={activeAxis === Axis.Z} />
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-[520px] relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><ICONS.Chart size={18} /></span>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">高频采样波形</h2>
                    <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                        {isLiveMode ? "实时滚动显示最近 2000 个采样点" : "分析模式：左键平移回溯，滚轮细节缩放"}
                    </p>
                </div>
              </div>
              <button 
                onClick={toggleLive}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${isLiveMode ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700'}`}
              >
                {isLiveMode ? <><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/> 实时跟随中</> : <><ICONS.Refresh size={14}/> 返回实时视口</>}
              </button>
            </div>

            {/* 操作遮罩提示 */}
            {!isLiveMode && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-5 py-2.5 rounded-xl text-[11px] font-bold shadow-2xl z-20 pointer-events-none flex items-center gap-6 border border-slate-700 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 flex items-center justify-center bg-indigo-500 rounded text-[10px]">L</div> 左键按住：左右平移历史</div>
                    <div className="w-[1px] h-3 bg-slate-700"/>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 flex items-center justify-center bg-indigo-500 rounded text-[10px]">M</div> 鼠标滚轮：缩放细节</div>
                </div>
            )}

            <div ref={chartElRef} className={`flex-1 w-full min-h-0 ${isLiveMode ? 'cursor-default' : 'cursor-move'}`} />
          </div>
          <RawTerminal logs={rawLogs} />
        </main>
      </div>
    </div>
  );
}