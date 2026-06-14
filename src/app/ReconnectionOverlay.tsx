/** Full-screen scrim shown while the Foundry socket is down (see
 *  useConnectionStatus). socket.io reconnects on its own; Reload is a manual
 *  escape hatch for the rare case it doesn't. */
export function ReconnectionOverlay() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-zinc-950/90 px-8 text-center"
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))" }}
    >
      <i className="fas fa-circle-notch fa-spin text-3xl text-amber-400" aria-hidden="true" />
      <div className="text-lg font-semibold">Reconnecting…</div>
      <div className="text-sm text-zinc-400">
        Lost the connection to Foundry. This usually clears on its own.
      </div>
      <button
        onClick={() => location.reload()}
        className="mt-2 min-h-12 rounded-md bg-zinc-800 px-6 text-sm font-medium ring-1 ring-zinc-700"
      >
        Reload
      </button>
    </div>
  );
}
