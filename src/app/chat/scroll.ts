/** True when the scroll position is within `threshold` px of the bottom — i.e.
 *  the user is "following" the live feed and we should keep pinning to the newest
 *  message as async card content loads. Once they scroll up past the threshold to
 *  read history, this goes false and auto-scroll backs off. A feed shorter than
 *  its viewport (nothing to scroll) counts as at-bottom. */
export function isNearBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 80,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold;
}
