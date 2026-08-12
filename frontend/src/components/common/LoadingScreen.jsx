import React from 'react';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gray-200 border-t-primary-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">📡</span>
        </div>
      </div>
      <p className="mt-4 text-gray-600 font-medium">Loading FieldSync...</p>
    </div>
  );
}

export default LoadingScreen;