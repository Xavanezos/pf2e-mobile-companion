import { describe, it, expect } from "vitest";
import { buildEntryPages } from "../src/foundry/journal/view";
import type { PageLike } from "../src/foundry/journal/types";

function page(over: Partial<PageLike> = {}): PageLike {
  return { id: "p1", name: "Page", type: "text", visible: true, sort: 0, content: "<p>hi</p>", src: null, ...over };
}

describe("buildEntryPages", () => {
  it("drops non-visible pages and sorts by sort", () => {
    const pages = [page({ id: "b", sort: 20 }), page({ id: "a", sort: 10 }), page({ id: "x", sort: 5, visible: false })];
    expect(buildEntryPages(pages).map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("maps a text page's content to html", () => {
    expect(buildEntryPages([page({ type: "text", content: "<b>x</b>" })])[0]).toMatchObject({ type: "text", html: "<b>x</b>", src: null });
  });

  it("maps an image page (no html, src + caption)", () => {
    const v = buildEntryPages([page({ type: "image", content: "", src: "map.webp", caption: "A map" })])[0];
    expect(v).toMatchObject({ type: "image", html: "", src: "map.webp", caption: "A map" });
  });

  it("defaults showTitle to true unless explicitly false", () => {
    expect(buildEntryPages([page()])[0].showTitle).toBe(true);
    expect(buildEntryPages([page({ showTitle: false })])[0].showTitle).toBe(false);
  });
});
