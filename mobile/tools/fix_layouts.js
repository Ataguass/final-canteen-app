const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '..', 'src', 'app', '(admin)', '_layout.tsx'),
  path.resolve(__dirname, '..', 'src', 'app', '(student)', '_layout.tsx'),
  path.resolve(__dirname, '..', 'src', 'app', '(student)', 'settings.tsx'),
];

function replaceColors(content) {
  content = content.replace(/#F8FAFC/g, 'colors.background');
  content = content.replace(/#EEF2F7/g, 'colors.headerBg');
  content = content.replace(/#FFFFFF/gi, 'colors.card');
  content = content.replace(/#0F172A/gi, 'colors.text');
  content = content.replace(/#64748B/gi, 'colors.textSecondary');
  content = content.replace(/#94A3B8/gi, 'colors.textMuted');
  content = content.replace(/#E2E8F0/gi, 'colors.border');
  content = content.replace(/#F1F5F9/gi, 'colors.surfaceAlt');
  
  // Clean up quotes where colors were inside quotes
  content = content.replace(/backgroundColor:\s*["']colors\.([a-zA-Z]+)["']/g, 'backgroundColor: colors.$1');
  content = content.replace(/color:\s*["']colors\.([a-zA-Z]+)["']/g, 'color: colors.$1');
  content = content.replace(/borderColor:\s*["']colors\.([a-zA-Z]+)["']/g, 'borderColor: colors.$1');
  content = content.replace(/borderTopColor:\s*["']colors\.([a-zA-Z]+)["']/g, 'borderTopColor: colors.$1');
  return content;
}

for (const filePath of files) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Add import
  if (!content.includes('useTheme')) {
    content = `import { useTheme } from '../../hooks/useTheme';\n` + content;
  }
  
  // Add hook if needed
  if (!content.includes('const { colors, isDark, toggleTheme } = useTheme();')) {
    content = content.replace(
      /export default function \w+Layout\(\) \{/,
      `$&
  const { colors, isDark, toggleTheme } = useTheme();`
    );
    // for settings screen
    content = content.replace(
      /export default function SettingsScreen\(\) \{/,
      `$&
  const { colors, isDark, toggleTheme } = useTheme();`
    );
  }

  // Admin layout specific toggle
  if (filePath.includes('(admin)') && content.includes('Dark mode is coming soon!')) {
    content = content.replace(
      /onPress=\{\(\) => Alert\.alert\("Dark Mode", "Dark mode is coming soon!"\)\}/,
      `onPress={toggleTheme}`
    );
    content = content.replace(
      /name="moon-outline"/,
      `name={isDark ? "sunny-outline" : "moon-outline"}`
    );
  }

  // Student settings specific toggle
  if (filePath.includes('settings.tsx')) {
    if (!content.includes('Dark Mode')) {
      const darkModeSwitch = `
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name="moon" size={20} color={colors.text} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>Dark Mode</Text>
                  <Text style={styles.rowSubtitle}>App appearance</Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={"#FFFFFF"}
              />
            </View>
            <View style={styles.divider} />`;
      content = content.replace(/<View style=\{styles\.row\}>/, darkModeSwitch + '\n            $&');
    }
  }

  content = replaceColors(content);
  fs.writeFileSync(filePath, content, 'utf-8');
}
