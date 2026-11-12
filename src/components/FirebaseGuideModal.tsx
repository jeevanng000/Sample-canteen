import React from 'react';
import { BookOpen, CheckCircle2, ShieldAlert, Terminal, X } from 'lucide-react';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../utils/canteenLogic';

interface FirebaseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirebaseGuideModal: React.FC<FirebaseGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="firebase-guide-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 id="firebase-guide-title" className="text-lg font-bold text-slate-900">
                Firebase Setup & First Admin Guide
              </h2>
              <p className="text-xs text-slate-500">
                Step-by-step instructions for Firebase Console, Auth, and manual Admin promotion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Close setup guide"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5 text-sm leading-relaxed text-slate-700">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              1. How to Enable Email/Password Auth in Firebase Console
            </h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs text-slate-600">
              <li>
                Open the{' '}
                <span className="font-mono font-semibold text-slate-800">
                  Firebase Console (console.firebase.google.com)
                </span>{' '}
                and select project <span className="font-mono font-semibold text-slate-900">dogwood-factor-xlxdt</span>.
              </li>
              <li>
                Navigate to <strong>Build → Authentication → Sign-in method</strong>.
              </li>
              <li>
                Click <strong>Add new provider → Email/Password</strong>, toggle <strong>Enable</strong> on, and click <strong>Save</strong>. (Google Sign-In is already provisioned automatically).
              </li>
            </ol>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
              2. How to Create the First Admin Manually in Firebase Console
            </h3>
            <p className="mt-1.5 text-xs text-slate-600">
              For security, every new signup receives <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-900">role: &quot;customer&quot;</code> and Firestore rules block users from editing their own <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-900">role</code> field.
            </p>
            <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-xs text-slate-700">
              <li>
                Sign up in the app first using your college email so your profile document is created under <code className="rounded bg-white px-1 py-0.5 font-mono">/users/&#123;your-uid&#125;</code>.
              </li>
              <li>
                In the Firebase Console, open <strong>Build → Firestore Database → Data</strong> tab.
              </li>
              <li>
                Click the <strong>users</strong> collection, select your user document (<code className="font-mono">&#123;your-uid&#125;</code>), and change the <code className="font-mono font-semibold">role</code> field value from <code className="font-mono">&quot;customer&quot;</code> to <code className="font-mono font-semibold text-emerald-800">&quot;admin&quot;</code>.
              </li>
              <li>
                Click <strong>Update</strong>. Once you are an admin, you can promote any other user to <code className="font-mono">&quot;kitchen&quot;</code> or <code className="font-mono">&quot;admin&quot;</code> directly from the in-app <strong>Admin → Roles</strong> tab!
              </li>
              <li>
                <em>Note:</em> Your project owner email (<code className="font-mono font-semibold">{BOOTSTRAPPED_ADMIN_EMAIL}</code>) is also bootstrapped in <code className="font-mono">firestore.rules</code> for immediate admin access.
              </li>
            </ol>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Terminal className="h-4 w-4 text-slate-700" />
              3. Running Locally & Cashfree Environment Variables
            </h3>
            <div className="mt-2 space-y-1.5 text-xs text-slate-600">
              <p>
                • Install dependencies & start dev server:{' '}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-900">
                  npm install &amp;&amp; npm run dev
                </code>
              </p>
              <p>
                • Run unit tests & security rule tests:{' '}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-slate-900">
                  npx tsx --test src/utils/canteenLogic.test.ts firestore.rules.test.ts
                </code>
              </p>
              <p>
                • For live Cashfree PG refunds &amp; settlement reconciliation, set{' '}
                <code className="font-mono text-slate-800">CASHFREE_APP_ID</code> and{' '}
                <code className="font-mono text-slate-800">CASHFREE_SECRET_KEY</code> in{' '}
                <code className="font-mono text-slate-800">.env</code>.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
