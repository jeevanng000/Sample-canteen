import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Printer,
  QrCode,
  Receipt,
  Scissors,
  ShieldCheck,
  X,
} from 'lucide-react';
import { generateGstTaxBill, type CanteenOrder } from '../utils/canteenLogic';

interface PhysicalGstBillModalProps {
  order: CanteenOrder | null;
  onClose: () => void;
  contextLabel?: string;
}

export const PhysicalGstBillModal: React.FC<PhysicalGstBillModalProps> = ({
  order,
  onClose,
  contextLabel,
}) => {
  const [copied, setCopied] = useState(false);

  if (!order) return null;

  const bill = generateGstTaxBill(order);

  const handleCopySummary = async () => {
    const text = [
      `${bill.canteenName} — TAX INVOICE & COLLECTION TOKEN`,
      `Token: ${bill.tokenDisplay} | Verification Code: ${bill.pickupVerificationCode}`,
      `Invoice: ${bill.invoiceNumber} | KOT: ${bill.kotNumber} | GSTIN: ${bill.gstin}`,
      `Student: ${bill.customerName} (${bill.studentStaffId})`,
      `Items: ${bill.lineItems.map((i) => `${i.quantity}x ${i.name} (₹${i.lineTotal})`).join(', ')}`,
      `Taxable: ₹${bill.taxableAmount.toFixed(2)} | CGST (2.5%): ₹${bill.cgstAmount.toFixed(2)} | SGST (2.5%): ₹${bill.sgstAmount.toFixed(2)}`,
      `Grand Total Paid: ₹${bill.grandTotalPaid.toFixed(2)}`,
    ].join('\n');

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Physical GST Tax Invoice and Collection Token ${bill.tokenDisplay}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-xs sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-md animate-view-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Action Bar outside paper slip */}
        <div className="mb-2.5 flex items-center justify-between gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-white shadow-lg">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Receipt className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              {contextLabel || '80mm Thermal GST Bill & Counter Token'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <Copy className="h-3 w-3 text-amber-400" />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="mac-pill-active inline-flex min-h-[32px] items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer"
            >
              <Printer className="h-3 w-3" />
              <span>Print Bill</span>
            </button>
            <button
              type="button"
              aria-label="Close physical GST bill"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Authentic 80mm Thermal Receipt Paper Container (Always Crisp Black-on-Paper) */}
        <div
          id="printable-gst-thermal-bill"
          className="thermal-paper-bill relative overflow-hidden rounded-2xl border-2 border-stone-300 bg-[#fffdf7] p-5 font-mono text-xs text-stone-950 shadow-2xl"
        >
          {/* Top serrated thermal edge indicator */}
          <div className="border-b-2 border-dashed border-stone-400 pb-3 text-center">
            <p className="text-sm font-extrabold tracking-wider text-stone-950">
              {bill.canteenName}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-stone-700">
              {bill.canteenBranch}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[10px] font-bold text-stone-800">
              <span>GSTIN: {bill.gstin}</span>
              <span>·</span>
              <span>FSSAI: {bill.fssaiLicense}</span>
            </div>
            <div className="mt-2 inline-block rounded-md border border-stone-900 bg-stone-900 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-amber-300 uppercase">
              TAX INVOICE &amp; COLLECTION TOKEN
            </div>
          </div>

          {/* Pending vs Kitchen-Accepted Status Banner */}
          <div
            className={`mt-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold ${
              bill.isIssued
                ? 'border-emerald-700 bg-emerald-50 text-emerald-950'
                : 'border-amber-700 bg-amber-50 text-amber-950'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {bill.isIssued ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              ) : (
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700" />
              )}
              <span>{bill.lifecycleStageLabel}</span>
            </div>
            <span className="tabular-nums">{bill.kotNumber}</span>
          </div>

          {/* Invoice & Student Metadata */}
          <div className="mt-3 space-y-1 border-b border-dashed border-stone-400 pb-3 text-[11px] text-stone-800">
            <div className="flex justify-between">
              <span>INVOICE NO:</span>
              <strong className="text-stone-950 tabular-nums">{bill.invoiceNumber}</strong>
            </div>
            <div className="flex justify-between">
              <span>DATE &amp; TIME:</span>
              <span className="tabular-nums">{bill.issuedAtFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span>STUDENT / STAFF:</span>
              <strong className="text-stone-950">
                {bill.customerName} ({bill.studentStaffId})
              </strong>
            </div>
            <div className="flex justify-between">
              <span>SERVICE TYPE:</span>
              <strong className="text-stone-950">{bill.orderTypeLabel}</strong>
            </div>
            <div className="flex justify-between">
              <span>READY-BY SLOT:</span>
              <strong className="text-stone-950 tabular-nums">{bill.slotTimeFormatted}</strong>
            </div>
          </div>

          {/* Itemized HSN/SAC Table */}
          <div className="mt-3 border-b border-dashed border-stone-400 pb-3">
            <div className="grid grid-cols-12 border-b border-stone-300 pb-1.5 text-[10px] font-bold text-stone-600 uppercase">
              <span className="col-span-6">ITEM (SAC {bill.sacCode})</span>
              <span className="col-span-2 text-center">QTY</span>
              <span className="col-span-2 text-right">RATE</span>
              <span className="col-span-2 text-right">AMT</span>
            </div>
            <div className="mt-2 space-y-1.5 text-[11px]">
              {bill.lineItems.map((item) => (
                <div key={item.itemId} className="grid grid-cols-12 items-start gap-1">
                  <span className="col-span-6 font-semibold text-stone-950 leading-tight">
                    {item.index}. {item.name}
                  </span>
                  <span className="col-span-2 text-center font-bold text-stone-900 tabular-nums">
                    {item.quantity}
                  </span>
                  <span className="col-span-2 text-right text-stone-700 tabular-nums">
                    ₹{item.unitPrice}
                  </span>
                  <span className="col-span-2 text-right font-bold text-stone-950 tabular-nums">
                    ₹{item.lineTotal.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* GST Tax Calculation Breakdown (2.5% CGST + 2.5% SGST) */}
          <div className="mt-3 space-y-1 border-b-2 border-dashed border-stone-400 pb-3 text-[11px] text-stone-800">
            <div className="flex justify-between">
              <span>Items Gross Total ({bill.totalQuantity} qty)</span>
              <span className="tabular-nums">₹{bill.itemsGrossSubtotal.toFixed(2)}</span>
            </div>
            {bill.discountAmount > 0 && (
              <div className="flex justify-between font-semibold text-emerald-800">
                <span>Less: Campus Price Offer</span>
                <span className="tabular-nums">-₹{bill.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-stone-200">
              <span>Taxable Value (Excl. 5% GST)</span>
              <span className="font-semibold text-stone-950 tabular-nums">
                ₹{bill.taxableAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-stone-700">
              <span>CGST @ {bill.cgstRatePercent}% (SAC {bill.sacCode})</span>
              <span className="tabular-nums">₹{bill.cgstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-stone-700">
              <span>SGST @ {bill.sgstRatePercent}% (SAC {bill.sacCode})</span>
              <span className="tabular-nums">₹{bill.sgstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-900">
              <span>Total GST (5.0% Canteen Rate)</span>
              <span className="tabular-nums">₹{bill.totalGstAmount.toFixed(2)}</span>
            </div>

            <div className="mt-2 flex items-center justify-between rounded-lg border-2 border-stone-900 bg-stone-100 px-3 py-2 text-sm font-extrabold text-stone-950">
              <span>GRAND TOTAL PAID</span>
              <span className="tabular-nums">₹{bill.grandTotalPaid.toFixed(2)}</span>
            </div>

            <div className="pt-1 flex justify-between text-[10px] text-stone-600">
              <span>PAYMENT: {bill.paymentModeLabel}</span>
              <span className="tabular-nums">REF: {bill.paymentId}</span>
            </div>
          </div>

          {/* Perforated Cut Line for Student Collection Token Stub */}
          <div className="my-3 flex items-center justify-center gap-2 text-[10px] font-bold tracking-widest text-stone-500">
            <Scissors className="h-3.5 w-3.5 text-stone-600" />
            <span>DETACH STUDENT COLLECTION TOKEN</span>
            <Scissors className="h-3.5 w-3.5 text-stone-600" />
          </div>

          {/* Detachable Student Counter Collection Token Box */}
          <div className="rounded-xl border-2 border-stone-900 bg-amber-50/70 p-3.5 text-center">
            <p className="text-[10px] font-bold tracking-widest text-stone-700 uppercase">
              SAPTIEN · SAPTHAGIRI NPS UNIVERSITY TOKEN
            </p>
            <div className="mt-1 flex items-center justify-center gap-3">
              <span className="text-3xl font-black tracking-tight text-stone-950 tabular-nums">
                TOKEN {bill.tokenDisplay}
              </span>
            </div>

            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-stone-800 bg-white px-2.5 py-1 text-[11px] font-bold text-stone-900">
              <QrCode className="h-3.5 w-3.5 text-stone-800" />
              <span>PICKUP PIN: {bill.pickupVerificationCode}</span>
            </div>

            <p className="mt-2 text-[11px] font-semibold text-stone-800">
              {bill.customerName} ({bill.studentStaffId}) · {bill.orderTypeLabel}
            </p>
            <p className="mt-0.5 text-[10px] text-stone-700">
              {bill.lineItems.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
            </p>

            {/* Deterministic 1D Barcode Visual */}
            <div
              aria-hidden="true"
              className="mt-3 flex h-9 items-stretch justify-center gap-[2px] bg-white px-3 py-1.5 border border-stone-300 rounded-md"
            >
              {bill.barcodeBars.map((w, idx) => (
                <span
                  key={idx}
                  className="bg-stone-950 inline-block"
                  style={{ width: `${w * 2}px` }}
                />
              ))}
            </div>
            <p className="mt-1 text-[9px] tracking-widest text-stone-600 uppercase tabular-nums">
              {bill.invoiceNumber} · {bill.pickupVerificationCode}
            </p>

            <p className="mt-2 text-[10px] font-bold text-stone-900">
              {bill.isIssued
                ? 'Present this GST Token Slip at the pickup counter to collect your order.'
                : 'Awaiting Kitchen Acceptance — Token activates immediately once Kitchen accepts.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
