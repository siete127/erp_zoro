import React from 'react';

export const operationPageClass =
  "w-full min-h-screen overflow-auto bg-[radial-gradient(ellipse_at_70%_0%,rgba(59,107,212,0.08)_0%,transparent_58%),radial-gradient(ellipse_at_0%_85%,rgba(99,55,197,0.05)_0%,transparent_52%),linear-gradient(180deg,#f7f9fc_0%,#eff4fb_100%)]";

export const operationContainerClass = "mx-auto w-full max-w-[1400px] space-y-6 px-4 py-6 sm:px-6";

export const operationFieldClass =
  "w-full rounded-[16px] border border-[#dce4f0] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.98))] px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 shadow-[0_6px_18px_rgba(15,45,93,0.05)] outline-none transition focus:border-[#1b3d86] focus:ring-4 focus:ring-[#1b3d86]/10";

export const operationSectionClass =
  "rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] p-4 shadow-[0_18px_40px_rgba(15,45,93,0.08)] sm:p-5";

export const operationTableShellClass =
  "overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(246,249,253,0.97))] shadow-[0_18px_40px_rgba(15,45,93,0.08)]";

export const operationPrimaryButtonClass =
  "inline-flex items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#1b3d86,#12336d)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,45,93,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(15,45,93,0.28)] disabled:cursor-not-allowed disabled:opacity-60";

export const operationSecondaryButtonClass =
  "inline-flex items-center justify-center rounded-[16px] border border-[#dce4f0] bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,45,93,0.06)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900";

export const operationDangerButtonClass =
  "inline-flex items-center justify-center rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100";

export function OperationHeader({ eyebrow, title, description, actions, stats }) {
  return (
    <div className="rounded-[30px] border border-white/55 bg-[linear-gradient(135deg,#0f2556,#1d417f_55%,#2e68b4)] px-5 py-5 text-white shadow-[0_28px_70px_rgba(9,32,82,0.2)] sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-100/75">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-[2.15rem]">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-sm text-blue-100/80 sm:text-[15px]">{description}</p>}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {stats ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{stats}</div> : null}
    </div>
  );
}

export function OperationStat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: "border-white/12 bg-white/10 text-white",
    amber: "border-amber-300/35 bg-amber-400/15 text-amber-50",
    emerald: "border-emerald-300/35 bg-emerald-400/15 text-emerald-50",
    blue: "border-sky-300/35 bg-sky-400/15 text-sky-50",
    rose: "border-rose-300/35 bg-rose-400/15 text-rose-50",
  };
  return (
    <div className={`rounded-[22px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function OperationSectionTitle({ eyebrow, title, description, aside }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#6b7a96]">{eyebrow}</p> : null}
        <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function OperationEmptyState({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-[#d6deeb] bg-white/80 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-2 max-w-md text-xs text-slate-500">{description}</p> : null}
    </div>
  );
}
