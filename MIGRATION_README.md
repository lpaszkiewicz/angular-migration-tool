# Angular Advanced Migration Tool

A comprehensive, automated migration tool for upgrading Angular applications from version 17 to 20, with support for multi-step migrations, dependency management, and intelligent code transformations.

## Features

- **Multi-Version Support**: Migrate between Angular 17, 18, 19, and 20
- **Intelligent Analysis**: Deep project analysis with compatibility checks
- **Automated Dependency Updates**: Smart dependency version management
- **Advanced Codemods**: Version-specific code transformations
- **Safe Migration**: Automatic backup creation and rollback support
- **Interactive UI**: Terminal-based interactive migration wizard
- **Dry Run Mode**: Preview changes before applying them
- **Comprehensive Reporting**: Detailed migration reports and recommendations

## Quick Start

### Install
```bash
npm install -g angular-migration-tool
```

### Basic Usage
```bash
# Analyze migration requirements
ang-fix analyze 18

# Migrate to Angular 18
ang-fix migrate 18

# Preview migration without changes
ang-fix migrate 19 --dry-run

# Multi-step migration (17 → 20 via 18, 19)
ang-fix migrate 20
```

## Migration Paths

### Angular 17 → 18
- **Control Flow Migration**: `*ngIf` → `@if`, `*ngFor` → `@for`, `*ngSwitch` → `@switch`
- **Event Replay**: Enable event replay for better hydration performance
- **Material Design 3**: Upgrade to Material Design 3 theming
- **Dependency Updates**: Update to Angular 18 compatible versions

### Angular 18 → 19
- **Standalone by Default**: Ensure standalone component architecture
- **Incremental Hydration**: Enable incremental hydration features
- **Modern Bundling**: Upgrade to esbuild-based bundling
- **Signal APIs**: Prepare for enhanced signal-based APIs

### Angular 19 → 20
- **Full Signal Migration**: Convert `@Input()`/`@Output()` → `input()`/`output()`
- **Zoneless Change Detection**: Enable zoneless change detection by default
- **Advanced Optimizations**: Tree-shaking and bundle optimizations
- **Zone.js Removal**: Remove zone.js dependency when using zoneless mode

## Command Reference

### `migrate <target>`
Perform a complete migration to the target Angular version.

```bash
ang-fix migrate 18 [options]
```

**Options:**
- `--dry-run`: Preview migration without making changes
- `--no-backup`: Skip creating project backup
- `--skip-tests`: Skip running tests after each step
- `--skip-deps`: Skip dependency updates
- `--skip-codemods`: Skip code transformations
- `--continue-on-error`: Continue migration even if a step fails
- `--test-each-step`: Run tests after each migration step
- `--exclude-codemods <list>`: Exclude specific codemods
- `--only-codemods <list>`: Only run specified codemods

### `analyze <target>`
Analyze migration requirements without performing the migration.

```bash
ang-fix analyze 19
```

### `versions`
List supported Angular versions and migration paths.

```bash
ang-fix versions
```

### Legacy Commands
The tool maintains backward compatibility with existing commands:

```bash
ang-fix --scan              # Scan for issues
ang-fix --fix               # Apply fixes
ang-fix --interactive       # Interactive mode
```

## Migration Process

### 1. Pre-Migration Analysis
- Detect current Angular version
- Analyze project structure and dependencies
- Identify compatibility issues
- Generate migration plan with time estimates

### 2. Backup Creation
- Create full project backup
- Store backup path for potential rollback

### 3. Step-by-Step Migration
For each version step (e.g., 17→18, 18→19):
- Run pre-migration tasks
- Update package.json dependencies
- Execute `ng update` commands
- Apply version-specific codemods
- Run post-migration tasks
- Optionally run tests

### 4. Verification
- Verify dependency installation
- Check for remaining issues
- Generate completion report

## Advanced Features

### Dependency Management
- **Smart Version Resolution**: Automatically resolves compatible dependency versions
- **Peer Dependency Handling**: Manages peer dependencies and version conflicts  
- **Package Manager Detection**: Supports npm, yarn, and pnpm
- **Compatibility Checks**: Validates Node.js and TypeScript version requirements

### Code Transformations (Codemods)
- **Template Migrations**: Transform Angular templates to new syntax
- **Component Migrations**: Update component decorators and lifecycle hooks
- **Service Migrations**: Modernize service injection patterns
- **Import Optimizations**: Clean up and optimize import statements

### Safety Features
- **Atomic Operations**: Each migration step is atomic and reversible
- **Backup & Restore**: Automatic backup creation with restore capability
- **Dry Run Mode**: Preview all changes before applying them
- **Error Recovery**: Graceful error handling with detailed error messages

## Configuration

### Project Structure Requirements
```
your-angular-project/
├── package.json          # Required: Angular dependencies
├── angular.json         # Optional: Angular CLI configuration
├── tsconfig.json        # Required: TypeScript configuration
└── src/
    ├── main.ts          # Required: Application bootstrap
    └── app/             # Application code
```

### Supported Project Types
- **Applications**: Standard Angular applications with `ng serve`/`ng build`
- **Libraries**: Angular libraries with `ng-packagr`
- **Workspaces**: Angular CLI workspaces with multiple projects

## Examples

### Basic Migration
```bash
# Migrate from Angular 17 to 18
ang-fix migrate 18
```

### Advanced Migration with Options
```bash
# Dry run migration to Angular 20 with custom options
ang-fix migrate 20 \
  --dry-run \
  --test-each-step \
  --exclude-codemods "fullSignalMigration" \
  --continue-on-error
```

### Analysis Only
```bash
# Analyze migration complexity
ang-fix analyze 19
```

Output:
```
📊 Project Analysis:
  Current Angular version: 17
  Project type: application
  Uses standalone components: No
  Uses Angular Material: Yes
  Node.js version: v20.9.0

📋 Migration Analysis:
  Migration path: 18 → 19
  Estimated complexity: medium
  Estimated time: 4 hours
  Issues found: 3

💡 Recommendations:
  • Create a backup of your project before starting migration
  • Consider migrating to standalone components for Angular 19+
  • Review Material Design updates and theme changes
```

## Troubleshooting

### Common Issues

**Migration fails with dependency conflicts:**
```bash
# Skip dependency updates and handle manually
ang-fix migrate 18 --skip-deps
```

**Tests fail after migration:**
```bash
# Run migration without running tests
ang-fix migrate 18 --skip-tests
```

**Codemods cause issues:**
```bash
# Exclude problematic codemods
ang-fix migrate 18 --exclude-codemods "controlFlowMigration,eventReplayMigration"
```

### Restore from Backup
If migration fails, restore from the automatic backup:
```bash
# The tool will show the backup path in case of failure
cp -r /path/to/backup/* ./
```

### Manual Steps
Some breaking changes require manual intervention:
- Material Design 3 theme configuration
- Custom change detection strategies
- Third-party library compatibility
- Application-specific optimizations

## Development

### Project Structure
```
src/
├── cli.ts                    # Command-line interface
├── migration/
│   ├── versions.ts           # Angular version definitions
│   ├── detector.ts           # Project analysis and detection
│   ├── dependencies.ts       # Dependency management
│   ├── orchestrator.ts       # Migration coordination
│   └── codemods/
│       ├── index.ts          # Codemod organization
│       ├── angular18.ts      # Angular 17→18 codemods
│       ├── angular19.ts      # Angular 18→19 codemods
│       └── angular20.ts      # Angular 19→20 codemods
└── ui/                       # Interactive terminal UI
```

### Adding New Codemods
1. Create codemod in appropriate version file
2. Implement `Codemod` interface
3. Add to version-specific exports
4. Update `MIGRATION_CODEMODS` in `index.ts`

### Testing
```bash
# Run tests
npm test

# Test migration on sample project
npm run smoke

# Interactive development
npm run dev -- migrate 18 --dry-run
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details.