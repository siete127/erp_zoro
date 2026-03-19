import React from "react";

export default function UniformViewLayout({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-800 to-slate-700 py-12 px-6">
      <div className="w-full max-w-4xl">
        {children}
      </div>
    </div>
  );
}
