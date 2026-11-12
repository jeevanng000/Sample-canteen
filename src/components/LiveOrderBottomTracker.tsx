import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Printer, Sparkles } from 'lucide-react';
import { useCanteen } from '../services/canteenContext';
import {
  calculateOrderEtaAndProgress,
  formatTime12Hour,
} from '../utils/canteenLogic';
import { PhysicalGstBillModal } from './PhysicalGstBillModal';

interface LiveOrderBottomTrackerProps {
  onOpenOrders: () => void;
}

const DELIVERY_STAGES = [
  'About to be accepted',
  'Order accepted',
  'Preparing',
  'Prepared',
];

export const LiveOrderBottomTracker: React.FC<LiveOrderBottomTrackerProps> = ({
  onOpenOrders,
}) => {
  const { myOrders, settings, stepActiveOrderDemoStage } = useCanteen();
  const [showBillModal, setShowBillModal] = useState(false);

  // Pick the most recent active order (placed, preparing, or ready)
  const activeOrder = myOrders.find(
    (o) => o.status === 'placed' || o.status === 'preparing' || o.status === 'ready'
  );

  if (!activeOrder) return null;

  const etaInfo = calculateOrderEtaAndProgress(activeOrder);
  const isPrepared = etaInfo.stageKey === 'prepared';
  const isKitchenAccepted =
    activeOrder.status === 'preparing' || activeOrder.status === 'ready';

  return (
    <>
      <aside
        aria-label="Live order ETA and progress tracker"
        className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8"
      >
        <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white shadow-md">
          {/* Top Row: Token + Delivery Stage Title + ETA & 0-100% readout */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="inline-flex h-8 items-center justify-center rounded-lg bg-amber-500 px-2.5 font-mono text-xs font-bold text-slate-950 tabular-nums shrink-0">
                #{activeOrder.tokenNumber}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-sm font-bold text-white">
                    {etaInfo.stageTitle}
                  </p>
                  <span aria-hidden="true" className="hidden text-slate-600 sm:inline">
                    ·
                  </span>
                  <span className="hidden truncate text-xs text-slate-400 sm:inline">
                    {etaInfo.nextStepLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-xs font-bold tabular-nums ${
                  isPrepared
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-amber-300'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{etaInfo.etaLabel}</span>
                <span aria-hidden="true">·</span>
                <span>Pickup {formatTime12Hour(activeOrder.slotTime)}</span>
              </div>

              <span className="font-mono text-xs font-bold text-white tabular-nums">
                {etaInfo.progressPercent}%
              </span>

              <button
                type="button"
                onClick={() => setShowBillModal(true)}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-amber-500/50 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <Printer className="h-3 w-3 text-amber-400" />
                <span>{isKitchenAccepted ? 'GST Token Bill' : 'Token Slip'}</span>
              </button>

              {settings.testMode && (
                <button
                  type="button"
                  onClick={() => stepActiveOrderDemoStage(activeOrder.id)}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                  aria-label="Advance order stage preview"
                >
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <span>Next Stage</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenOrders}
                className="mac-pill-active inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer whitespace-nowrap"
              >
                <span>Track</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* 0% to 100% Full-Filling Progress Bar */}
          <div className="mt-2.5">
            <div
              role="progressbar"
              aria-label="Order preparation progress"
              aria-valuenow={etaInfo.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
            >
              <div
                className={`progress-bar-shimmer h-full rounded-full transition-all duration-300 ease-out ${
                  isPrepared ? 'bg-emerald-500' : 'bg-amber-400'
                }`}
                style={{ width: `${etaInfo.progressPercent}%` }}
              />
            </div>

            {/* 4 Delivery Milestones: About to be accepted -> Order accepted -> Preparing -> Prepared */}
            <div className="mt-1.5 grid grid-cols-4 gap-1 text-[10px] sm:text-[11px]">
              {DELIVERY_STAGES.map((label, idx) => {
                const reached = idx <= etaInfo.activeStepIndex;
                const current = idx === etaInfo.activeStepIndex;
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-1 truncate ${
                      idx === 3 ? 'justify-end text-right' : ''
                    } ${
                      current
                        ? 'font-bold text-amber-300'
                        : reached
                          ? 'font-medium text-emerald-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {reached && (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                    )}
                    <span className="truncate">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <PhysicalGstBillModal
        order={showBillModal ? activeOrder : null}
        onClose={() => setShowBillModal(false)}
        contextLabel="Student Copy · 80mm GST Tax Invoice & Counter Collection Token"
      />
    </>
  );
};

