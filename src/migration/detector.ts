import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getMigrationChain, getAllAvailableVersions } from './versions';

export interface ProjectAnalysis {
  currentAngularVersion: number | null;
  packageJsonPath: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  nodeVersion: string;
  typescriptVersion: string | null;
  hasAngularJson: boolean;
  projectType: 'application' | 'library' | 'unknown';
  standalone: boolean;
  usesZoneJs: boolean;
  usesMaterial: boolean;
  usesAnimations: boolean;
  projectStructure: {
    srcExists: boolean;
    appExists: boolean;
    hasComponents: boolean;
    hasServices: boolean;
    hasModules: boolean;
  };
}

export interface MigrationAnalysis {
  isValid: boolean;
  currentVersion: number | null;
  targetVersion: number | null;
  migrationPath: number[];
  issues: MigrationIssue[];
  recommendations: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  estimatedTimeHours: number;
}

export interface MigrationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  category: 'dependency' | 'code' | 'configuration' | 'breaking-change';
  title: string;
  description: string;
  filePaths?: string[];
  autoFixable: boolean;
  migrationStep?: number; // Which step in the migration chain
}

export class MigrationDetector {
  private projectRoot: string;
  
  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Analyze the current project structure and Angular version
   */
  async analyzeProject(): Promise<ProjectAnalysis> {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`No package.json found in ${this.projectRoot}`);
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    const peerDependencies = packageJson.peerDependencies || {};

    // Detect Angular version
    const currentAngularVersion = this.detectAngularVersion(dependencies, devDependencies);
    
    // Detect Node.js version
    const nodeVersion = process.version;
    
    // Detect TypeScript version
    const typescriptVersion = this.detectTypescriptVersion(devDependencies);
    
    // Check for angular.json
    const hasAngularJson = fs.existsSync(path.join(this.projectRoot, 'angular.json'));
    
    // Analyze project structure
    const projectStructure = this.analyzeProjectStructure();
    
    // Detect project type and features
    const projectType = this.detectProjectType(packageJson, projectStructure);
    const standalone = this.detectStandaloneUsage();
    const usesZoneJs = this.detectZoneJsUsage(dependencies);
    const usesMaterial = this.detectMaterialUsage(dependencies);
    const usesAnimations = this.detectAnimationsUsage(dependencies);

    return {
      currentAngularVersion,
      packageJsonPath,
      dependencies,
      devDependencies,
      peerDependencies,
      nodeVersion,
      typescriptVersion,
      hasAngularJson,
      projectType,
      standalone,
      usesZoneJs,
      usesMaterial,
      usesAnimations,
      projectStructure
    };
  }

  /**
   * Analyze migration requirements from current to target version
   */
  async analyzeMigration(targetVersion: number): Promise<MigrationAnalysis> {
    const project = await this.analyzeProject();
    
    if (!project.currentAngularVersion) {
      return {
        isValid: false,
        currentVersion: null,
        targetVersion,
        migrationPath: [],
        issues: [{
          id: 'no-angular-version',
          severity: 'error',
          category: 'dependency',
          title: 'Angular version not detected',
          description: 'Could not determine the current Angular version from package.json',
          autoFixable: false
        }],
        recommendations: ['Ensure @angular/core is installed in dependencies'],
        estimatedComplexity: 'high',
        estimatedTimeHours: 0
      };
    }

    const currentVersion = project.currentAngularVersion;
    
    if (currentVersion === targetVersion) {
      return {
        isValid: false,
        currentVersion,
        targetVersion,
        migrationPath: [],
        issues: [{
          id: 'same-version',
          severity: 'info',
          category: 'dependency',
          title: 'Already at target version',
          description: `Project is already at Angular ${targetVersion}`,
          autoFixable: false
        }],
        recommendations: ['No migration needed'],
        estimatedComplexity: 'low',
        estimatedTimeHours: 0
      };
    }

    if (currentVersion > targetVersion) {
      return {
        isValid: false,
        currentVersion,
        targetVersion,
        migrationPath: [],
        issues: [{
          id: 'downgrade-not-supported',
          severity: 'error',
          category: 'dependency',
          title: 'Downgrade not supported',
          description: `Cannot downgrade from Angular ${currentVersion} to ${targetVersion}`,
          autoFixable: false
        }],
        recommendations: ['Consider creating a new project with the target version'],
        estimatedComplexity: 'high',
        estimatedTimeHours: 0
      };
    }

    try {
      const migrationChain = getMigrationChain(currentVersion, targetVersion);
      const migrationPath = migrationChain.map(m => m.to);
      
      const issues = await this.detectMigrationIssues(project, migrationChain);
      const recommendations = this.generateRecommendations(project, migrationChain, issues);
      const complexity = this.estimateComplexity(project, migrationChain, issues);
      const estimatedTimeHours = this.estimateTime(complexity, issues.length, migrationChain.length);

      return {
        isValid: true,
        currentVersion,
        targetVersion,
        migrationPath,
        issues,
        recommendations,
        estimatedComplexity: complexity,
        estimatedTimeHours
      };
    } catch (error) {
      return {
        isValid: false,
        currentVersion,
        targetVersion,
        migrationPath: [],
        issues: [{
          id: 'no-migration-path',
          severity: 'error',
          category: 'dependency',
          title: 'No migration path available',
          description: `No migration path available from Angular ${currentVersion} to ${targetVersion}`,
          autoFixable: false
        }],
        recommendations: ['Check if the target version is supported'],
        estimatedComplexity: 'high',
        estimatedTimeHours: 0
      };
    }
  }

  private detectAngularVersion(dependencies: Record<string, string>, devDependencies: Record<string, string>): number | null {
    // Try to find Angular core version
    const coreVersion = dependencies['@angular/core'] || devDependencies['@angular/core'];
    
    if (!coreVersion) return null;
    
    // Extract major version number
    const match = coreVersion.match(/(\^|~)?(\d+)/);
    return match ? parseInt(match[2], 10) : null;
  }

  private detectTypescriptVersion(devDependencies: Record<string, string>): string | null {
    return devDependencies['typescript'] || null;
  }

  private analyzeProjectStructure() {
    const srcPath = path.join(this.projectRoot, 'src');
    const appPath = path.join(this.projectRoot, 'src', 'app');
    
    return {
      srcExists: fs.existsSync(srcPath),
      appExists: fs.existsSync(appPath),
      hasComponents: this.hasFilesWithPattern('**/*.component.ts'),
      hasServices: this.hasFilesWithPattern('**/*.service.ts'),
      hasModules: this.hasFilesWithPattern('**/*.module.ts')
    };
  }

  private detectProjectType(packageJson: any, structure: any): 'application' | 'library' | 'unknown' {
    if (packageJson.scripts?.build && packageJson.scripts?.start) {
      return 'application';
    }
    if (packageJson.scripts?.['build-lib'] || packageJson.main) {
      return 'library';
    }
    return 'unknown';
  }

  private detectStandaloneUsage(): boolean {
    // Check if main.ts uses bootstrapApplication
    const mainPath = path.join(this.projectRoot, 'src', 'main.ts');
    if (fs.existsSync(mainPath)) {
      const content = fs.readFileSync(mainPath, 'utf8');
      return content.includes('bootstrapApplication');
    }
    return false;
  }

  private detectZoneJsUsage(dependencies: Record<string, string>): boolean {
    return 'zone.js' in dependencies;
  }

  private detectMaterialUsage(dependencies: Record<string, string>): boolean {
    return '@angular/material' in dependencies;
  }

  private detectAnimationsUsage(dependencies: Record<string, string>): boolean {
    return '@angular/animations' in dependencies;
  }

  private hasFilesWithPattern(pattern: string): boolean {
    try {
      const { globSync } = require('glob');
      const files = globSync(pattern, { 
        cwd: this.projectRoot,
        ignore: 'node_modules/**'
      });
      return files.length > 0;
    } catch {
      return false;
    }
  }

  private async detectMigrationIssues(project: ProjectAnalysis, migrationChain: any[]): Promise<MigrationIssue[]> {
    const issues: MigrationIssue[] = [];
    
    // Check Node.js version compatibility
    for (let i = 0; i < migrationChain.length; i++) {
      const migration = migrationChain[i];
      if (migration.nodeVersion) {
        const required = migration.nodeVersion.replace('>=', '');
        const current = project.nodeVersion.replace('v', '');
        
        if (this.compareVersions(current, required) < 0) {
          issues.push({
            id: `node-version-${migration.to}`,
            severity: 'error',
            category: 'dependency',
            title: `Node.js version incompatible for Angular ${migration.to}`,
            description: `Angular ${migration.to} requires Node.js ${migration.nodeVersion}, but you have ${project.nodeVersion}`,
            autoFixable: false,
            migrationStep: i + 1
          });
        }
      }
    }

    // Check for deprecated dependencies
    for (const [dep, version] of Object.entries(project.dependencies)) {
      if (this.isDeprecatedDependency(dep, version)) {
        issues.push({
          id: `deprecated-${dep}`,
          severity: 'warning',
          category: 'dependency',
          title: `Deprecated dependency: ${dep}`,
          description: `${dep}@${version} may not be compatible with newer Angular versions`,
          autoFixable: true,
          migrationStep: 1
        });
      }
    }

    // Analyze code for breaking changes
    const codeIssues = await this.analyzeCodeForBreakingChanges(migrationChain);
    issues.push(...codeIssues);

    return issues;
  }

  private async analyzeCodeForBreakingChanges(migrationChain: any[]): Promise<MigrationIssue[]> {
    const issues: MigrationIssue[] = [];
    
    // This would run static analysis on the codebase
    // For now, we'll add some common breaking change detections
    
    if (this.hasFilesWithPattern('**/*.html')) {
      // Check for structural directives in templates
      const hasStructuralDirectives = await this.checkForStructuralDirectives();
      if (hasStructuralDirectives) {
        issues.push({
          id: 'control-flow-migration',
          severity: 'warning',
          category: 'code',
          title: 'Control flow syntax can be migrated',
          description: 'Templates using *ngIf, *ngFor can be migrated to new @if, @for syntax',
          autoFixable: true
        });
      }
    }

    return issues;
  }

  private async checkForStructuralDirectives(): Promise<boolean> {
    try {
      const { globSync } = require('glob');
      const files = globSync('**/*.html', { 
        cwd: this.projectRoot,
        ignore: 'node_modules/**'
      });
      
      for (const file of files) {
        const content = fs.readFileSync(path.join(this.projectRoot, file), 'utf8');
        if (content.includes('*ngIf') || content.includes('*ngFor') || content.includes('*ngSwitch')) {
          return true;
        }
      }
    } catch {
      // Ignore errors
    }
    return false;
  }

  private generateRecommendations(project: ProjectAnalysis, migrationChain: any[], issues: MigrationIssue[]): string[] {
    const recommendations: string[] = [];
    
    recommendations.push('Create a backup of your project before starting migration');
    recommendations.push('Run your test suite after each migration step');
    
    if (issues.some(i => i.severity === 'error')) {
      recommendations.push('Fix all errors before proceeding with migration');
    }
    
    if (!project.standalone && migrationChain.some(m => m.to >= 19)) {
      recommendations.push('Consider migrating to standalone components for Angular 19+');
    }
    
    if (project.usesZoneJs && migrationChain.some(m => m.to >= 20)) {
      recommendations.push('Prepare for zoneless change detection in Angular 20');
    }
    
    if (project.usesMaterial) {
      recommendations.push('Review Material Design updates and theme changes');
    }
    
    return recommendations;
  }

  private estimateComplexity(project: ProjectAnalysis, migrationChain: any[], issues: MigrationIssue[]): 'low' | 'medium' | 'high' {
    let score = 0;
    
    // Base complexity from migration steps
    score += migrationChain.length * 10;
    
    // Add complexity for project size
    if (project.projectStructure.hasComponents) score += 5;
    if (project.projectStructure.hasServices) score += 5;
    if (project.projectStructure.hasModules) score += 10;
    
    // Add complexity for features
    if (project.usesMaterial) score += 15;
    if (project.usesAnimations) score += 10;
    if (!project.standalone) score += 20;
    
    // Add complexity for issues
    score += issues.filter(i => i.severity === 'error').length * 20;
    score += issues.filter(i => i.severity === 'warning').length * 10;
    
    if (score < 30) return 'low';
    if (score < 70) return 'medium';
    return 'high';
  }

  private estimateTime(complexity: string, issueCount: number, stepCount: number): number {
    let baseHours = stepCount * 2; // 2 hours per migration step
    
    if (complexity === 'medium') baseHours *= 1.5;
    if (complexity === 'high') baseHours *= 2.5;
    
    // Add time for manual issues
    baseHours += issueCount * 0.5;
    
    return Math.ceil(baseHours);
  }

  private isDeprecatedDependency(name: string, version: string): boolean {
    // Add logic to check against known deprecated packages
    const deprecated = [
      'codelyzer', // Deprecated Angular linter
      '@angular/http', // Deprecated HTTP client
      'protractor' // Deprecated e2e testing
    ];
    
    return deprecated.includes(name);
  }

  private compareVersions(a: string, b: string): number {
    const parseVersion = (v: string) => v.split('.').map(n => parseInt(n, 10));
    const aParts = parseVersion(a);
    const bParts = parseVersion(b);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    
    return 0;
  }
}