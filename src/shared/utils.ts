/**
 * Converts a hex color string to an RGBA color string.
 * @param hex Hex color string (e.g., '#ffffff' or '#fff')
 * @param alpha Opacity (0 to 1)
 * @returns RGBA color string
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  let r = 0,
    g = 0,
    b = 0;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.slice(0, 2), 16);
    g = parseInt(cleanHex.slice(2, 4), 16);
    b = parseInt(cleanHex.slice(4, 6), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
