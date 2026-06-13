import type { CharacterLike, HeaderView } from "../types";

export function mapHeader(a: CharacterLike): HeaderView {
  const s = a.system;
  const ancestryClassLine = [a.ancestry?.name, a.class?.name].filter(Boolean).join(" ");
  return {
    name: a.name,
    img: a.img,
    level: s.details.level.value,
    ancestryClassLine,
    // PF2e PCs always cap at 3 hero points; live actors sometimes surface max:0,
    // which would render zero dots and lock the +/- control — fall back to 3.
    heroPoints: { value: s.resources.heroPoints.value, max: s.resources.heroPoints.max || 3 },
    hp: { value: s.attributes.hp.value, temp: s.attributes.hp.temp, max: s.attributes.hp.max },
    dying: { value: s.attributes.dying.value, max: s.attributes.dying.max },
    wounded: s.attributes.wounded.value,
    ac: s.attributes.ac.value,
    perceptionMod: s.perception.value,
    speed: s.movement?.speeds.land?.value ?? 0,
  };
}
