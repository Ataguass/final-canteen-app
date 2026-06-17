/**
 * fix_imports.js
 * 
 * Fixes the broken import insertion from the first codemod pass.
 * Finds lines that have our responsive import inserted in the middle of
 * a multi-line import block and moves it to after the block.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const FILE_EXTENSIONS = ['.tsx', '.ts'];

const RESPONSIVE_IMPORT_PATTERN = /import \{ moderateScale.*\} from '.*responsive';/;

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

function fixFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Find the responsive import line
  let responsiveLineIdx = -1;
  let responsiveLine = '';
  for (let i = 0; i < lines.length; i++) {
    if (RESPONSIVE_IMPORT_PATTERN.test(lines[i])) {
      responsiveLineIdx = i;
      responsiveLine = lines[i].trim();
      break;
    }
  }

  if (responsiveLineIdx === -1) return false; // no responsive import found

  // Check if this line is in the middle of a multi-line import
  // Look backwards from the responsive import line to see if there's an unclosed { from import
  let openBraces = 0;
  let isInsideMultiLineImport = false;
  
  for (let i = 0; i < responsiveLineIdx; i++) {
    const line = lines[i];
    // Count open braces for import statements
    if (line.includes('import ') || openBraces > 0) {
      for (const ch of line) {
        if (ch === '{') openBraces++;
        if (ch === '}') openBraces--;
      }
    }
  }
  
  if (openBraces > 0) {
    isInsideMultiLineImport = true;
  }

  if (!isInsideMultiLineImport) return false; // import is fine

  // Remove the responsive import from its current position
  lines.splice(responsiveLineIdx, 1);

  // Now find the LAST complete import statement
  let lastCompleteImportIdx = -1;
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
      
      // Check if this line ends the import (has 'from' and semicolon, and braces are balanced)
      if (braceDepth <= 0 && (line.includes(' from ') || line.includes('from "'))) {
        lastCompleteImportIdx = i;
        inImport = false;
      }
    }
    
    // If we've passed all imports and hit actual code, stop
    if (!inImport && lastCompleteImportIdx >= 0 && line !== '' && !line.startsWith('import') && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') && !line.startsWith('} from') && !line.includes(' from "') && !line.includes(" from '")) {
      break;
    }
  }

  if (lastCompleteImportIdx >= 0) {
    lines.splice(lastCompleteImportIdx + 1, 0, responsiveLine);
  } else {
    // Fallback: put it at the top
    lines.unshift(responsiveLine);
  }

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return true;
}

function main() {
  const files = getAllFiles(SRC_DIR);
  let fixed = 0;

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!RESPONSIVE_IMPORT_PATTERN.test(content)) continue;

    const relativePath = path.relative(path.resolve(__dirname, '..'), filePath);
    if (fixFile(filePath)) {
      console.log(`  [fixed] ${relativePath}`);
      fixed++;
    }
  }

  console.log(`\n✅ Fixed ${fixed} files.`);
}

main();
