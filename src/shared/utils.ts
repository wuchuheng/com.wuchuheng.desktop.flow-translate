/**
 * Converts a hex color string to an RGBA color string.
 * @param hex - Hex color (e.g. '#ffffff' or '#fff')
 * @param alpha - Opacity from 0 to 1
 * @returns RGBA color string, or transparent black for invalid input
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const cleanHex = hex.replace('#', '');

  if (cleanHex.length !== 3 && cleanHex.length !== 6) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  const r = cleanHex.length === 3 ? parseInt(cleanHex[0] + cleanHex[0], 16) : parseInt(cleanHex.slice(0, 2), 16);
  const g = cleanHex.length === 3 ? parseInt(cleanHex[1] + cleanHex[1], 16) : parseInt(cleanHex.slice(2, 4), 16);
  const b = cleanHex.length === 3 ? parseInt(cleanHex[2] + cleanHex[2], 16) : parseInt(cleanHex.slice(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
