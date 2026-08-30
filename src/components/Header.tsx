import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Check, Clock, Palette, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { SUPPORTED_LANGS, type LangKey } from '../i18n';
import { formatTime } from '../lib/utils';
import { isSoundEnabled, toggleSoundEnabled, playPeerConnectedChime } from '../lib/audioFX';

interface HeaderProps {
  isConnected: boolean;
  connTime: number;
  theme: string;
  setTheme: (t: string) => void;
  lang: LangKey;
  setLang: (l: LangKey) => void;
  showLangPicker: boolean;
  setShowLangPicker: (v: boolean) => void;
  onPanic?: () => void;
  t: (key: string) => string;
}

export const Header = React.memo(function Header({
  isConnected,
  connTime,
  theme,
  setTheme,
  lang,
  setLang,
  showLangPicker,
  setShowLangPicker,
  onPanic,
  t,
}: HeaderProps) {
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const langButtonRef = useRef<HTMLButtonElement>(null);

  const handleToggleSound = () => {
    const next = toggleSoundEnabled();
    setSoundOn(next);
    if (next) {
      playPeerConnectedChime();
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        showLangPicker &&
        langDropdownRef.current &&
        !langDropdownRef.current.contains(event.target as Node) &&
        langButtonRef.current &&
        !langButtonRef.current.contains(event.target as Node)
      ) {
        setShowLangPicker(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLangPicker, setShowLangPicker]);

  const currentThemeLabel = theme === 'dark' ? t('darkTheme') : theme === 'cyberpunk' ? t('cyberpunkTheme') : t('lightTheme');

  return (
    <>
      <div className="fixed top-4 right-4 z-50 flex gap-2 items-center">
        {/* MephistoMail Cross-Ecosystem Link */}
        <a
          href="https://mephistomail.site"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 rounded-xl bg-gradient-to-r from-red-600/20 to-orange-600/20 border border-red-500/30 hover:border-red-400/60 transition-all flex items-center gap-1.5 text-xs font-bold text-red-300 hover:text-white shadow-lg shadow-red-500/10"
          title="MephistoMail — Free Disposable Temp Mail"
        >
          <span className="text-sm">📧</span>
          <span className="hidden sm:inline">MephistoMail</span>
        </a>

        {/* Anti-Forensic Panic Key Button */}
        {onPanic && (
          <button
            onClick={onPanic}
            className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/50"
            title="Panic Key: 3x ESC or Alt+P (Instant Zero-Trace Wipe & Camouflage)"
            aria-label="Panic Emergency Zero-Trace Wipe"
          >
            <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
          </button>
        )}

        {/* Language Dropdown */}
        <div className="relative">
          <button
            ref={langButtonRef}
            onClick={() => setShowLangPicker(!showLangPicker)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            title="Language"
            aria-label="Select Language"
            aria-expanded={showLangPicker}
          >
            <Globe className="w-5 h-5 text-cyan-400" />
            <span className="text-xs text-slate-300 hidden sm:inline">
              {SUPPORTED_LANGS.find((l) => l.code === lang)?.flag}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>
          <AnimatePresence>
            {showLangPicker && (
              <motion.div
                ref={langDropdownRef}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute right-0 top-12 bg-slate-950/95 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl min-w-[160px] z-50 transform-gpu"
                role="listbox"
                aria-label="Supported Languages"
              >
                {SUPPORTED_LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLang(l.code);
                      localStorage.setItem('ms-lang', l.code);
                      setShowLangPicker(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                      lang === l.code
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                    role="option"
                    aria-selected={lang === l.code}
                  >
                    <span className="flex items-center gap-2">
                      <span>{l.flag}</span>
                      <span>{l.label}</span>
                    </span>
                    {lang === l.code && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => {
            const next = theme === 'dark' ? 'cyberpunk' : theme === 'cyberpunk' ? 'light' : 'dark';
            setTheme(next);
            localStorage.setItem('ms-theme', next);
          }}
          className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          title={`Switch Theme (Current: ${currentThemeLabel})`}
          aria-label={`Switch Theme from ${currentThemeLabel}`}
        >
          <Palette className="w-5 h-5 text-emerald-400" />
        </button>

        <button
          onClick={handleToggleSound}
          className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          title={soundOn ? 'Sound Effects Enabled (Web Audio FX)' : 'Sound Effects Muted'}
          aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
        >
          {soundOn ? (
            <Volume2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <VolumeX className="w-5 h-5 text-slate-400" />
          )}
        </button>
      </div>

      <header className="z-10 w-full max-w-lg" role="banner">
        {/* Header */}
        <div className="flex flex-col items-center justify-center mb-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/20 via-black to-cyan-500/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(16,185,129,0.3)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/30 to-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity" />
            <img
              src="/favicon.png"
              alt="MephistoVault Zero-Trace Encryption Vault Logo"
              width="48"
              height="48"
              loading="eager"
              decoding="async"
              className="w-12 h-12 rounded-xl relative z-10 shadow-lg group-hover:scale-110 transition-transform"
            />
            {isConnected ? (
              <div className="absolute inset-0 border-2 border-emerald-400 rounded-3xl animate-pulse" />
            ) : (
              <div className="radar-sweep opacity-60" />
            )}
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-bold mb-3 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Mephisto Encryption Protocol v2.5</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-3">
            Mephisto
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Vault
            </span>
          </h1>
          <p className="text-base text-slate-300 font-medium max-w-md mx-auto">
            {t('subtitle')}
            <br /> <span className="text-slate-400 text-sm">{t('subtitle2')}</span>
          </p>
          {isConnected && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono px-4 py-2 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              <Clock className="w-3.5 h-3.5" /> {t('connected')}: {formatTime(connTime)}
            </motion.div>
          )}
        </div>
      </header>
    </>
  );
});

export default Header;
