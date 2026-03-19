import React from 'react'

export default function ResponsiveLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 py-12 px-6">
      <div className="w-full flex items-center justify-center px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  )
}
