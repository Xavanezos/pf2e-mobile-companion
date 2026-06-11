import type { CharacterLike, HeaderView } from "./types";

export function mapHeader(a: CharacterLike): HeaderView {
  const s = a.system;
  const ancestryClassLine = [a.ancestry?.name, a.class?.name].filter(Boolean).join(" ");
  return {
    name: a.name,
    img: a.img,
    level: s.details.level.value,
    ancestryClassLine,
    heroPoints: { value: s.resources.heroPoints.value, max: s.resources.heroPoints.max },
    hp: { value: s.attributes.hp.value, temp: s.attributes.hp.temp, max: s.attributes.hp.max },
    dying: { value: s.attributes.dying.value, max: s.attributes.dying.max },
    wounded: s.attributes.wounded.value,
    ac: s.attributes.ac.value,
    perceptionMod: s.perception.value,
    speed: s.movement?.speeds.land?.value ?? 0,
  };
}
