import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 扩展 window 接口以适应诊断脚本
declare global {
  interface Window {
    appLog: (msg: string, type?: 'info' | 'error' | 'success') => void;
  }
}

const initializeApp = () => {
  window.appLog('正在检查浏览器 API 支持...', 'info');
  if (!('serial' in navigator)) {
    window.appLog('警告: 浏览器不支持 Web Serial API', 'error');
  } else {
    window.appLog('Web Serial API 已就绪', 'success');
  }

  const container = document.getElementById('root');
  if (!container) {
    window.appLog('错误: 未找到根节点 #root', 'error');
    return;
  }

  try {
    window.appLog('正在创建 React 根实例...', 'info');
    const root = createRoot(container);
    
    window.appLog('正在准备渲染主界面 (React v18.2.0)...', 'info');
    
    // 渲染 App
    root.render(<App />);
    
    window.appLog('渲染指令已发出，正在卸载启动加载层...', 'success');
    
    // 延迟移除加载层，确保用户能看到最后一条成功日志
    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      if (loader) {
        loader.style.transition = 'opacity 0.5s ease';
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }
    }, 800);

  } catch (error: any) {
    window.appLog(`渲染崩溃: ${error.message}`, 'error');
    if (error.message.includes('31')) {
      window.appLog('诊断提示: 检测到 React Error #31。这通常是因为传递了无效的子节点或版本 Symbol 冲突。', 'error');
    }
    console.error('Mounting failed:', error);
  }
};

// 启动初始化
initializeApp();