import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-12 max-w-md w-full">
        <h1 className="text-3xl font-bold text-primary-500 text-center">✅ Tailwind is Working!</h1>
        <p className="text-gray-600 text-center mt-2">FieldSync is ready</p>
        <button className="btn-primary w-full mt-6">
          Test Button
        </button>
      </div>
    </div>
  );
}

export default App;