import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, Download } from 'lucide-react';
import type { DeviceInfo } from '../types';

interface NearbyDevicesProps {
  nearbyDevices: DeviceInfo[];
  showNearby: boolean;
  setShowNearby: (v: boolean) => void;
  onConnectToDevice: (code: string) => void;
  onInviteDevice: (id: string) => void;
  t: (key: string) => string;
}

export const NearbyDevices = React.memo(function NearbyDevices({
  nearbyDevices,
  showNearby,
  setShowNearby,
  onConnectToDevice,
  onInviteDevice,
  t,
}: NearbyDevicesProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6">
      <button
        onClick={() => setShowNearby(!showNearby)}
        className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition-colors py-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 rounded-xl"
        aria-label="Toggle nearby devices list"
        aria-expanded={showNearby}
      >
        <Wifi
          className={`w-4 h-4 ${
            nearbyDevices.length > 0 ? 'text-green-500 animate-pulse' : 'text-slate-500'
          }`}
        />
        {t('nearby')}{' '}
        {nearbyDevices.length > 0 && (
          <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full font-mono">
            {nearbyDevices.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {showNearby && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-panel p-4 mt-2">
              {nearbyDevices.length === 0 ? (
                <p className="text-sm text-slate-500 text-center italic">{t('noNearby')}</p>
              ) : (
                <div className="space-y-2">
                  {nearbyDevices.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-3 bg-black/30 border border-white/5 rounded-xl p-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Wifi className="w-4 h-4 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-bold">{d.name}</p>
                        <p className="text-slate-500 text-xs font-mono truncate">
                          {d.code ? `Room: ${d.code.split('#')[0]}` : 'Idle'}
                        </p>
                      </div>
                      {d.code ? (
                        <button
                          onClick={() => onConnectToDevice(d.code!)}
                          className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-400"
                          aria-label={`Connect to room of device ${d.name}`}
                        >
                          <Download className="w-3 h-3" /> {t('sendTo')}
                        </button>
                      ) : (
                        <button
                          onClick={() => onInviteDevice(d.id)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          aria-label={`Invite device ${d.name} to connect`}
                        >
                          <Download className="w-3 h-3" /> {t('sendTo')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default NearbyDevices;
