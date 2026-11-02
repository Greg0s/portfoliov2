/**
 * What an arrival proposal asks of the journey's scene (proposal 5, the approach): how much farther the planet and
 * the stars still are than the camera's depth says. The journey adds these depths to its own while drawing, and
 * keeps drawing while the arrival moves the scene.
 */
export const arrivalScene = {
  /** Extra depth of the planet, its decor and its point of light. */
  planetDepth: 0,
  /** Extra depth of the stars, which stream past the camera on its way to the planet. */
  starsDepth: 0,
  /** Whether the scene moves: the journey redraws every frame meanwhile. */
  moving: false,
};
