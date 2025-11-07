# Angular Advanced Migration Tool

[![npm version](https://badge.fury.io/js/ng-migration.svg)](https://www.npmjs.com/package/ng-migration)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A comprehensive, automated migration tool for upgrading Angular applications from version 17 to 20, with support for multi-step migrations, dependency management, and intelligent code transformations.

**Features both interactive TUI and automated migration workflows** — uses AST-based codemods for speed and reliability.

## 🚀 Quick Start

### Installation
```bash
npm install -g ng-migration
```

### Basic Usage
```bash
# Analyze migration requirements
ang-fix analyze 18

# Migrate to Angular 18
ang-fix migrate 18

# Preview migration without changes
ang-fix migrate 19 --dry-run
```

## ✨ Key Features

- **🎯 Multi-Version Support**: Migrate between Angular 17, 18, 19, and 20
- **🔍 Intelligent Analysis**: Deep project analysis with compatibility checks
- **📦 Automated Dependencies**: Smart dependency version management
- **🔧 Advanced Codemods**: Version-specific code transformations
- **🛡️ Safe Migration**: Automatic backup creation and rollback support
- **📊 Interactive UI**: Terminal-based interactive migration wizard
- **👀 Dry Run Mode**: Preview changes before applying them
- **📈 Comprehensive Reporting**: Detailed migration reports and recommendations

### Supported Migrations

- **Standalone Components** (Angular 17+) — Adds `standalone: true` to components
- **Remove moduleId** (Angular 17+) — Removes deprecated `moduleId` property
- **RxJS Imports** — Detects old RxJS import patterns
- **inject() Function** — Suggests migrating from constructor DI to `inject()`
- **Import Fixes** — Ensures proper Angular imports

## Quick Start

```bash
# Install dependencies
npm install

# Interactive mode (recommended)
npm run interactive

# Or use ts-node directly
npm run dev -- --interactive

# Scan for issues only
npm run dev -- --scan --path "src/**/*.ts"

# Auto-fix all issues
npm run dev -- --fix --path "src/**/*.ts"

# Legacy dry-run mode
npm run smoke
```

## Usage Modes

### 1. Interactive Mode (Recommended)

```bash
npm run interactive
```

- Browse all detected issues
- See issue details and severity
- Choose which fixes to apply
- Real-time feedback

### 2. Scan Mode

```bash
npm run dev -- --scan --path "src/**/*.ts"
```

Detects and lists all issues without making changes.

### 3. Auto-fix Mode

```bash
npm run build
node dist/cli.js --fix --path "src/**/*.ts"
```

Automatically applies all fixable issues.

### 4. Legacy Mode

```bash
npm run dev -- --path "src/**/*.ts" --dry-run
```

Original behavior showing file-by-file diffs.

## Build and Deploy

```bash
# Build TypeScript
npm run build

# Run built CLI
node dist/cli.js --interactive

# Or install globally
npm link
ang-fix --interactive
```

## Issue Severity Levels

- 🔴 **ERROR** — Must fix (breaking changes)
- 🟡 **WARNING** — Should fix (deprecated features)
- 🔵 **INFO** — Consider fixing (suggestions)

## Angular Version Support

This tool is optimized for Angular 17-20 migrations:

- **Angular 17** — Standalone components, signals, new control flow
- **Angular 18** — Enhanced signals, better TypeScript support
- **Angular 19** — Performance improvements, new APIs
- **Angular 20** — Latest features

## Editor Integration

If VS Code still shows old type errors after installing dependencies or changing `tsconfig.json`:

1. Open Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Run: "TypeScript: Restart TS Server"

This forces the editor to reload configuration and type definitions.

## Architecture

- **src/codemods/** — Individual migration rules
- **src/detector.ts** — Issue scanning engine
- **src/ui/** — Interactive TUI components (React/Ink)
- **src/cli.ts** — CLI entry point
- **src/types.ts** — TypeScript interfaces

## Extending

Add new codemods in `src/codemods/`:

```typescript
import { Codemod, CodemodResult } from '../types';

export const myMigration: Codemod = {
  name: 'my-rule',
  description: 'Description of what it fixes',
  version: '18+',
  apply: (sourceFile, filePath) => {
    // Your AST transformation logic
    return { changed: false, issues: [] };
  }
};
```

Then add to `src/codemods/index.ts`.

# angular-migration-tool
