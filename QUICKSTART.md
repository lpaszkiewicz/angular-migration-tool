# Quick Start Guide — Angular Fixer

## Installation

```bash
cd project
npm install
```

## Usage Examples

### 1. Scan Your Angular Project (Recommended First Step)

```bash
npm run dev -- --scan --path "src/**/*.ts"
```

This will:
- Analyze all TypeScript files
- Detect Angular 17-20 migration issues
- Show severity levels (ERROR/WARNING/INFO)
- Count how many issues can be auto-fixed

Example output:
```
Scanned 45 files
Found 12 issues in 8 files
10 issues can be auto-fixed

Issues:
  🔧 [ERROR] moduleId is deprecated and should be removed (Angular 17+)
     src/app/component.ts:15
  🔧 [WARNING] Component should migrate to standalone (Angular 17+)
     src/app/component.ts:10
  ℹ️ [INFO] Consider migrating constructor DI to inject()
     src/app/service.ts:25
```

### 2. Auto-Fix All Issues

```bash
npm run dev -- --fix --path "src/**/*.ts"
```

This will automatically apply all fixable changes:
- Remove `moduleId`
- Add `standalone: true`
- Fix imports
- And more...

### 3. Interactive Mode (TUI)

```bash
npm run interactive
```

Or:
```bash
npm run dev -- --interactive --path "src/**/*.ts"
```

This launches a beautiful terminal UI where you can:
- Browse all detected issues
- Select individual issues to review
- Choose which fixes to apply
- See real-time feedback

**Note:** Interactive mode requires React/Ink dependencies to be properly installed.

### 4. Build and Use Production CLI

```bash
# Build the project
npm run build

# Run the built CLI
node dist/cli.js --scan --path "src/**/*.ts"
node dist/cli.js --fix --path "src/**/*.ts"

# Or install globally
npm link
ang-fix --scan
```

## Common Patterns

### Check Specific Files

```bash
npm run dev -- --scan --path "src/app/components/**/*.ts"
```

### Dry Run (Preview Without Changes)

```bash
# Legacy mode shows file diffs
npm run dev -- --path "src/**/*.ts" --dry-run
```

### Fix Only Component Files

```bash
npm run dev -- --fix --path "src/**/*.component.ts"
```

## Issue Types Detected

| Rule | Severity | Auto-Fix | Description |
|------|----------|----------|-------------|
| `remove-module-id` | ERROR | ✅ | Removes deprecated `moduleId` |
| `standalone-components` | WARNING | ✅ | Adds `standalone: true` |
| `rxjs-imports` | ERROR/WARNING | ❌ | Detects old RxJS patterns |
| `inject-function` | INFO | ❌ | Suggests inject() migration |
| `import-fixes` | INFO | ✅ | Adds missing imports |

## Workflow Recommendation

1. **Backup your code** (git commit)
2. **Scan** to see what needs fixing:
   ```bash
   npm run dev -- --scan
   ```
3. **Review** the issues (note severity levels)
4. **Apply fixes**:
   ```bash
   npm run dev -- --fix
   ```
5. **Test** your application
6. **Run again** to check for remaining issues

## Troubleshooting

### "Cannot find module 'ink'" Error

If you see this when trying interactive mode:
```bash
npm install
```

The UI dependencies should install automatically.

### TypeScript Errors in Editor

After changes, restart TypeScript server:
- VS Code: Ctrl+Shift+P → "TypeScript: Restart TS Server"

### No Issues Found

Great! Your code is already Angular 17-20 compatible. Run with different paths if you want to check specific areas:

```bash
npm run dev -- --scan --path "src/**/*.{ts,html}"
```

## Next Steps

- Add custom codemods in `src/codemods/`
- Extend the detector for project-specific rules
- Run before/after Angular upgrades
- Integrate into CI/CD pipelines
