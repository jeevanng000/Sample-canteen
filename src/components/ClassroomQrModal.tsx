import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  GraduationCap,
  Lock,
  QrCode,
  Smartphone,
  X,
} from 'lucide-react';
import { buildStudentOnlyClassroomUrl } from '../utils/canteenLogic';
import { generateQrCodeMatrix } from '../utils/qrCode';

interface ClassroomQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStudentOnlyPreview: boolean;
  onToggleStudentOnlyPreview: (nextValue: boolean) => void;
}

export const ClassroomQrModal: React.FC<ClassroomQrModalProps> = ({
  isOpen,
  onClose,
  isStudentOnlyPreview,
  onToggleStudentOnlyPreview,
}) => {
  const [copied, setCopied] = useState(false);

  const studentOnlyUrl = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://ais-pre-fhyiowbxmdbhjsxaduccsa-763214530749.asia-northeast1.run.app';
    return buildStudentOnlyClassroomUrl(origin);
  }, []);

  const qrMatrix = useMemo(() => generateQrCodeMatrix(studentOnlyUrl), [studentOnlyUrl]);
  const matrixSize = qrMatrix.length;
  const quietZone = 4;
  const totalViewBox = matrixSize + quietZone * 2;

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(studentOnlyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadSvg = () => {
    const rects: string[] = [];
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (qrMatrix[r][c]) {
          rects.push(
            `<rect x="${c + quietZone}" y="${r + quietZone}" width="1" height="1" fill="#090d16" />`
          );
        }
      }
    }

    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalViewBox} ${totalViewBox}" width="720" height="720" shape-rendering="crispEdges">
  <rect width="${totalViewBox}" height="${totalViewBox}" fill="#ffffff" rx="2" />
  ${rects.join('\n  ')}
</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'saptien-student-only-classroom-qr.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Classroom Student-Only QR Code"
      onClick={onClose}
    >
      <div
        className="ios-glass-drawer animate-drawer-up w-full max-w-lg overflow-hidden rounded-3xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-xs">
              <QrCode className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-500/30">
                  <Lock className="h-2.5 w-2.5" />
                  Student Website Only
                </span>
              </div>
              <h2 className="mt-1 font-display text-lg font-bold text-slate-900 sm:text-xl">
                Classroom Testing QR Code
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Classroom QR Code modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scannable High-Contrast QR Card */}
        <div className="mt-4 flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-xs">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            <GraduationCap className="h-3.5 w-3.5" />
            <span>Saptien · SAPTHAGIRI NPS UNIVERSITY</span>
          </div>

          <p className="mt-1.5 text-xs text-slate-600">
            Scan with any phone camera to open <strong>only the Student Ordering Website</strong> (Kitchen &amp; Admin portals are hidden).
          </p>

          {/* Crisp SVG QR Code with 4-Module Quiet Zone (Always Pure White Card for Phone Cameras) */}
          <div
            className="mt-4 rounded-2xl border-2 border-slate-900 bg-white p-3 shadow-md"
            style={{ backgroundColor: '#ffffff' }}
          >
            <svg
              role="img"
              aria-label={`QR Code for Student-Only Ordering Website: ${studentOnlyUrl}`}
              viewBox={`0 0 ${totalViewBox} ${totalViewBox}`}
              shapeRendering="crispEdges"
              className="h-56 w-56 sm:h-64 sm:w-64"
            >
              <rect width={totalViewBox} height={totalViewBox} fill="#ffffff" />
              {qrMatrix.map((row, rIdx) =>
                row.map((isDark, cIdx) =>
                  isDark ? (
                    <rect
                      key={`${rIdx}-${cIdx}`}
                      x={cIdx + quietZone}
                      y={rIdx + quietZone}
                      width={1}
                      height={1}
                      fill="#090d16"
                    />
                  ) : null
                )
              )}
            </svg>
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Smartphone className="h-3.5 w-3.5" />
            <span>Locks classmates to Student Menu, Cart &amp; Live Order Tracker</span>
          </div>
        </div>

        {/* Shareable Student-Only URL Box */}
        <div className="mt-4 space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Direct Student-Only Link (Locked to Student Website)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={studentOnlyUrl}
              aria-label="Student-only website URL"
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="min-h-[40px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:outline-hidden"
            />
            <button
              type="button"
              onClick={() => void handleCopyUrl()}
              className="mac-pill-active inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="mac-pill-inactive inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download QR SVG</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onToggleStudentOnlyPreview(!isStudentOnlyPreview);
              onClose();
            }}
            className="mac-pill-inactive inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>
              {isStudentOnlyPreview ? 'Show 3-in-1 Bar' : 'Preview Student-Only'}
            </span>
          </button>

          <a
            href="/?studentOnly=1"
            onClick={(e) => {
              e.preventDefault();
              onToggleStudentOnlyPreview(true);
              onClose();
            }}
            className="mac-pill-active inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Student-Only</span>
          </a>
        </div>
      </div>
    </div>
  );
};
