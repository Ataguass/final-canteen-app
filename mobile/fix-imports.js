const fs = require('fs');
const path = require('path');

function getRelativeTypesPath(filePath) {
  // src/app/(admin)/orders/all.tsx -> depth is 4
  // We need to reach src/types
  const depth = filePath.split(path.sep).length - 1; // Assuming relative to src
  // Wait, let's just use path.relative
  const dir = path.dirname(path.resolve(filePath));
  const typesDir = path.resolve('./src/types');
  let rel = path.relative(dir, typesDir).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('./src/app');

// We need to replace imports like:
// import { Order } from "../../services/orderService"
// with:
// import { Order } from "../../types"
// If it's import { Order, orderService } ..., we change to:
// import { orderService } from "../../services/orderService"
// import { Order } from "../../types"

const typesToMove = [
  'Order', 'CommunityPost', 'InvoiceSettings', 'BackupFile', 'Banner', 'Category', 'MenuItem', 'StockMovement', 'ManageableUserRole', 'ManagedUser', 'MyProfile', 'WalletTransaction', 'PaymentMethod', 'OrderStatus'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const typesRel = getRelativeTypesPath(file);
  
  let modified = false;

  // Let's just find any import line and check if it has these types
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('import ') && line.includes('service')) {
      for (const type of typesToMove) {
        if (line.includes(type)) {
          // It imports the type!
          // Remove the type from this line
          const regex = new RegExp(`\\b${type}\\b,?`, 'g');
          lines[i] = lines[i].replace(regex, '');
          lines[i] = lines[i].replace(/{\s*,/, '{').replace(/,\s*}/, '}').replace(/{\s*}/, '');
          
          // Add a new import line for this type
          lines.splice(i, 0, `import { ${type} } from "${typesRel}";`);
          i++;
          modified = true;
        }
      }
    }
    // Fix services/types -> types
    if (line.includes('services/types')) {
      lines[i] = line.replace(/services\/types/, 'types');
      modified = true;
    }
  }

  if (modified) {
    // clean up empty imports like import "" from ... or import from ...
    const finalLines = lines.filter(l => !l.match(/^import\s+from\s+/));
    fs.writeFileSync(file, finalLines.join('\n'));
    console.log(`Fixed imports in ${file}`);
  }
});
