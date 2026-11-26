// Tick colours, from the fluoro range of the icon circles in Dumb Tasks: full saturation, any
// hue from golden yellow round to pinky red - straight orange and red look dull beside the rest.

const HUE_FROM = 44; // golden yellow
const HUE_TO = 346; // pinky red
const NEIGHBOUR_GAP = 60; // how far a card's hue keeps from the card above
const STEP = 137.5; // the golden angle: steps that never land near each other for long

const span = HUE_TO - HUE_FROM;
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** A stable number from text (FNV-1a), so an exercise gets the same colour every workout. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/**
 * A colour for each exercise of a workout, in order. Each exercise has its own colour in every
 * workout, moved along the range only when it's too close to the card above.
 */
export function exerciseColours(exerciseIds: string[]): string[] {
  let above: number | null = null;
  return exerciseIds.map((id) => {
    const h = hash(id);
    let hue = HUE_FROM + (h % span);
    for (let tries = 0; above !== null && hueDistance(hue, above) < NEIGHBOUR_GAP && tries < 10; tries++) {
      hue = HUE_FROM + ((hue - HUE_FROM + STEP) % span);
    }
    above = hue;
    const lightness = 52 + ((h >>> 9) % 2) * 6; // 52% or 58%, for a little more variety
    return `hsl(${hue.toFixed(1)} 100% ${lightness}%)`;
  });
}
