import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowGuide(true);
          }
        }}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-xs transition hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
        aria-label="Install Canteen App"
      >
        <Download className="h-4 w-4 text-amber-600" />
        <span>Install PWA</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="pwa-install-title" className="text-base font-bold text-slate-900">
                    Install Saptien PWA
                  </h3>
                  <p className="text-xs text-slate-500">
                    Fast home-screen launch & live token alerts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close install guide"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
              {isIOS ? (
                <>
                  <p className="font-semibold text-slate-900">On iPhone / iPad (Safari):</p>
                  <p>1. Tap the <strong>Share</strong> icon in the bottom Safari bar.</p>
                  <p>2. Select <strong>Add to Home Screen</strong> and tap <strong>Add</strong>.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-slate-900">On Android / Desktop Chrome:</p>
                  <p>1. Open the browser menu (three dots in the top-right corner) or address bar install icon.</p>
                  <p>2. Choose <strong>Install App</strong> or <strong>Add to Home screen</strong> to launch in standalone full-screen mode.</p>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
