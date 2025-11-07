# Interactive Migration Mode

## Overview

The migration tool now supports an interactive mode that prompts you to apply optional enhancements after a successful migration.

## Usage

Add the `--interactive` flag to your migration command:

```bash
ang-fix migrate 18 --interactive
```

## Features

### 1. Material Design 3 (M3) Update

When migrating to Angular 18+, you'll be prompted:

```
Would you like to apply optional enhancements?

  Update Angular Material to Material Design 3 (M3)? (y/N):
```

**What it does:**
- Searches for Material theme imports in `src/styles.scss`
- Replaces old prebuilt themes with M3 Azure Blue theme
- Example transformation:
  ```scss
  // Before
  @import '@angular/material/prebuilt-themes/indigo-pink.css';
  
  // After
  @import '@angular/material/prebuilt-themes/azure-blue.css';
  ```

**Supported file types:**
- ✅ `styles.scss` - Full support
- ℹ️ `styles.css` - Detection only (recommends SCSS for better theming)

### 2. Zoneless Change Detection

When migrating to Angular 18+, you'll be prompted:

```
  Enable experimental zoneless change detection? (y/N):
```

**What it does:**
- Updates `src/app/app.config.ts`
- Replaces `provideZoneChangeDetection()` with `provideExperimentalZonelessChangeDetection()`
- Updates imports from `@angular/core`

**Example transformation:**
```typescript
// Before
import { provideZoneChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // ...
  ]
};

// After
import { provideExperimentalZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    // ...
  ]
};
```

## Command Examples

### Basic Migration (No Prompts)
```bash
ang-fix migrate 18
```
Shows manual steps but doesn't prompt for action.

### Interactive Migration (With Prompts)
```bash
ang-fix migrate 18 --interactive
```
Prompts for M3 and zoneless updates after successful migration.

### Dry Run with Interactive Preview
```bash
ang-fix migrate 18 --dry-run --interactive
```
Note: Interactive prompts are skipped in dry-run mode.

### Skip Dependencies, Interactive Code Mods Only
```bash
ang-fix migrate 18 --skip-deps --interactive
```

## Answer Format

For each prompt, type your answer and press Enter:

- `y` or `yes` - Apply the enhancement
- `n`, `no`, or just Enter - Skip the enhancement

Examples:
```
Update Angular Material to Material Design 3 (M3)? (y/N): y
  🎨 Applying Material Design 3 updates...
  ✅ Updated Material theme to M3

Enable experimental zoneless change detection? (y/N): n
  Skipped zoneless change detection
```

## When to Use Interactive Mode

### ✅ Use Interactive Mode When:
- You want to apply optional Angular 18+ features immediately
- You're doing a one-time migration and want everything set up
- You understand the implications of M3 and zoneless changes
- You're working on a development branch with backup

### ⚠️ Don't Use Interactive Mode When:
- Running in CI/CD pipelines (use regular mode)
- You need to review changes manually first
- You're unsure about M3 or zoneless impacts
- Running automated scripts

## Behavior Notes

1. **Dry Run Mode**: Interactive prompts are automatically skipped
2. **Failed Migrations**: Prompts only appear on successful migrations
3. **File Detection**: If required files (styles.scss, app.config.ts) don't exist, enhancements are skipped with info messages
4. **Idempotent**: Running multiple times won't duplicate changes

## Manual Steps Detected

Interactive mode is triggered when these manual steps are detected:

1. `"Update Angular Material to Material Design 3 (M3)"` - Triggers M3 prompt
2. `"Optional: Enable experimental zoneless change detection"` - Triggers zoneless prompt

## Troubleshooting

### Material Theme Not Applied
**Problem:** "No Material theme import found, skipping"
**Solution:** Add a Material theme import to your `styles.scss` first:
```scss
@import '@angular/material/prebuilt-themes/indigo-pink.css';
```

### Zoneless Not Applied
**Problem:** "No zone configuration found, skipping"
**Solution:** Make sure your `app.config.ts` has `provideZoneChangeDetection()` configured

### Using styles.css Instead of styles.scss
**Problem:** "Found styles.css - M3 themes work best with SCSS"
**Solution:** Rename `styles.css` to `styles.scss` for better Material theming support

## Version Compatibility

| Feature | Angular 17 | Angular 18+ |
|---------|-----------|-------------|
| M3 Theme Update | ❌ | ✅ |
| Zoneless Change Detection | ❌ | ✅ |
| Interactive Mode | ✅ | ✅ |

## See Also

- [Migration README](./MIGRATION_README.md)
- [Peer Dependency Fixes](./PEER_DEPENDENCY_FIXES.md)
- [Quickstart Guide](./QUICKSTART.md)
