import { useEffect, useState } from "react";

/** Reflect Foundry's socket connection. `game.socket` is a socket.io client that
 *  drops on screen-lock and reconnects on its own; we only mirror its state so the
 *  UI can show a scrim instead of freezing. Degrades to "connected" if no socket. */
export function useConnectionStatus(): boolean {
  const [connected, setConnected] = useState<boolean>(
    () => (game as any)?.socket?.connected ?? true,
  );

  useEffect(() => {
    const socket = (game as any)?.socket;
    if (!socket?.on) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected ?? true);
    return () => {
      socket.off?.("connect", onConnect);
      socket.off?.("disconnect", onDisconnect);
    };
  }, []);

  return connected;
}
