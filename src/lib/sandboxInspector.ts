import { DANGEROUS_EXTENSIONS } from './constants';
import { getTranslator, type LangKey } from '../i18n';

export interface SafetyReport {
  score: number; // 0 to 100
  status: 'safe' | 'warning' | 'danger';
  label: string;
  details: string[];
  isExecutable: boolean;
}

export type TranslatorFn = (key: string, params?: Record<string, string | number>) => string;

const DANGEROUS_MIME_TYPES = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-dosexec',
  'application/x-bat',
  'application/x-sh',
  'application/x-msdos-program',
  'application/x-pie-executable',
  'application/vnd.microsoft.portable-executable',
  'application/x-php',
];

export function inspectFileSafety(
  filename: string,
  size: number,
  type: string,
  tOrLang?: TranslatorFn | LangKey,
): SafetyReport {
  const t: TranslatorFn =
    typeof tOrLang === 'function'
      ? tOrLang
      : typeof tOrLang === 'string'
      ? getTranslator(tOrLang)
      : getTranslator('en');

  const cleanFilename = (filename || '').trim();
  const lastDot = cleanFilename.lastIndexOf('.');
  const ext = lastDot !== -1 ? cleanFilename.substring(lastDot).toLowerCase().trim() : '';

  const details: string[] = [];
  let score = 100;
  let isExecutable = false;

  // 1. RTLO (Right-to-Left Override) Unicode Spoofing Check
  const hasRTLO = /[\u202E\u202D\u202A\u202B\u202C\u200E\u200F]/.test(cleanFilename);
  if (hasRTLO) {
    score -= 80;
    isExecutable = true;
    details.push(t('sandboxRtlo'));
  }

  // 2. Double Extension Attack Check (e.g. "document.pdf.exe" or "photo.png.vbs")
  const doubleExtMatch = cleanFilename.toLowerCase().match(/\.([a-z0-9]+)\.([a-z0-9]+)$/);
  if (doubleExtMatch) {
    const secondExt = `.${doubleExtMatch[2]}`;
    if (DANGEROUS_EXTENSIONS.includes(secondExt)) {
      score -= 50;
      isExecutable = true;
      details.push(t('sandboxDoubleExt', { ext: doubleExtMatch[0] }));
    }
  }

  if (type) {
    details.push(t('sandboxMime', { type }));
    // 3. Dangerous MIME Type Inspection
    const cleanType = type.toLowerCase().trim();
    if (DANGEROUS_MIME_TYPES.some((dType) => cleanType.includes(dType))) {
      score -= 60;
      isExecutable = true;
      details.push(t('sandboxDangerousMime', { type }));
    }
  }

  const MACRO_EXTS = ['.docm', '.xlsm', '.pptm', '.dotm', '.xltm'];
  const ARCHIVE_EXTS = ['.zip', '.rar', '.7z', '.tar', '.gz'];

  if (ext && DANGEROUS_EXTENSIONS.includes(ext)) {
    isExecutable = true;
    score -= 60;
    details.push(t('sandboxDangerousExt', { ext }));
  }

  if (ext && MACRO_EXTS.includes(ext)) {
    score -= 40;
    details.push(t('sandboxMacro', { ext }));
  }

  if (ext && ARCHIVE_EXTS.includes(ext)) {
    details.push(t('sandboxArchive', { ext }));
  }

  const sizeInMB = (size / (1024 * 1024)).toFixed(1);
  if (size > 100 * 1024 * 1024) {
    details.push(t('sandboxLargeSize', { size: sizeInMB }));
  } else {
    details.push(t('sandboxSafeSize', { size: sizeInMB }));
  }

  details.push(t('sandboxTunnelVerified'));

  score = Math.max(0, Math.min(100, score));

  let status: 'safe' | 'warning' | 'danger' = 'safe';
  let label = t('sandboxScoreClean');

  if (score <= 40) {
    status = 'danger';
    label = t('sandboxScoreDanger', { score });
  } else if (score <= 70) {
    status = 'warning';
    label = t('sandboxScoreWarning', { score });
  }

  return {
    score,
    status,
    label,
    details,
    isExecutable,
  };
}
