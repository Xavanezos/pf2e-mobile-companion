import type { ChatContext, ChatMessageLike, ChatView, Outcome } from "./types";

const OUTCOME_LABELS: Record<Outcome, string> = {
  criticalSuccess: "Critical Success",
  success: "Success",
  failure: "Failure",
  criticalFailure: "Critical Failure",
};

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&#39;": "'", "&quot;": '"',
};

/** Strip tags + decode a few entities + collapse whitespace for a one-line
 *  summary. Pure — never touches the DOM. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&#39;|&quot;/g, (m) => ENTITIES[m] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildChatView(msg: ChatMessageLike, ctx: ChatContext): ChatView {
  const outcome = msg.flags?.pf2e?.context?.outcome ?? null;
  const isRoll = (msg.rolls?.length ?? 0) > 0;
  const total = isRoll ? msg.rolls?.[0]?.total ?? null : null;
  const title = stripHtml(msg.flavor ?? "") || (isRoll ? "Roll" : "Message");
  const authorId = msg.author?.id ?? msg.user?.id ?? null;
  const authoredBySelf = !!ctx.selfUserId && authorId === ctx.selfUserId;
  const speakerActor = msg.speaker?.actor ?? null;
  const spokenByActive = !!ctx.activeActorId && speakerActor === ctx.activeActorId;
  return {
    id: msg.id,
    title,
    outcome,
    outcomeLabel: outcome ? OUTCOME_LABELS[outcome] : null,
    total,
    isRoll,
    isOwn: authoredBySelf || spokenByActive,
  };
}
