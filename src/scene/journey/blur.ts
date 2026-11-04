/**
 * A CSS blur, by steps the eye cannot tell apart (a tenth of a pixel when sharp, more as it blurs): an element whose
 * blur did not change keeps its picture, instead of being blurred again at every frame of a move.
 */
export function blurFilter(blur: number): string {
  const step = blur < 1 ? 0.1 : blur < 4 ? 0.25 : blur < 12 ? 0.5 : 1;
  const stepped = Math.round(blur / step) * step;
  return stepped > 0.05 ? `blur(${stepped.toFixed(2)}px)` : 'none';
}
