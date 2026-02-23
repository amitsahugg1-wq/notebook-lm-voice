
import React, { useState, useEffect } from 'react';

const MESSAGES = [
  "ज्ञानवानी मैम एक-एक पॉइंट को गहराई से समझ रही हैं...",
  "अमित सर पक्का कर रहे हैं कि कोई भी जानकारी छूटे नहीं...",
  "हर छोटे फैक्ट के लिए Desi Tricks बनाई जा रही हैं...",
  "पूरी जानकारी को पॉडकास्ट में ढाला जा रहा है...",
  "Ensuring 100% detail coverage... Please wait.",
  "कोई भी पॉइंट नहीं छूटेगा, मास्टरक्लास तैयार हो रही है...",
  "डिटेल्स को मजेदार और याद रखने लायक बनाया जा रहा है!"
];

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  const [displayMsg, setDisplayMsg] = useState(message || MESSAGES[0]);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setDisplayMsg(prev => {
        const idx = MESSAGES.indexOf(prev);
        return MESSAGES[(idx + 1) % MESSAGES.length];
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [message]);

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex flex-col items-center justify-center">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <i className="fa-solid fa-microchip text-indigo-400 text-3xl animate-pulse"></i>
        </div>
      </div>
      <p className="text-xl font-medium text-slate-200 animate-pulse text-center px-4 max-w-md">
        {displayMsg}
      </p>
      <p className="text-slate-500 text-xs mt-4 uppercase tracking-[0.3em] font-black">
        Exhaustive Coverage Mode Active
      </p>
    </div>
  );
};
