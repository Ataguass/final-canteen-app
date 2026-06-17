/**
 * apply_responsive.js
 * 
 * Automated codemod script that wraps hardcoded numeric style values in
 * StyleSheet.create() blocks with responsive scaling functions.
 * 
 * Rules:
 * - fontSize → fontScale(n)
 * - Properties that should remain untouched: flex, opacity, elevation, zIndex,
 *   fontWeight, aspectRatio, borderWidth, shadowOpacity, shadowRadius (shadow internals)
 * - height/width inside shadowOffset → skip
 * - All other numeric style properties → moderateScale(n)
 * - Already-wrapped values (e.g., fontScale(16)) are left alone.
 * - String values (e.g., '100%', '#fff') are left alone.
 * - Very small values (0, 1) are left alone.
 * 
 * Usage: node tools/apply_responsive.js
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────────────────────────

const SRC_DIR = path.resolve(__dirname, '..', 'src');

const FILE_EXTENSIONS = ['.tsx', '.ts'];

// Properties where the numeric value should NOT be wrapped
const SKIP_PROPERTIES = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'opacity',
  'elevation',
  'zIndex',
  'fontWeight',
  'aspectRatio',
  'borderWidth',
  'borderTopWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'shadowOpacity',
  'overflow',
  'position',
  'flexDirection',
  'justifyContent',
  'alignItems',
  'alignSelf',
  'textAlign',
  'textTransform',
  'letterSpacing',
  'lineHeight',
]);

// Properties that should use fontScale instead of moderateScale
const FONT_PROPERTIES = new Set([
  'fontSize',
]);

// Minimum numeric value to bother wrapping (skip 0 and 1)
const MIN_VALUE_TO_WRAP = 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAllFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip node_modules, .expo, dist, etc
      if (['node_modules', '.expo', 'dist', 'android', '.git'].includes(entry.name)) continue;
      getAllFiles(fullPath, results);
    } else if (FILE_EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function fileHasStyleSheet(content) {
  return content.includes('StyleSheet.create');
}

function addImport(content, filePath) {
  // Check if import already exists
  if (content.includes('utils/responsive')) {
    return content;
  }

  // Compute relative path from the file to src/utils/responsive
  const utilsDir = path.resolve(__dirname, '..', 'src', 'utils', 'responsive');
  const fileDir = path.dirname(filePath);
  let relPath = path.relative(fileDir, utilsDir).replace(/\\/g, '/');
  if (!relPath.startsWith('.')) relPath = './' + relPath;

  const importStatement = `import { moderateScale, fontScale, verticalScale, scale, isTablet, gridColumns } from '${relPath}';`;

  // Try to insert after the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || (line.startsWith('} from ') || line.includes(' from "'))) {
      lastImportIndex = i;
    }
    // Stop searching once we hit non-import code
    if (lastImportIndex >= 0 && !line.startsWith('import') && !line.startsWith('} from') && !line.includes(' from "') && !line.includes(" from '") && line !== '' && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
      break;
    }
  }

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, importStatement);
  } else {
    lines.unshift(importStatement);
  }

  return lines.join('\n');
}

/**
 * Process content within StyleSheet.create({...}) blocks.
 * We use a state machine to track:
 * 1. Whether we're inside a StyleSheet.create block
 * 2. Whether we're inside a shadowOffset (to skip width/height there)
 * 3. The property name on the current line
 */
function transformStyleSheetBlock(content) {
  // Find all StyleSheet.create blocks and transform numeric values inside them
  const result = [];
  let i = 0;
  let modified = false;

  while (i < content.length) {
    // Look for StyleSheet.create(
    const ssIndex = content.indexOf('StyleSheet.create(', i);
    if (ssIndex === -1) {
      result.push(content.slice(i));
      break;
    }

    // Push everything before this block
    result.push(content.slice(i, ssIndex));
    result.push('StyleSheet.create(');
    i = ssIndex + 'StyleSheet.create('.length;

    // Now find the matching closing paren by counting braces/parens
    let depth = 1; // we've seen the opening (
    let blockStart = i;
    let pos = i;
    while (pos < content.length && depth > 0) {
      const ch = content[pos];
      if (ch === '(' || ch === '{') depth++;
      else if (ch === ')' || ch === '}') depth--;
      if (depth > 0) pos++;
    }
    // pos now points to the closing ) of StyleSheet.create(...)
    let block = content.slice(blockStart, pos);

    // Transform the block
    const transformed = transformBlock(block);
    if (transformed !== block) modified = true;
    result.push(transformed);

    i = pos; // continue after the block
  }

  return { content: result.join(''), modified };
}

function transformBlock(block) {
  // We process line by line within the style block
  const lines = block.split('\n');
  const transformed = [];
  let inShadowOffset = false;
  let shadowOffsetDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track shadowOffset nesting
    if (trimmed.includes('shadowOffset')) {
      inShadowOffset = true;
      shadowOffsetDepth = 0;
    }
    if (inShadowOffset) {
      for (const ch of trimmed) {
        if (ch === '{') shadowOffsetDepth++;
        if (ch === '}') shadowOffsetDepth--;
      }
      if (shadowOffsetDepth <= 0 && trimmed.includes('}')) {
        // End of shadowOffset
        transformed.push(line);
        inShadowOffset = false;
        continue;
      }
    }

    // Skip lines inside shadowOffset
    if (inShadowOffset) {
      transformed.push(line);
      continue;
    }

    // Match style property lines like:  fontSize: 16,  or  padding: 20,
    // Pattern: propertyName: numericValue (possibly negative)
    const propMatch = trimmed.match(/^(\w+)\s*:\s*(-?\d+\.?\d*)\s*,?\s*$/);
    if (propMatch) {
      const propName = propMatch[1];
      const numValue = parseFloat(propMatch[2]);
      const absValue = Math.abs(numValue);

      if (SKIP_PROPERTIES.has(propName) || absValue < MIN_VALUE_TO_WRAP) {
        transformed.push(line);
        continue;
      }

      // Determine which scale function to use
      let scaleFn;
      if (FONT_PROPERTIES.has(propName)) {
        scaleFn = 'fontScale';
      } else if (propName === 'paddingTop' || propName === 'paddingBottom' || propName === 'marginTop' || propName === 'marginBottom' || propName === 'top' || propName === 'bottom') {
        scaleFn = 'verticalScale';
      } else {
        scaleFn = 'moderateScale';
      }

      // Replace the numeric value with the wrapped version
      const newLine = line.replace(
        /:\s*(-?\d+\.?\d*)/,
        `: ${scaleFn}(${numValue})`
      );
      transformed.push(newLine);
      continue;
    }

    // Also handle inline style patterns like { width: 0, height: 8 } on a single line
    // but ONLY if not inside shadowOffset
    // Match patterns inside objects on the same line as the property
    // e.g., gap: 12,
    transformed.push(line);
  }

  return transformed.join('\n');
}

// Also handle inline styles in JSX: style={{ width: 64, height: 64, ... }}
// We'll handle these separately as they're trickier
function transformInlineStyles(content) {
  // Match style={{ ... }} patterns with numeric values
  // This is simpler - we just wrap obvious numeric style values
  return content.replace(
    /style\s*=\s*\{\{([^}]+)\}\}/g,
    (match, inner) => {
      let transformed = inner;
      // Replace fontSize: N
      transformed = transformed.replace(
        /fontSize\s*:\s*(\d+\.?\d*)/g,
        (m, n) => parseFloat(n) >= MIN_VALUE_TO_WRAP ? `fontSize: fontScale(${n})` : m
      );
      // Replace width/height/padding/margin/borderRadius with moderateScale
      const inlineProps = ['width', 'height', 'padding', 'paddingHorizontal', 'paddingVertical', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'margin', 'marginHorizontal', 'marginVertical', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'borderRadius', 'gap', 'rowGap', 'columnGap'];
      for (const prop of inlineProps) {
        const regex = new RegExp(`${prop}\\s*:\\s*(\\d+\\.?\\d*)`, 'g');
        transformed = transformed.replace(regex, (m, n) => {
          if (parseFloat(n) < MIN_VALUE_TO_WRAP) return m;
          // Already wrapped?
          if (m.includes('moderateScale') || m.includes('fontScale') || m.includes('verticalScale') || m.includes('scale(')) return m;
          const vertProps = ['paddingTop', 'paddingBottom', 'paddingVertical', 'marginTop', 'marginBottom', 'marginVertical'];
          const fn = vertProps.includes(prop) ? 'verticalScale' : 'moderateScale';
          return `${prop}: ${fn}(${n})`;
        });
      }
      return `style={{${transformed}}}`;
    }
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const files = getAllFiles(SRC_DIR);
  let totalModified = 0;

  console.log(`Found ${files.length} source files to scan.`);
  console.log('');

  for (const filePath of files) {
    let content = fs.readFileSync(filePath, 'utf-8');

    if (!fileHasStyleSheet(content)) continue;

    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
    
    // Transform StyleSheet.create blocks
    const { content: transformed, modified } = transformStyleSheetBlock(content);

    if (!modified) {
      console.log(`  [skip] ${relativePath} (no numeric values to wrap)`);
      continue;
    }

    // Add the responsive import
    let finalContent = addImport(transformed, filePath);

    // Transform inline styles too
    finalContent = transformInlineStyles(finalContent);

    // Write back
    fs.writeFileSync(filePath, finalContent, 'utf-8');
    totalModified++;
    console.log(`  [done] ${relativePath}`);
  }

  console.log('');
  console.log(`✅ Modified ${totalModified} files.`);
  console.log('Run TypeScript compilation to verify: npx tsc --noEmit');
}

main();
