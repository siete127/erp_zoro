import React from 'react';

// Layout que ocupa toda la pantalla y hace responsivo el contenido
const FullScreenLayout = ({ children }) => {
  return (
    <div className="min-h-screen w-full flex flex-col bg-gray-100">
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {children}
      </main>
    </div>
  );
};

export default FullScreenLayout;
