import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Based on standard ~6 inch phone (iPhone 11 / Pixel 6)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

/**
 * Scales a size value proportionally to the screen width.
 * Use for horizontal dimensions: width, marginHorizontal, paddingHorizontal.
 */
export const scale = (size: number): number =>
  (SCREEN_WIDTH / guidelineBaseWidth) * size;

/**
 * Scales a size value proportionally to the screen height.
 * Use for vertical dimensions: height, marginVertical, paddingVertical.
 */
export const verticalScale = (size: number): number =>
  (SCREEN_HEIGHT / guidelineBaseHeight) * size;

/**
 * Scales with a dampening factor so values don't get too extreme on tablets.
 * factor = 0.5 means "scale halfway between fixed and fully proportional".
 * Use for: padding, margin, borderRadius, icon sizes, container widths.
 */
export const moderateScale = (size: number, factor: number = 0.5): number =>
  size + (scale(size) - size) * factor;

/**
 * Responsive font scaling that rounds to nearest pixel for crisp text.
 * Use for all fontSize values.
 */
export const fontScale = (size: number): number => {
  const newSize = size * (SCREEN_WIDTH / guidelineBaseWidth);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Whether the current device screen qualifies as a tablet (>= 768px width).
 */
export const isTablet: boolean = SCREEN_WIDTH >= 768;

/**
 * Returns the number of grid columns appropriate for the screen width.
 * Phone: 2 columns, Tablet: 3-4 columns.
 */
export const gridColumns = (phoneColumns: number = 2): number => {
  if (SCREEN_WIDTH >= 1024) return phoneColumns + 2;
  if (SCREEN_WIDTH >= 768) return phoneColumns + 1;
  return phoneColumns;
};
