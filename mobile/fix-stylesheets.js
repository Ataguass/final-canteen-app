const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const regex = /const createStyles = \(([^)]+)\) => \(\{/g;
  if (regex.test(content)) {
    content = content.replace(regex, 'const createStyles = ($1) => StyleSheet.create({');
    fs.writeFileSync(file, content);
    changedCount++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Updated ${changedCount} files.`);
