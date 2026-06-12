import { useState } from "react";
import { Modal } from "../sheet/parts/Modal";
import { runMessageAction } from "../../foundry/chat/messageActionsRun";
import type { ChatMessageAction } from "../../foundry/chat/messageActions";

/** Bottom-sheet of native PF2e actions for one chat message, opened by long-press
 *  (mirrors EffectActionsModal). Reroll/hero/mythic run on one tap; Delete swaps
 *  the sheet to an in-place confirm. `actions` is precomputed by ChatTab. */
export function ChatMessageActionsModal({ messageId, title, actions, onClose }: {
  messageId: string;
  title: string;
  actions: ChatMessageAction[];
  onClose: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const run = (a: ChatMessageAction) => {
    if (a.kind === "delete") { setConfirmingDelete(true); return; }
    void runMessageAction(messageId, a.kind);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose}>
      {confirmingDelete ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-zinc-300">Delete this message?</div>
          <div className="flex gap-2">
            <button
              onClick={() => { void runMessageAction(messageId, "delete"); onClose(); }}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-red-900/70 px-3 text-sm font-semibold text-red-100"
            >
              <i className="fas fa-trash" aria-hidden="true" />
              Delete
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-zinc-800 px-3 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {actions.map((a) => (
            <button
              key={a.kind}
              onClick={() => run(a)}
              className={
                "flex min-h-11 w-full items-center justify-start gap-3 rounded-md px-3 text-sm font-semibold " +
                (a.destructive
                  ? "bg-red-900/70 text-red-100"
                  : "bg-zinc-800 text-zinc-200 ring-1 ring-zinc-700")
              }
            >
              <i className={`fas ${a.icon} w-5 text-center`} aria-hidden="true" />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
