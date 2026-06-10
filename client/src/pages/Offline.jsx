export default function Offline() {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow text-vermillion mb-6">Press stopped</p>
      <h1
        className="font-display text-h1 leading-[0.95] text-ink"
        style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
      >
        Off the wire.
      </h1>
      <p className="font-body text-lede text-ink-soft mt-6 max-w-md">
        We can&apos;t reach the server right now. Check your connection
        and we&apos;ll start the presses again.
      </p>
      <button onClick={() => window.location.reload()} className="btn-primary mt-10">
        Try again
      </button>
    </div>
  );
}
