import { useEffect, useState } from "react";
import { enrichHtml } from "../../foundry/enrich";
import type { PageView } from "../../foundry/journal/types";

/** Renders one journal page by type. Text is enriched (PF2e's TextEditor) then
 *  injected; images fit-to-width (tap to zoom, wired by the parent); pdf links out;
 *  video uses a native player. Content-link routing is added in Task 3. */
export function JournalPage({ page, onImageTap }: { page: PageView; onImageTap?: (src: string) => void }) {
  return (
    <section className="border-b border-zinc-800 px-4 py-4">
      {page.showTitle && page.name && (
        <h2 className="mb-2 text-lg font-semibold text-zinc-100">{page.name}</h2>
      )}
      {page.type === "text" && <TextPage html={page.html} />}
      {page.type === "image" && page.src && (
        <figure>
          <img
            src={page.src}
            alt={page.caption || page.name}
            className="w-full rounded"
            onClick={() => onImageTap?.(page.src!)}
          />
          {page.caption && <figcaption className="mt-1 text-center text-xs text-zinc-400">{page.caption}</figcaption>}
        </figure>
      )}
      {page.type === "pdf" && page.src && (
        <a href={page.src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-indigo-300 underline">
          <i className="fas fa-file-pdf" aria-hidden="true" /> Open PDF
        </a>
      )}
      {page.type === "video" && page.src && <video controls src={page.src} className="w-full rounded" />}
    </section>
  );
}

function TextPage({ html }: { html: string }) {
  const [enriched, setEnriched] = useState("");
  useEffect(() => {
    let alive = true;
    enrichHtml(html).then((h) => {
      if (alive) setEnriched(h);
    });
    return () => {
      alive = false;
    };
  }, [html]);
  return (
    <div
      className="text-sm leading-relaxed text-zinc-200 [&_a]:text-indigo-300 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mb-1 [&_h2]:font-bold [&_h3]:font-semibold [&_img]:rounded [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_strong]:font-semibold [&_table]:w-full [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
      dangerouslySetInnerHTML={{ __html: enriched }}
    />
  );
}
