import { useState } from "react";

/**
 * Phase 0 placeholder component. Its only job is to prove the toolchain:
 * edit this file with `npm run dev` running and the card inside Foundry should
 * hot-update without a full reload. Phase 1 replaces it with the real shell.
 */
export function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <strong>PF2e Mobile Companion</strong>
      <div style={{ marginTop: 6, opacity: 0.8 }}>Phase 0 scaffold — HMR test</div>
      <button style={{ marginTop: 10 }} onClick={() => setCount((c) => c + 1)}>
        clicked {count}×
      </button>
    </div>
  );
}
