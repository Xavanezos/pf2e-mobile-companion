import { describe, it, expect } from "vitest";
import { snapToCenter, measureDistance, type GridSpec } from "../src/foundry/scene/ruler";

// 100px squares, 5 ft each, square grid (the common PF2e setup).
const sq: GridSpec = { size: 100, distance: 5, square: true };

describe("snapToCenter (square grid)", () => {
  it("snaps a point inside a square to that square's center", () => {
    // square (0,0) spans 0..100 → center (50,50)
    expect(snapToCenter(sq, 30, 70)).toEqual({ x: 50, y: 50 });
  });

  it("snaps points in higher squares to their centers", () => {
    // square (2,1) spans x 200..300, y 100..200 → center (250,150)
    expect(snapToCenter(sq, 240, 190)).toEqual({ x: 250, y: 150 });
  });

  it("rounds a point just past an edge into the next square", () => {
    // x=101 → square 1 → center 150
    expect(snapToCenter(sq, 101, 1)).toEqual({ x: 150, y: 50 });
  });

  it("does not snap on a non-square grid", () => {
    const hex: GridSpec = { size: 100, distance: 5, square: false };
    expect(snapToCenter(hex, 30, 70)).toEqual({ x: 30, y: 70 });
  });
});

describe("measureDistance (square grid, PF2e alternating diagonals)", () => {
  const c = (i: number, j: number) => ({ x: i * 100 + 50, y: j * 100 + 50 }); // center of square (i,j)

  it("measures a pure straight line by square count", () => {
    expect(measureDistance(sq, c(0, 0), c(3, 0))).toEqual({ squares: 3, feet: 15 });
  });

  it("counts diagonals with the 5-10-5 alternating rule", () => {
    expect(measureDistance(sq, c(0, 0), c(1, 1))).toEqual({ squares: 1, feet: 5 }); // 1 diag
    expect(measureDistance(sq, c(0, 0), c(2, 2))).toEqual({ squares: 3, feet: 15 }); // 5+10
    expect(measureDistance(sq, c(0, 0), c(3, 3))).toEqual({ squares: 4, feet: 20 }); // 5+10+5
    expect(measureDistance(sq, c(0, 0), c(4, 4))).toEqual({ squares: 6, feet: 30 }); // 5+10+5+10
  });

  it("combines diagonals then straights for a mixed path", () => {
    // 3 across, 1 up → diag 1 (5ft) + straight 2 (10ft) → 3 squares, 15ft
    expect(measureDistance(sq, c(0, 0), c(3, 1))).toEqual({ squares: 3, feet: 15 });
  });

  it("is zero for the same square", () => {
    expect(measureDistance(sq, c(2, 2), c(2, 2))).toEqual({ squares: 0, feet: 0 });
  });

  it("scales feet by the grid's distance per square", () => {
    const tenFt: GridSpec = { size: 100, distance: 10, square: true };
    expect(measureDistance(tenFt, c(0, 0), c(2, 2))).toEqual({ squares: 3, feet: 30 }); // 3 sq × 10ft
  });
});

describe("measureDistance (non-square grid → Euclidean feet)", () => {
  const hex: GridSpec = { size: 100, distance: 5, square: false };

  it("returns straight-line feet scaled from pixels", () => {
    // 300px east = 3 squares = 15 ft
    expect(measureDistance(hex, { x: 0, y: 0 }, { x: 300, y: 0 })).toEqual({ squares: 3, feet: 15 });
  });

  it("uses the true hypotenuse, not the grid count", () => {
    // 3-4-5 triangle: 300x,400y → 500px = 5 squares = 25 ft
    expect(measureDistance(hex, { x: 0, y: 0 }, { x: 300, y: 400 })).toEqual({ squares: 5, feet: 25 });
  });
});
