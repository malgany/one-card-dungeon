export function isMobileLayout(width, height) {
  return width < 760 || (height < 500 && width < 1100);
}

// Reserve the touch controls before calculating the camera, including landscape.
export function mobileBoardViewport(width, height) {
  const landscape = width > height;
  const top = landscape ? 84 : 116;
  const bottom = landscape ? 116 : 164;
  return { x: 0, y: top, w: width, h: Math.max(80, height - top - bottom) };
}

export function mobileCameraHeight(viewport, zoom = 1.15, combat = false) {
  const aspect = viewport.w / Math.max(1, viewport.h);
  // A six-cell isometric board spans sqrt(2) * 6 horizontally.
  const fitted = Math.max(combat ? 6.8 : 7.5, 9.8 / aspect);
  return fitted / ((combat ? Math.min(1.15, zoom) : zoom) / 1.15);
}
