import React from "react";

export default function AuthLayout({ children, maxWidth = "max-w-4xl" }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center py-12 px-6 animated-bg">
      <div className="blob-1"></div>
      <div className="blob-2"></div>
      <div className={`w-full ${maxWidth} relative z-10`}>
        {children}
      </div>
    </div>
  );
}
