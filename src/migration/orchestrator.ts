/**
 * Angular Migration Orchestrator
 * Coordinates the entire migration process from analysis to completion
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { MigrationDetector, MigrationAnalysis, ProjectAnalysis, MigrationIssue } from './detector';
import { DependencyMigrator, DependencyUpdateResult, ConflictResolution } from './dependencies';
import { getMigrationChain, MigrationPath } from './versions';
import { getCodemodsForMigrationPath } from './codemods';
import { scanForIssues, applyFixes } from '../detector';

export interface MigrationStep {
  stepNumber: number;
  migration: MigrationPath;
  description: string;
  dependencies: DependencyUpdateResult | null;
  codeChanges: any[] | null;
  issues: MigrationIssue[];
  success: boolean;
  error?: string;
  duration?: number;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  steps: MigrationStep[];
  totalDuration: number;
  summary: {
    dependenciesUpdated: number;
    filesModified: number;
    issuesFixed: number;
    manualStepsRequired: string[];
  };
  backupPath?: string;
}

export interface MigrationOptions {
  dryRun?: boolean;
  skipTests?: boolean;
  skipDependencies?: boolean;
  skipCodeMods?: boolean;
  createBackup?: boolean;
  continueOnError?: boolean;
  runTestsAfterEachStep?: boolean;
  customCodemods?: string[];
  excludeCodemods?: string[];
  resolvePeerConflicts?: boolean;
  allowPeerConflictOverrides?: boolean;
  interactive?: boolean;
  autoApplyOptionalSteps?: boolean;
}

export class MigrationOrchestrator {
  private detector: MigrationDetector;
  private dependencyMigrator: DependencyMigrator;
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.detector = new MigrationDetector(this.projectRoot);
    this.dependencyMigrator = new DependencyMigrator(this.projectRoot);
  }

  /**
   * Perform a complete migration from current version to target version
   */
  async migrate(targetVersion: number, options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    
    console.log(`🚀 Starting Angular migration to version ${targetVersion}`);
    
    // Analyze current project
    const project = await this.detector.analyzeProject();
    const analysis = await this.detector.analyzeMigration(targetVersion);
    
    if (!analysis.isValid || !analysis.currentVersion) {
      return {
        success: false,
        fromVersion: analysis.currentVersion || 0,
        toVersion: targetVersion,
        steps: [],
        totalDuration: Date.now() - startTime,
        summary: {
          dependenciesUpdated: 0,
          filesModified: 0,
          issuesFixed: 0,
          manualStepsRequired: []
        }
      };
    }

    // Create backup if requested
    const backupPath = options.createBackup !== false 
      ? await this.createProjectBackup() 
      : undefined;

    // Get migration chain
    const migrationChain = getMigrationChain(analysis.currentVersion, targetVersion);
    const steps: MigrationStep[] = [];

    console.log(`📋 Migration plan: ${migrationChain.map(m => `${m.from}→${m.to}`).join(' → ')}`);
    console.log(`⏱️  Estimated time: ${analysis.estimatedTimeHours} hours`);
    console.log(`🔧 Complexity: ${analysis.estimatedComplexity}`);

    // Execute migration steps
    let success = true;
    for (let i = 0; i < migrationChain.length; i++) {
      const migration = migrationChain[i];
      console.log(`\n📦 Step ${i + 1}/${migrationChain.length}: Migrating from Angular ${migration.from} to ${migration.to}`);
      
      const step = await this.executeMigrationStep(migration, i + 1, options);
      steps.push(step);
      
      if (!step.success && !options.continueOnError) {
        success = false;
        break;
      }

      // Run tests after each step if requested
      if (options.runTestsAfterEachStep && !options.dryRun) {
        await this.runTests(step);
      }
    }

    const totalDuration = Date.now() - startTime;
    const summary = this.generateSummary(steps);

    const result: MigrationResult = {
      success,
      fromVersion: analysis.currentVersion,
      toVersion: targetVersion,
      steps,
      totalDuration,
      summary,
      backupPath
    };

    await this.printMigrationSummary(result, options);
    return result;
  }

  /**
   * Analyze migration without performing it
   */
  async analyze(targetVersion: number): Promise<MigrationAnalysis> {
    console.log(`🔍 Analyzing migration to Angular ${targetVersion}`);
    
    const project = await this.detector.analyzeProject();
    const analysis = await this.detector.analyzeMigration(targetVersion);
    
    this.printAnalysisReport(project, analysis);
    return analysis;
  }

  /**
   * Execute a single migration step
   */
  private async executeMigrationStep(
    migration: MigrationPath, 
    stepNumber: number,
    options: MigrationOptions
  ): Promise<MigrationStep> {
    const stepStartTime = Date.now();
    const step: MigrationStep = {
      stepNumber,
      migration,
      description: migration.description,
      dependencies: null,
      codeChanges: null,
      issues: [],
      success: true
    };

    try {
      // Pre-migration tasks
      if (migration.preMigrationTasks && !options.dryRun) {
        console.log('  🔧 Running pre-migration tasks...');
        await this.runTasks(migration.preMigrationTasks);
      }

      // Update dependencies
      if (!options.skipDependencies) {
        console.log('  📦 Updating dependencies...');
        
        // Check for peer dependency conflicts first
        let conflictResolution: ConflictResolution | null = null;
        if (options.resolvePeerConflicts !== false) {
          console.log('  🔍 Analyzing peer dependency conflicts...');
          conflictResolution = await this.dependencyMigrator.analyzePeerDependencyConflicts(migration);
          
          if (conflictResolution.conflicts.length > 0) {
            console.log(`  ⚠️  Found ${conflictResolution.conflicts.length} peer dependency conflict(s)`);
            
            if (conflictResolution.canAutoResolve) {
              console.log('  🔧 Resolving peer dependency conflicts...');
              const conflictResult = await this.dependencyMigrator.resolvePeerDependencyConflicts(
                conflictResolution, 
                options.dryRun || false
              );
              
              if (!conflictResult.success) {
                step.success = false;
                step.error = `Peer dependency resolution failed: ${conflictResult.errors.join(', ')}`;
                return step;
              }
            } else if (!options.allowPeerConflictOverrides) {
              console.log('  ❌ Cannot auto-resolve peer conflicts and overrides not allowed');
              step.success = false;
              step.error = `Peer dependency conflicts require manual resolution: ${conflictResolution.resolutions.manualSteps?.join(', ')}`;
              return step;
            }
          }
        }
        
        step.dependencies = await this.dependencyMigrator.updateDependencies(migration, {
          dryRun: options.dryRun,
          backup: false // We already created a project backup
        });
        
        if (!step.dependencies.success) {
          step.success = false;
          step.error = `Dependency update failed: ${step.dependencies.errors.join(', ')}`;
        }
        
        // Report conflict resolution results
        if (conflictResolution && conflictResolution.conflicts.length > 0) {
          step.issues.push(...this.convertConflictsToIssues(conflictResolution, stepNumber));
        }
      }

      // Apply codemods
      if (!options.skipCodeMods && step.success) {
        console.log('  🔄 Applying code transformations...');
        step.codeChanges = await this.applyCodemods(migration, options);
      }

      // Post-migration tasks
      if (migration.postMigrationTasks && !options.dryRun && step.success) {
        console.log('  ✅ Running post-migration tasks...');
        await this.runTasks(migration.postMigrationTasks);
      }

      // Collect issues from breaking changes that require manual intervention
      step.issues = migration.breakingChanges
        .filter(change => !change.autoFixable)
        .map(change => ({
          id: change.id,
          severity: change.impact === 'high' ? 'error' : 'warning' as 'error' | 'warning',
          category: 'breaking-change' as const,
          title: change.description,
          description: change.manualSteps?.join('\n') || 'Manual intervention required',
          autoFixable: false,
          migrationStep: stepNumber
        }));

    } catch (error) {
      step.success = false;
      step.error = error instanceof Error ? error.message : String(error);
    } finally {
      step.duration = Date.now() - stepStartTime;
    }

    return step;
  }

  /**
   * Apply codemods for a migration step
   */
  private async applyCodemods(migration: MigrationPath, options: MigrationOptions): Promise<any[]> {
    const codemods = getCodemodsForMigrationPath(migration.from, migration.to);
    const filteredCodemods = codemods.filter(codemod => {
      if (options.excludeCodemods?.includes(codemod.name)) return false;
      if (options.customCodemods?.length && !options.customCodemods.includes(codemod.name)) return false;
      return true;
    });

    console.log(`    Applying ${filteredCodemods.length} codemods...`);
    
    // Use existing codemod application logic
    const pattern = 'src/**/*.ts';
    const results = await applyFixes(pattern, { 
      dryRun: options.dryRun || false 
    });

    return results;
  }

  /**
   * Run shell tasks
   */
  private async runTasks(tasks: string[]): Promise<void> {
    for (const task of tasks) {
      try {
        console.log(`    Running: ${task}`);
        execSync(task, { cwd: this.projectRoot, stdio: 'pipe' });
      } catch (error) {
        console.warn(`    ⚠️  Task failed: ${task}`);
        // Don't throw - tasks are often optional
      }
    }
  }

  /**
   * Run tests and report results
   */
  private async runTests(step: MigrationStep): Promise<void> {
    try {
      console.log('  🧪 Running tests...');
      execSync('npm test -- --watch=false', { 
        cwd: this.projectRoot, 
        stdio: 'pipe' 
      });
      console.log('  ✅ Tests passed');
    } catch (error) {
      console.warn('  ⚠️  Tests failed - please review and fix before continuing');
    }
  }

  /**
   * Create a full project backup
   */
  private async createProjectBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.projectRoot, '..', `${path.basename(this.projectRoot)}-backup-${timestamp}`);
    
    console.log(`💾 Creating backup at ${backupDir}`);
    
    // Use system copy command for better performance
    const sourceDir = this.projectRoot;
    try {
      if (process.platform === 'win32') {
        execSync(`xcopy "${sourceDir}" "${backupDir}" /E /I /H /Y`, { stdio: 'pipe' });
      } else {
        execSync(`cp -r "${sourceDir}" "${backupDir}"`, { stdio: 'pipe' });
      }
    } catch (error) {
      console.warn('⚠️  Backup creation failed, continuing without backup');
      return '';
    }
    
    return backupDir;
  }

  /**
   * Generate migration summary
   */
  private generateSummary(steps: MigrationStep[]): MigrationResult['summary'] {
    let dependenciesUpdated = 0;
    let filesModified = 0;
    let issuesFixed = 0;
    const manualStepsRequired: string[] = [];

    for (const step of steps) {
      if (step.dependencies?.success) {
        dependenciesUpdated += step.dependencies.updated.length;
      }
      
      if (step.codeChanges) {
        filesModified += step.codeChanges.length;
        issuesFixed += step.codeChanges.reduce((sum, change) => sum + (change.issuesFixed?.length || 0), 0);
      }
      
      step.issues.forEach(issue => {
        if (!issue.autoFixable) {
          manualStepsRequired.push(`${step.migration.to}: ${issue.title}`);
        }
      });
    }

    return {
      dependenciesUpdated,
      filesModified,
      issuesFixed,
      manualStepsRequired
    };
  }

  /**
   * Print analysis report
   */
  private printAnalysisReport(project: ProjectAnalysis, analysis: MigrationAnalysis): void {
    console.log('\n📊 Project Analysis:');
    console.log(`  Current Angular version: ${project.currentAngularVersion || 'Unknown'}`);
    console.log(`  Project type: ${project.projectType}`);
    console.log(`  Uses standalone components: ${project.standalone ? 'Yes' : 'No'}`);
    console.log(`  Uses Angular Material: ${project.usesMaterial ? 'Yes' : 'No'}`);
    console.log(`  Node.js version: ${project.nodeVersion}`);
    
    console.log('\n📋 Migration Analysis:');
    if (analysis.isValid) {
      console.log(`  Migration path: ${analysis.migrationPath.join(' → ')}`);
      console.log(`  Estimated complexity: ${analysis.estimatedComplexity}`);
      console.log(`  Estimated time: ${analysis.estimatedTimeHours} hours`);
      console.log(`  Issues found: ${analysis.issues.length}`);
      
      if (analysis.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        analysis.recommendations.forEach(rec => console.log(`  • ${rec}`));
      }
    } else {
      console.log('  ❌ Migration not possible');
      analysis.issues.forEach(issue => console.log(`  • ${issue.title}: ${issue.description}`));
    }
  }

  /**
   * Print migration summary
   */
  private async printMigrationSummary(result: MigrationResult, options: MigrationOptions = {}): Promise<void> {
    const { success, summary, totalDuration, steps } = result;
    
    console.log('\n🎯 Migration Summary:');
    console.log(`  Status: ${success ? '✅ Success' : '❌ Failed'}`);
    console.log(`  Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`  Dependencies updated: ${summary.dependenciesUpdated}`);
    console.log(`  Files modified: ${summary.filesModified}`);
    console.log(`  Issues auto-fixed: ${summary.issuesFixed}`);
    
    if (summary.manualStepsRequired.length > 0) {
      console.log('\n⚠️  Manual steps required:');
      summary.manualStepsRequired.forEach(step => console.log(`  • ${step}`));
      
      // Handle optional interactive steps
      if (options.interactive && !options.dryRun && success) {
        await this.handleOptionalSteps(result.toVersion, summary.manualStepsRequired);
      }
    }
    
    const failedSteps = steps.filter(s => !s.success);
    if (failedSteps.length > 0) {
      console.log('\n❌ Failed steps:');
      failedSteps.forEach(step => {
        console.log(`  Step ${step.stepNumber}: ${step.error}`);
      });
    }

    if (result.backupPath) {
      console.log(`\n💾 Backup created at: ${result.backupPath}`);
    }

    if (success) {
      console.log(`\n🎉 Migration from Angular ${result.fromVersion} to ${result.toVersion} completed successfully!`);
      console.log('Run your tests and verify the application works correctly.');
    } else {
      console.log('\n💥 Migration failed. Check the errors above and try again.');
      if (result.backupPath) {
        console.log('You can restore from the backup if needed.');
      }
    }
  }

  /**
   * Handle optional post-migration steps interactively
   */
  private async handleOptionalSteps(targetVersion: number, manualSteps: string[]): Promise<void> {
    console.log('\n🤔 Would you like to apply optional enhancements?');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer: string) => {
          resolve(answer);
        });
      });
    };

    try {
      // Handle Material Design 3 migration for Angular 18+
      if (targetVersion >= 18 && manualSteps.some(step => step.includes('Material Design 3'))) {
        const answer = await question('\n  Update Angular Material to Material Design 3 (M3)? (y/N): ');
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          await this.applyMaterialM3Update();
        }
      }

      // Handle zoneless change detection for Angular 18+
      if (targetVersion >= 18 && manualSteps.some(step => step.includes('zoneless'))) {
        const answer = await question('\n  Enable experimental zoneless change detection? (y/N): ');
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          await this.enableZonelessChangeDetection();
        }
      }
    } finally {
      rl.close();
    }
  }

  /**
   * Apply Material Design 3 updates
   */
  private async applyMaterialM3Update(): Promise<void> {
    console.log('\n  🎨 Applying Material Design 3 updates...');
    try {
      // Update to M3 theme
      const stylesPath = path.join(this.projectRoot, 'src', 'styles.scss');
      if (fs.existsSync(stylesPath)) {
        let styles = fs.readFileSync(stylesPath, 'utf8');
        
        // Replace old Material theme with M3 theme
        if (styles.includes('@angular/material/prebuilt-themes/')) {
          styles = styles.replace(
            /@import ['"]~?@angular\/material\/prebuilt-themes\/[^'"]+['"];?/g,
            "@import '@angular/material/prebuilt-themes/azure-blue.css';"
          );
          fs.writeFileSync(stylesPath, styles);
          console.log('  ✅ Updated Material theme to M3');
        } else if (styles.includes('@use') && styles.includes('@angular/material')) {
          // Already using M3 with @use syntax
          console.log('  ℹ️  Already using modern Material theming');
        } else {
          console.log('  ℹ️  No Material theme import found, skipping');
        }
      } else {
        const stylesCssPath = path.join(this.projectRoot, 'src', 'styles.css');
        if (fs.existsSync(stylesCssPath)) {
          console.log('  ℹ️  Found styles.css - M3 themes work best with SCSS');
          console.log('  💡 Consider renaming to styles.scss for better theming support');
        }
      }
    } catch (error) {
      console.log(`  ⚠️  Failed to apply M3 updates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enable zoneless change detection
   */
  private async enableZonelessChangeDetection(): Promise<void> {
    console.log('\n  ⚡ Enabling zoneless change detection...');
    try {
      const configPath = path.join(this.projectRoot, 'src', 'app', 'app.config.ts');
      if (fs.existsSync(configPath)) {
        let config = fs.readFileSync(configPath, 'utf8');
        
        // Add provideExperimentalZonelessChangeDetection if not present
        if (!config.includes('provideExperimentalZonelessChangeDetection')) {
          // Check if it has provideZoneChangeDetection
          if (config.includes('provideZoneChangeDetection')) {
            config = config.replace(
              /provideZoneChangeDetection\([^)]*\)/,
              'provideExperimentalZonelessChangeDetection()'
            );
            
            // Update import
            if (config.includes("from '@angular/core'")) {
              config = config.replace(
                /(import\s*{[^}]*)(provideZoneChangeDetection)([^}]*}\s*from\s*['"]@angular\/core['"])/,
                '$1provideExperimentalZonelessChangeDetection$3'
              );
            }
            
            fs.writeFileSync(configPath, config);
            console.log('  ✅ Enabled zoneless change detection in app.config.ts');
          } else {
            console.log('  ℹ️  No zone configuration found, skipping');
          }
        } else {
          console.log('  ℹ️  Zoneless change detection already enabled');
        }
      } else {
        console.log('  ⚠️  app.config.ts not found, cannot enable zoneless change detection');
      }
    } catch (error) {
      console.log(`  ⚠️  Failed to enable zoneless: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert peer dependency conflicts to migration issues
   */
  private convertConflictsToIssues(resolution: ConflictResolution, stepNumber: number): MigrationIssue[] {
    const issues: MigrationIssue[] = [];
    
    for (const conflict of resolution.conflicts) {
      issues.push({
        id: `peer-conflict-${conflict.packageName}`,
        severity: conflict.resolutionStrategy === 'manual' ? 'error' : 'warning',
        category: 'dependency',
        title: `Peer dependency conflict: ${conflict.packageName}`,
        description: `${conflict.reasoning}. Required by: ${conflict.requiredBy.join(', ')}`,
        autoFixable: conflict.resolutionStrategy !== 'manual',
        migrationStep: stepNumber
      });
    }
    
    return issues;
  }
}