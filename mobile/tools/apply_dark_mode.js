/**
 * apply_dark_mode.js
 * 
 * Automated codemod that adds dark mode support to all screen files.
 * 
 * Strategy: Since StyleSheet.create() is static, we use inline style overrides.
 * For each screen component:
 *   1. Import useTheme
 *   2. Add `const { colors } = useTheme();` inside the component
 *   3. On the root View/ScrollView, add backgroundColor override: colors.background
 *   4. Replace common hardcoded colors in inline styles with theme tokens
 * 
 * Usage: node tools/apply_dark_mode.js
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const FILE_EXTENSIONS = ['.tsx'];

// ─── Color Mapping ──────────────────────────────────────────────────────────
// Maps common hardcoded hex colors to theme color tokens

const BG_COLORS = new Set([
  '#F8FAFC', '#f8fafc', '#fafbfc', '#EEF2F7', '#eef2f7'
]);

const CARD_COLORS = new Set([
  '#FFFFFF', '#ffffff', '#FFF', '#fff', 'white'
]);

const TEXT_COLORS = new Set([
  '#0F172A', '#0f172a', '#1c1c1e', '#111827', '#334155'
]);

const TEXT_SECONDARY_COLORS = new Set([
  '#64748B', '#64748b', '#475569', '#6B7280'
]);

const TEXT_MUTED_COLORS = new Set([
  '#94A3B8', '#94a3b8', '#8e8e93'
]);

const BORDER_COLORS = new Set([
  '#E2E8F0', '#e2e8ea', '#e5e5ea', '#e5e7eb', '#E5E7EB', '#CBD5E1'
]);

const SURFACE_ALT_COLORS = new Set([
  '#F1F5F9', '#f1f5f9', '#F9FAFB'
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAllFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.expo', 'dist', 'android', '.git'].includes(entry.name)) continue;
      getAllFiles(fullPath, results);
    } else if (FILE_EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function hasStyleSheet(content) {
  return content.includes('StyleSheet.create');
}

function addThemeImport(content, filePath) {
  if (content.includes('useTheme')) return content;

  const utilsDir = path.resolve(__dirname, '..', 'src', 'hooks', 'useTheme');
  const fileDir = path.dirname(filePath);
  let relPath = path.relative(fileDir, utilsDir).replace(/\\/g, '/');
  if (!relPath.startsWith('.')) relPath = './' + relPath;

  const importLine = `import { useTheme } from '${relPath}';`;

  const lines = content.split('\n');
  
  // Find last import
  let lastImportIdx = -1;
  let braceDepth = 0;
  let inImport = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimStart();
    if (line.startsWith('import ')) {
      inImport = true;
      braceDepth = 0;
    }
    if (inImport) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0 && (line.includes(' from ') || line.includes('from "'))) {
        lastImportIdx = i;
        inImport = false;
      }
    }
  }

  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    lines.unshift(importLine);
  }

  return lines.join('\n');
}

function addThemeHook(content) {
  if (content.includes('useTheme()')) return content;

  // Find the component function and add the hook call at the top
  // Patterns: export default function Screen() {  or  export default function XxxScreen() {
  const funcPatterns = [
    /export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{/,
    /export\s+default\s+function\s+\w+\s*\(\)\s*\{/,
    /function\s+\w+Screen\s*\([^)]*\)\s*\{/,
  ];

  for (const pattern of funcPatterns) {
    const match = content.match(pattern);
    if (match) {
      const insertPos = match.index + match[0].length;
      const before = content.slice(0, insertPos);
      const after = content.slice(insertPos);
      // Insert after the opening brace
      return before + '\n  const { colors, isDark } = useTheme();' + after;
    }
  }

  return content;
}

/**
 * Apply color overrides to StyleSheet.create blocks.
 * Replace hardcoded colors with colors.xxx references.
 * Since StyleSheet.create is static, we convert it to a function-based approach.
 * 
 * Actually, the simplest approach: Replace the static StyleSheet with a 
 * createStyles(colors) factory function.
 */
function transformStyleSheetToThemed(content) {
  // Find: const styles = StyleSheet.create({
  // Replace with: const createStyles = (colors: any) => StyleSheet.create({
  // And at the end: }); → });
  // Then in the component, add: const styles = createStyles(colors);
  
  // Check if there's already a createStyles
  if (content.includes('createStyles')) return content;
  
  // Replace the static styles declaration
  const staticPattern = /const\s+styles\s*=\s*StyleSheet\.create\(/;
  const match = content.match(staticPattern);
  if (!match) return content;

  // Replace declaration
  content = content.replace(
    staticPattern,
    'const createStyles = (colors: any) => StyleSheet.create('
  );

  // Add `const styles = createStyles(colors);` inside the component function
  // Find useTheme() line and add after it
  const themeHookPattern = /const\s*\{\s*colors\s*,\s*isDark\s*\}\s*=\s*useTheme\(\);/;
  const hookMatch = content.match(themeHookPattern);
  if (hookMatch) {
    content = content.replace(
      themeHookPattern,
      `const { colors, isDark } = useTheme();\n  const styles = createStyles(colors);`
    );
  }

  // Now replace hardcoded colors inside the StyleSheet block
  // Background colors
  for (const color of BG_COLORS) {
    const regex = new RegExp(`backgroundColor:\\s*["']${escapeRegex(color)}["']`, 'g');
    content = content.replace(regex, 'backgroundColor: colors.background');
  }

  // Card/white backgrounds
  for (const color of CARD_COLORS) {
    const regex = new RegExp(`backgroundColor:\\s*["']${escapeRegex(color)}["']`, 'g');
    content = content.replace(regex, 'backgroundColor: colors.card');
  }

  // Text colors
  for (const color of TEXT_COLORS) {
    const regex = new RegExp(`color:\\s*["']${escapeRegex(color)}["']`, 'g');
    content = content.replace(regex, 'color: colors.text');
  }

  // Secondary text
  for (const color of TEXT_SECONDARY_COLORS) {
    const regex = new RegExp(`color:\\s*["']${escapeRegex(color)}["']`, 'g');
    content = content.replace(regex, 'color: colors.textSecondary');
  }

  // Muted text
  for (const color of TEXT_MUTED_COLORS) {
    const regex = new RegExp(`color:\\s*["']${escapeRegex(color)}["']`, 'g');
    content = content.replace(regex, 'color: colors.textMuted');
  }

  // Border colors
  for (const color of BORDER_COLORS) {
    const patterns = [
      `borderColor:\\s*["']${escapeRegex(color)}["']`,
      `borderTopColor:\\s*["']${escapeRegex(color)}["']`,
      `borderBottomColor:\\s*["']${escapeRegex(color)}["']`,
      `borderLeftColor:\\s*["']${escapeRegex(color)}["']`,
      `borderRightColor:\\s*["']${escapeRegex(color)}["']`,
    ];
    for (const p of patterns) {
      const propName = p.split(':')[0];
      const regex = new RegExp(p, 'g');
      content = content.replace(regex, `${propName}: colors.border`);
    }
  }

  // Surface alt backgrounds
  for (const color of SURFACE_ALT_COLORS) {
    const regex = new RegExp(`backgroundColor:\\s*["']${escapeRegex(color)}["']`, 'g');
    content = content.replace(regex, 'backgroundColor: colors.surfaceAlt');
  }

  return content;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const files = getAllFiles(SRC_DIR);
  let totalModified = 0;

  // Skip files that don't have StyleSheet or are layout/hook files
  const skipFiles = new Set([
    'useTheme.tsx', 'useAuth.tsx', 'useCart.tsx', 'useNetworkStatus.tsx',
    'useAutoOrderSync.tsx', 'useOrderSocket.tsx',
    'ErrorBoundary.tsx', 'Toast.tsx',
    '_layout.tsx', // layouts need manual treatment
    'index.tsx', // root index
  ]);

  console.log(`Found ${files.length} source files to scan.\n`);

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    
    // Skip certain files
    if (skipFiles.has(fileName)) continue;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    if (!hasStyleSheet(content)) continue;

    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
    const original = content;

    // Step 1: Add useTheme import
    content = addThemeImport(content, filePath);

    // Step 2: Add useTheme() hook call
    content = addThemeHook(content);

    // Step 3: Transform StyleSheet to themed version
    content = transformStyleSheetToThemed(content);

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf-8');
      totalModified++;
      console.log(`  [done] ${relativePath}`);
    } else {
      console.log(`  [skip] ${relativePath}`);
    }
  }

  console.log(`\n✅ Modified ${totalModified} files.`);
  console.log('Run: npx tsc --noEmit to verify.');
}

main();
