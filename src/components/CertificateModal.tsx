import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  X,
  Download,
  Copy,
  Check,
  FileCode,
  Lock,
  Clock,
  HardDrive,
  FileText,
  Printer,
  Sparkles,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { type DeliveryCertificate, exportCertificateAsHTML } from '../lib/certificate';
import { copyToClipboard, saveFile } from '../lib/utils';

export interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: DeliveryCertificate | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export const CertificateModal: React.FC<CertificateModalProps> = React.memo(function CertificateModal({
  isOpen,
  onClose,
  certificate,
  t,
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = useCallback(async (text: string, fieldName: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }, []);

  const handleDownloadHTML = useCallback(() => {
    if (!certificate) return;
    const htmlContent = exportCertificateAsHTML(certificate);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const filename = `proof-of-delivery-${certificate.certificateId}.html`;
    saveFile(blob, filename);
  }, [certificate]);

  const handleDownloadJSON = useCallback(() => {
    if (!certificate) return;
    const jsonContent = JSON.stringify(certificate, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const filename = `proof-of-delivery-${certificate.certificateId}.json`;
    saveFile(blob, filename);
  }, [certificate]);

  const handlePrint = useCallback(() => {
    if (!certificate) return;
    const htmlContent = exportCertificateAsHTML(certificate);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  }, [certificate]);

  if (!isOpen || !certificate) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto transform-gpu"
        role="dialog"
        aria-modal="true"
        aria-label={t('certificateTitle') || 'Cryptographic Delivery Certificate'}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-slate-950/95 border border-emerald-500/40 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(16,185,129,0.25)] overflow-hidden my-auto"
        >
          {/* Cybernetic Neon Corner Accents */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                  {t('certificateTitle') || 'Certificate of Delivery'}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                    E2E PROOF
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-medium">
                  {t('certificateSubtitle') || 'Cryptographically verified, tamper-proof proof of transfer'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label={t('close') || 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Certificate ID & Verification Banner */}
          <div className="mb-6 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase text-emerald-400/80 font-bold">
                  {t('certId') || 'Certificate ID'}
                </span>
                <span className="font-mono text-xs md:text-sm font-bold text-emerald-300">
                  {certificate.certificateId}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold flex items-center gap-1 border border-emerald-500/30">
                <Check className="w-3.5 h-3.5" />
                {t('certifiedDelivered') || 'Verified Delivered'}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(certificate.certificateId, 'certId')}
                className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors cursor-pointer"
                title={t('copy') || 'Copy ID'}
              >
                {copiedField === 'certId' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Main Grid: Details + QR Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Left 2 Cols: Transfer Metrics & Details */}
            <div className="md:col-span-2 space-y-3">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-cyan-400" /> Transferred File
                </div>
                <div className="text-xs font-bold text-white truncate" title={certificate.fileName}>
                  {certificate.fileName}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-emerald-400" /> File Size
                  </div>
                  <div className="text-xs font-bold font-mono text-emerald-400">
                    {certificate.fileSizeFormatted}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-purple-400" /> {t('transferDuration') || 'Duration'}
                  </div>
                  <div className="text-xs font-bold font-mono text-purple-300">
                    {certificate.transferDurationFormatted}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-pink-400" /> {t('cipherSuite') || 'Cipher'}
                  </div>
                  <div className="text-xs font-bold font-mono text-pink-300 truncate" title={certificate.cipher}>
                    {certificate.cipher}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-400" /> Timestamp (UTC)
                  </div>
                  <div className="text-[11px] font-bold font-mono text-slate-200 truncate" title={certificate.timestamp}>
                    {new Date(certificate.timestampUnix).toLocaleTimeString()} · {new Date(certificate.timestampUnix).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col: Verification QR Code */}
            <div className="flex flex-col items-center justify-center p-3.5 bg-black/60 border border-emerald-500/30 rounded-2xl">
              <div className="bg-[#050811] p-2.5 rounded-xl border border-emerald-500/40 mb-2 shadow-inner">
                <QRCodeCanvas
                  value={certificate.qrPayload}
                  size={120}
                  bgColor="#050811"
                  fgColor="#10b981"
                  level="H"
                  marginSize={1}
                />
              </div>
              <span className="text-[10px] font-mono text-emerald-400/90 font-bold uppercase tracking-wider">
                Cryptographic Seal QR
              </span>
            </div>
          </div>

          {/* Cryptographic Hashes Section */}
          <div className="space-y-2.5 mb-6">
            {/* SHA-256 Checksum */}
            <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/20 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase text-emerald-400 font-bold mb-0.5">
                  Payload SHA-256 Checksum Seal
                </div>
                <div className="font-mono text-xs text-emerald-200 truncate" title={certificate.sha256}>
                  {certificate.sha256}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(certificate.sha256, 'sha256')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 transition-colors shrink-0 cursor-pointer"
                title={t('copy') || 'Copy SHA-256'}
              >
                {copiedField === 'sha256' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* HMAC / Verification Seal */}
            <div className="p-3 rounded-xl bg-black/60 border border-cyan-500/20 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold mb-0.5">
                  {t('verificationSeal') || 'Tamper-Proof Verification Seal'}
                </div>
                <div className="font-mono text-xs text-cyan-200 truncate" title={certificate.verificationSeal}>
                  {certificate.verificationSeal}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(certificate.verificationSeal, 'seal')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 transition-colors shrink-0 cursor-pointer"
                title={t('copySeal') || 'Copy Seal'}
              >
                {copiedField === 'seal' ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadHTML}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t('downloadCertHtml') || 'Download Certificate (.html)'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJSON}
                className="px-3 py-2.5 bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 text-cyan-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{t('downloadCertJson') || 'JSON Proof'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Print / Save as PDF"
                aria-label="Print Certificate"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              {t('close') || 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

export default CertificateModal;
