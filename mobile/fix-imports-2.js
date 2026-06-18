const fs = require('fs');

const files = [
  'src/app/(admin)/_layout.tsx',
  'src/app/(admin)/community/index.tsx',
  'src/app/(admin)/pos.tsx',
  'src/app/(admin)/profile/backups.tsx',
  'src/app/(admin)/profile/banners.tsx',
  'src/app/(admin)/profile/invoice-settings.tsx',
  'src/app/(admin)/profile/menu-manage.tsx',
  'src/app/(admin)/profile/reports.tsx',
  'src/app/(admin)/profile/stock.tsx',
];

files.forEach(f => {
  let code = fs.readFileSync(f, 'utf8');

  // Clean empty types like `type  }` or `{ type }`
  code = code.replace(/type\s*,?\s*}/g, '}');
  code = code.replace(/{\s*,/g, '{');
  code = code.replace(/,\s*}/g, '}');
  code = code.replace(/import\s+{\s*}\s+from\s+["'].*?["'];?\n?/g, '');

  // Fix pos.tsx specific
  if (f.includes('pos.tsx')) {
    code = code.replace(/import\s+{\s*Order\s*}\s+from\s+"..\/..\/types";\nimport\s+{\s*Order\s*}\s+from\s+"..\/..\/types";/, 'import { Order } from "../../types";');
    code = code.replace(/import\s+{\s*PaymentMethod\s*}\s+from\s+"..\/..\/types";\nimport\s+{\s*PaymentMethod,\s*PaymentStatus\s*}\s+from\s+"..\/..\/types";/, 'import { PaymentMethod, PaymentStatus } from "../../types";');
  }

  // Fix reports.tsx specific
  if (f.includes('reports.tsx')) {
    code = code.replace(/import\s+{\s*PaymentMethod\s*}\s+from\s+"..\/..\/..\/types";\nimport\s+{\s*PaymentMethod,\s*PaymentStatus\s*}\s+from\s+"..\/..\/..\/types";/, 'import { PaymentMethod, PaymentStatus } from "../../../types";');
  }

  // Fix _layout.tsx specific
  if (f.includes('_layout.tsx')) {
    // If it did `import orderService from ...` instead of `import { orderService }`
    code = code.replace(/import\s+orderService\s+from\s+["']\.\.\/\.\.\/services\/orderService["']/, 'import { orderService } from "../../services/orderService"');
  }

  fs.writeFileSync(f, code);
});
