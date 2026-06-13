// Type contract for the chat feed: the summary the toast/list render, plus the
// structural shape of the live ChatMessage the mapper reads.

/** Degree of success on a PF2e check, from `flags.pf2e.context.outcome`. */
export type Outcome = "criticalSuccess" | "success" | "failure" | "criticalFailure";

/** What `buildChatView` needs from the client to decide `isOwn`. */
export interface ChatContext { selfUserId: string | null; activeActorId: string | null; }

/** Compact summary the toast + list render. The live card itself is rendered
 *  separately from the Document via `renderHTML` (see render.ts). */
export interface ChatView {
  id: string;
  title: string;
  outcome: Outcome | null;
  outcomeLabel: string | null;
  total: number | null;
  isRoll: boolean;
  /** Authored by me, or spoken by my active actor → eligible for the toast. */
  isOwn: boolean;
}

// The real ChatMessagePF2e satisfies this via `msg as unknown as ChatMessageLike`.

export interface ChatMessageLike {
  id: string;
  author?: { id: string } | null;   // Foundry v13+
  user?: { id: string } | null;     // legacy fallback
  speaker?: { actor?: string | null } | null;
  flavor?: string;
  rolls?: { total?: number }[];
  flags?: { pf2e?: { context?: { outcome?: Outcome | null } } };
}
