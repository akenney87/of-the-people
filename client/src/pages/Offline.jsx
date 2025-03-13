export default function Offline() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black p-4 text-white">
      <h1 className="text-3xl font-bold mb-4">You&apos;re Offline</h1>
      <p className="text-lg mb-6">Please check your internet connection and try again.</p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-6 py-3 bg-primary text-white rounded-lg"
      >
        Retry
      </button>
    </div>
  );
} 