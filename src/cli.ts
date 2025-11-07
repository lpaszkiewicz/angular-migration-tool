#!/usr/bin/env node
import { Command } from 'commander';
import { runFixes } from './fixer';
import { scanForIssues, applyFixes } from './detector';
import { MigrationOrchestrator } from './migration/orchestrator';
import * as packageJson from '../package.json';

const program = new Command();

program
  .name('ang-fix')
  .version(packageJson.version)
  .description('Advanced Angular 17-20 migration tool with interactive TUI and automated migrations')
  .option('-i, --interactive', 'Start interactive mode with TUI', false)
  .option('-d, --dry-run', 'Show changes without writing files (legacy mode)', true)
  .option('-p, --path <glob>', 'Glob for files to process', 'src/**/*.ts')
  .option('--scan', 'Scan for issues without fixing', false)
  .option('--fix', 'Apply all fixable issues', false);

// Migration commands
program
  .command('migrate')
  .description('Migrate Angular application to a target version')
  .argument('<target>', 'Target Angular version (17, 18, 19, or 20)')
  .option('--dry-run', 'Preview migration without making changes', false)
  .option('--no-backup', 'Skip creating project backup', false)
  .option('--skip-tests', 'Skip running tests after each step', false)
  .option('--skip-deps', 'Skip dependency updates', false)
  .option('--skip-codemods', 'Skip code transformations', false)
  .option('--continue-on-error', 'Continue migration even if a step fails', false)
  .option('--test-each-step', 'Run tests after each migration step', false)
  .option('--no-peer-resolution', 'Skip peer dependency conflict resolution', false)
  .option('--allow-peer-overrides', 'Allow package overrides/resolutions for peer conflicts', false)
  .option('--interactive', 'Prompt for optional enhancements (M3, zoneless, etc.)', false)
  .option('--exclude-codemods <codemods...>', 'Exclude specific codemods')
  .option('--only-codemods <codemods...>', 'Only run specified codemods')
  .action(async (target, options) => {
    const targetVersion = parseInt(target, 10);
    
    if (![17, 18, 19, 20].includes(targetVersion)) {
      console.error('❌ Invalid target version. Supported versions: 17, 18, 19, 20');
      process.exit(1);
    }

    const orchestrator = new MigrationOrchestrator();
    
    try {
      const result = await orchestrator.migrate(targetVersion, {
        dryRun: options.dryRun,
        createBackup: options.backup,
        skipTests: options.skipTests,
        skipDependencies: options.skipDeps,
        skipCodeMods: options.skipCodemods,
        continueOnError: options.continueOnError,
        runTestsAfterEachStep: options.testEachStep,
        resolvePeerConflicts: !options.noPeerResolution,
        allowPeerConflictOverrides: options.allowPeerOverrides,
        interactive: options.interactive,
        excludeCodemods: options.excludeCodemods,
        customCodemods: options.onlyCodemods
      });
      
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      console.error('❌ Migration failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze migration requirements without performing it')
  .argument('<target>', 'Target Angular version (17, 18, 19, or 20)')
  .action(async (target) => {
    const targetVersion = parseInt(target, 10);
    
    if (![17, 18, 19, 20].includes(targetVersion)) {
      console.error('❌ Invalid target version. Supported versions: 17, 18, 19, 20');
      process.exit(1);
    }

    const orchestrator = new MigrationOrchestrator();
    
    try {
      await orchestrator.analyze(targetVersion);
    } catch (error) {
      console.error('❌ Analysis failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('check-conflicts')
  .description('Analyze peer dependency conflicts for a target version')
  .argument('<target>', 'Target Angular version (17, 18, 19, or 20)')
  .option('--resolve', 'Attempt to resolve conflicts automatically', false)
  .action(async (target, options) => {
    const targetVersion = parseInt(target, 10);
    
    if (![17, 18, 19, 20].includes(targetVersion)) {
      console.error('❌ Invalid target version. Supported versions: 17, 18, 19, 20');
      process.exit(1);
    }

    const { MigrationDetector } = await import('./migration/detector');
    const { DependencyMigrator } = await import('./migration/dependencies');
    const { getMigrationChain } = await import('./migration/versions');

    try {
      const detector = new MigrationDetector();
      const dependencyMigrator = new DependencyMigrator();
      const project = await detector.analyzeProject();
      
      if (!project.currentAngularVersion) {
        console.error('❌ Could not detect current Angular version');
        process.exit(1);
      }

      const migrationChain = getMigrationChain(project.currentAngularVersion, targetVersion);
      
      console.log(`🔍 Analyzing peer dependency conflicts for migration to Angular ${targetVersion}...`);
      
      for (let i = 0; i < migrationChain.length; i++) {
        const migration = migrationChain[i];
        console.log(`\n📦 Step ${i + 1}: Angular ${migration.from} → ${migration.to}`);
        
        const conflicts = await dependencyMigrator.analyzePeerDependencyConflicts(migration);
        
        if (conflicts.conflicts.length === 0) {
          console.log('  ✅ No peer dependency conflicts detected');
        } else {
          console.log(`  ⚠️  Found ${conflicts.conflicts.length} conflict(s):`);
          
          for (const conflict of conflicts.conflicts) {
            console.log(`    • ${conflict.packageName}: ${conflict.reasoning}`);
            console.log(`      Strategy: ${conflict.resolutionStrategy}`);
            if (conflict.recommendedVersion) {
              console.log(`      Recommended: ${conflict.recommendedVersion}`);
            }
          }
          
          if (options.resolve && conflicts.canAutoResolve) {
            console.log('\n  🔧 Attempting to resolve conflicts...');
            const result = await dependencyMigrator.resolvePeerDependencyConflicts(conflicts, true);
            
            if (result.success) {
              console.log('  ✅ Conflicts can be automatically resolved');
              console.log(`  Updated packages: ${result.updated.join(', ')}`);
            } else {
              console.log('  ❌ Auto-resolution failed');
              result.errors.forEach(error => console.log(`    Error: ${error}`));
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Conflict analysis failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('versions')
  .description('List supported Angular versions and migration paths')
  .action(() => {
    console.log('🔧 Angular Migration Tool - Supported Versions');
    console.log('');
    console.log('Available migration paths:');
    console.log('  📦 Angular 17 → 18: Control flow syntax, event replay, Material Design 3');
    console.log('  📦 Angular 18 → 19: Standalone by default, incremental hydration, modern bundling');  
    console.log('  📦 Angular 19 → 20: Full signal migration, zoneless change detection');
    console.log('');
    console.log('Multi-step migrations are supported (e.g., 17 → 20 will go through 17→18→19→20)');
    console.log('');
    console.log('Examples:');
    console.log('  ang-fix migrate 18              # Migrate to Angular 18');
    console.log('  ang-fix migrate 18 --interactive # Migrate with prompts for M3 & zoneless');
    console.log('  ang-fix migrate 20 --dry-run    # Preview migration to Angular 20');
    console.log('  ang-fix analyze 19              # Analyze migration requirements to Angular 19');
    console.log('  ang-fix check-conflicts 20      # Check peer dependency conflicts for Angular 20');
  });

program.parse(process.argv);

// Handle legacy options if no subcommand is used
if (!process.argv.includes('migrate') && !process.argv.includes('analyze') && !process.argv.includes('versions')) {
  const opts = program.opts();

  (async () => {
    try {
      if (opts.interactive) {
        console.log('⚠️  Interactive mode temporarily unavailable in this version');
        console.log('Use --scan and --fix commands instead, or try the new migration commands:');
        console.log('  ang-fix migrate --help');
        process.exit(0);
      } else if (opts.scan) {
        // Scan mode: just detect issues
        console.log('Scanning for Angular migration issues...\n');
        const result = await scanForIssues(opts.path);
        
        console.log(`Scanned ${result.totalFiles} files`);
        console.log(`Found ${result.issues.length} issues in ${result.filesWithIssues} files`);
        console.log(`${result.fixableIssues} issues can be auto-fixed\n`);
        
        if (result.issues.length > 0) {
          console.log('Issues:');
          result.issues.forEach(issue => {
            const icon = issue.fixAvailable ? '🔧' : 'ℹ️';
            console.log(`  ${icon} [${issue.severity.toUpperCase()}] ${issue.message}`);
            console.log(`     ${issue.filePath}:${issue.line}`);
          });
          console.log('\nRun with --fix to apply auto-fixes or --interactive for TUI mode');
          console.log('Or try the new migration commands: ang-fix migrate --help');
        }
      } else if (opts.fix) {
        // Auto-fix mode
        console.log('Applying fixes...\n');
        const results = await applyFixes(opts.path, { dryRun: false });
        
        console.log(`Fixed ${results.length} files`);
        results.forEach(result => {
          console.log(`  ✓ ${result.filePath} (${result.issuesFixed.length} issues fixed)`);
        });
      } else {
        // Legacy mode (old behavior) or show help
        if (Object.keys(opts).length === 0) {
          program.help();
        } else {
          await runFixes(opts.path, !!opts.dryRun);
        }
      }
    } catch (err) {
      console.error('Error:', err);
      process.exitCode = 1;
    }
  })();
}
