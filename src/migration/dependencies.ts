import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { MigrationPath, DependencyVersion } from './versions';
import { MigrationIssue } from './detector';

export interface DependencyUpdateResult {
  success: boolean;
  updated: string[];
  failed: string[];
  errors: string[];
  packageJsonBackup?: string;
}

export interface PackageManager {
  name: 'npm' | 'yarn' | 'pnpm';
  version: string;
  lockFile: string;
}

export class DependencyMigrator {
  private projectRoot: string;
  private packageManager: PackageManager;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = path.resolve(projectRoot);
    this.packageManager = this.detectPackageManager();
  }

  /**
   * Update dependencies for a specific migration step
   */
  async updateDependencies(migration: MigrationPath, options: {
    dryRun?: boolean;
    backup?: boolean;
    skipNgUpdate?: boolean;
  } = {}): Promise<DependencyUpdateResult> {
    const { dryRun = false, backup = true, skipNgUpdate = false } = options;
    
    const result: DependencyUpdateResult = {
      success: true,
      updated: [],
      failed: [],
      errors: []
    };

    try {
      // Create backup if requested
      if (backup && !dryRun) {
        result.packageJsonBackup = await this.createPackageJsonBackup();
      }

      // Update package.json
      await this.updatePackageJson(migration, dryRun);

      // Run Angular CLI update commands
      if (!skipNgUpdate && !dryRun) {
        await this.runNgUpdateCommands(migration, result);
      }

      // Install/update dependencies
      if (!dryRun) {
        await this.installDependencies(result);
      }

      // Verify installation
      if (!dryRun) {
        await this.verifyDependencies(migration, result);
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`Dependency update failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Restore backup if update failed
      if (result.packageJsonBackup && !dryRun) {
        try {
          await this.restorePackageJsonBackup(result.packageJsonBackup);
          result.errors.push('Restored package.json from backup due to failure');
        } catch (restoreError) {
          result.errors.push(`Failed to restore backup: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`);
        }
      }
      
      return result;
    }
  }

  /**
   * Analyze dependency compatibility issues
   */
  async analyzeDependencyCompatibility(migration: MigrationPath): Promise<MigrationIssue[]> {
    const issues: MigrationIssue[] = [];
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return [{
        id: 'no-package-json',
        severity: 'error',
        category: 'dependency',
        title: 'No package.json found',
        description: 'Cannot analyze dependencies without package.json',
        autoFixable: false
      }];
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for incompatible dependencies
    for (const [depName, version] of Object.entries(currentDeps)) {
      const compatibilityIssue = await this.checkDependencyCompatibility(
        depName, 
        version as string, 
        migration.to
      );
      
      if (compatibilityIssue) {
        issues.push(compatibilityIssue);
      }
    }

    // Check for missing required dependencies
    const requiredDeps = [
      ...migration.dependencies,
      ...migration.devDependencies,
      ...migration.peerDependencies
    ];

    for (const dep of requiredDeps) {
      if (!currentDeps[dep.name]) {
        issues.push({
          id: `missing-${dep.name}`,
          severity: 'warning',
          category: 'dependency',
          title: `Missing dependency: ${dep.name}`,
          description: `${dep.name} is required for Angular ${migration.to}`,
          autoFixable: true
        });
      }
    }

    return issues;
  }

  /**
   * Generate dependency update plan
   */
  generateUpdatePlan(migration: MigrationPath): {
    toAdd: DependencyVersion[];
    toUpdate: DependencyVersion[];
    toRemove: string[];
    commands: string[];
  } {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    const toAdd: DependencyVersion[] = [];
    const toUpdate: DependencyVersion[] = [];
    const toRemove: string[] = [];
    const commands: string[] = [];

    // Process regular dependencies
    for (const dep of migration.dependencies) {
      if (currentDeps[dep.name]) {
        toUpdate.push(dep);
      } else {
        toAdd.push(dep);
      }
    }

    // Process dev dependencies
    for (const dep of migration.devDependencies) {
      if (currentDeps[dep.name]) {
        toUpdate.push({ ...dep, dev: true });
      } else {
        toAdd.push({ ...dep, dev: true });
      }
    }

    // Generate package manager commands
    commands.push(...migration.ngUpdateCommands);
    
    if (toAdd.length > 0) {
      const addCmd = this.generateInstallCommand(toAdd);
      commands.push(addCmd);
    }

    return { toAdd, toUpdate, toRemove, commands };
  }

  private detectPackageManager(): PackageManager {
    const lockFiles = {
      'package-lock.json': 'npm',
      'yarn.lock': 'yarn',
      'pnpm-lock.yaml': 'pnpm'
    } as const;

    for (const [lockFile, manager] of Object.entries(lockFiles)) {
      if (fs.existsSync(path.join(this.projectRoot, lockFile))) {
        const version = this.getPackageManagerVersion(manager);
        return {
          name: manager as any,
          version,
          lockFile
        };
      }
    }

    // Default to npm if no lock file found
    return {
      name: 'npm',
      version: this.getPackageManagerVersion('npm'),
      lockFile: 'package-lock.json'
    };
  }

  private getPackageManagerVersion(manager: string): string {
    try {
      const version = execSync(`${manager} --version`, { encoding: 'utf8' }).trim();
      return version;
    } catch {
      return 'unknown';
    }
  }

  private async createPackageJsonBackup(): Promise<string> {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.projectRoot, `package.json.backup.${timestamp}`);
    
    fs.copyFileSync(packageJsonPath, backupPath);
    return backupPath;
  }

  private async restorePackageJsonBackup(backupPath: string): Promise<void> {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    fs.copyFileSync(backupPath, packageJsonPath);
  }

  private async updatePackageJson(migration: MigrationPath, dryRun: boolean): Promise<void> {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Update dependencies
    for (const dep of migration.dependencies) {
      if (!packageJson.dependencies) packageJson.dependencies = {};
      packageJson.dependencies[dep.name] = dep.version;
    }

    // Update devDependencies
    for (const dep of migration.devDependencies) {
      if (!packageJson.devDependencies) packageJson.devDependencies = {};
      packageJson.devDependencies[dep.name] = dep.version;
    }

    // Update peerDependencies
    for (const dep of migration.peerDependencies) {
      if (!packageJson.peerDependencies) packageJson.peerDependencies = {};
      packageJson.peerDependencies[dep.name] = dep.version;
    }

    if (!dryRun) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    }
  }

  private async runNgUpdateCommands(migration: MigrationPath, result: DependencyUpdateResult): Promise<void> {
    for (const command of migration.ngUpdateCommands) {
      try {
        console.log(`Running: ${command}`);
        execSync(command, {
          cwd: this.projectRoot,
          stdio: 'pipe',
          encoding: 'utf8'
        });
        result.updated.push(command);
      } catch (error) {
        result.failed.push(command);
        result.errors.push(`Failed to run '${command}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async installDependencies(result: DependencyUpdateResult): Promise<void> {
    const installCommand = this.getInstallCommand();
    
    try {
      console.log(`Running: ${installCommand}`);
      execSync(installCommand, {
        cwd: this.projectRoot,
        stdio: 'pipe',
        encoding: 'utf8'
      });
      result.updated.push('dependency installation');
    } catch (error) {
      result.failed.push('dependency installation');
      result.errors.push(`Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private async verifyDependencies(migration: MigrationPath, result: DependencyUpdateResult): Promise<void> {
    const requiredDeps = [...migration.dependencies, ...migration.devDependencies];
    
    for (const dep of requiredDeps) {
      try {
        const installedVersion = this.getInstalledVersion(dep.name);
        if (!installedVersion) {
          result.errors.push(`${dep.name} was not installed correctly`);
        } else {
          console.log(`Verified ${dep.name}@${installedVersion}`);
        }
      } catch (error) {
        result.errors.push(`Could not verify ${dep.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private getInstalledVersion(packageName: string): string | null {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'node_modules', packageName, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        return packageJson.version;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  private getInstallCommand(): string {
    switch (this.packageManager.name) {
      case 'yarn':
        return 'yarn install';
      case 'pnpm':
        return 'pnpm install';
      default:
        return 'npm install';
    }
  }

  private generateInstallCommand(dependencies: DependencyVersion[]): string {
    const prodDeps = dependencies.filter(d => !d.dev).map(d => `${d.name}@${d.version}`);
    const devDeps = dependencies.filter(d => d.dev).map(d => `${d.name}@${d.version}`);

    const commands: string[] = [];

    if (prodDeps.length > 0) {
      switch (this.packageManager.name) {
        case 'yarn':
          commands.push(`yarn add ${prodDeps.join(' ')}`);
          break;
        case 'pnpm':
          commands.push(`pnpm add ${prodDeps.join(' ')}`);
          break;
        default:
          commands.push(`npm install ${prodDeps.join(' ')}`);
      }
    }

    if (devDeps.length > 0) {
      switch (this.packageManager.name) {
        case 'yarn':
          commands.push(`yarn add -D ${devDeps.join(' ')}`);
          break;
        case 'pnpm':
          commands.push(`pnpm add -D ${devDeps.join(' ')}`);
          break;
        default:
          commands.push(`npm install -D ${devDeps.join(' ')}`);
      }
    }

    return commands.join(' && ');
  }

  private async checkDependencyCompatibility(
    name: string, 
    version: string, 
    targetAngularVersion: number
  ): Promise<MigrationIssue | null> {
    // Known incompatible packages
    const incompatiblePackages: Record<string, { maxAngular: number; reason: string }> = {
      'codelyzer': { maxAngular: 17, reason: 'Deprecated linting tool, use @angular-eslint instead' },
      'protractor': { maxAngular: 17, reason: 'Deprecated E2E testing tool, use Cypress or Playwright' },
      '@angular/http': { maxAngular: 17, reason: 'Deprecated HTTP client, use @angular/common/http' }
    };

    const incompatible = incompatiblePackages[name];
    if (incompatible && targetAngularVersion > incompatible.maxAngular) {
      return {
        id: `incompatible-${name}`,
        severity: 'error',
        category: 'dependency',
        title: `Incompatible dependency: ${name}`,
        description: `${name} is not compatible with Angular ${targetAngularVersion}. ${incompatible.reason}`,
        autoFixable: false
      };
    }

    return null;
  }
}