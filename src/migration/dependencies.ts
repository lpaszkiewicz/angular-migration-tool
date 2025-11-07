import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { MigrationPath, DependencyVersion } from './versions';
import { MigrationIssue } from './detector';
import semver from 'semver';

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

export interface PeerDependencyConflict {
  packageName: string;
  requiredBy: string[];
  currentVersion: string | null;
  conflictingRequirements: {
    requiredBy: string;
    version: string;
    satisfied: boolean;
  }[];
  resolutionStrategy: 'upgrade' | 'downgrade' | 'overrides' | 'manual';
  recommendedVersion: string | null;
  reasoning: string;
}

export interface ConflictResolution {
  conflicts: PeerDependencyConflict[];
  resolutions: {
    packageOverrides?: Record<string, string>;
    dependencyUpdates?: Record<string, string>;
    warnings?: string[];
    manualSteps?: string[];
  };
  canAutoResolve: boolean;
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

      // Install/update dependencies with clean install if needed
      if (!dryRun) {
        await this.installDependenciesWithRetry(result);
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

  /**
   * Analyze and resolve peer dependency conflicts
   */
  async analyzePeerDependencyConflicts(migration: MigrationPath): Promise<ConflictResolution> {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return {
        conflicts: [],
        resolutions: { warnings: ['No package.json found'] },
        canAutoResolve: false
      };
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };

    // Get peer dependencies for all current and target dependencies
    const conflicts: PeerDependencyConflict[] = [];
    const targetDeps = [...migration.dependencies, ...migration.devDependencies];

    for (const dep of targetDeps) {
      const peerConflicts = await this.checkPeerDependencies(dep, allDeps);
      conflicts.push(...peerConflicts);
    }

    const resolution = await this.generateConflictResolution(conflicts, allDeps);
    return resolution;
  }

  /**
   * Apply peer dependency conflict resolutions
   */
  async resolvePeerDependencyConflicts(resolution: ConflictResolution, dryRun: boolean = true): Promise<DependencyUpdateResult> {
    const result: DependencyUpdateResult = {
      success: true,
      updated: [],
      failed: [],
      errors: []
    };

    if (!resolution.canAutoResolve) {
      result.success = false;
      result.errors.push('Cannot auto-resolve peer dependency conflicts');
      if (resolution.resolutions.manualSteps) {
        result.errors.push(...resolution.resolutions.manualSteps);
      }
      return result;
    }

    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Apply dependency updates
      if (resolution.resolutions.dependencyUpdates) {
        for (const [pkg, version] of Object.entries(resolution.resolutions.dependencyUpdates)) {
          if (packageJson.dependencies?.[pkg]) {
            packageJson.dependencies[pkg] = version;
            result.updated.push(`${pkg}@${version}`);
          } else if (packageJson.devDependencies?.[pkg]) {
            packageJson.devDependencies[pkg] = version;
            result.updated.push(`${pkg}@${version} (dev)`);
          }
        }
      }

      // Apply package overrides (npm 8.3+)
      if (resolution.resolutions.packageOverrides && this.packageManager.name === 'npm') {
        if (!packageJson.overrides) packageJson.overrides = {};
        Object.assign(packageJson.overrides, resolution.resolutions.packageOverrides);
        result.updated.push('Added package overrides');
      }

      // Apply resolutions (yarn)
      if (resolution.resolutions.packageOverrides && this.packageManager.name === 'yarn') {
        if (!packageJson.resolutions) packageJson.resolutions = {};
        Object.assign(packageJson.resolutions, resolution.resolutions.packageOverrides);
        result.updated.push('Added yarn resolutions');
      }

      if (!dryRun) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        
        // Install dependencies with conflict resolution
        await this.installDependenciesWithConflictResolution();
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Failed to resolve conflicts: ${error instanceof Error ? error.message : String(error)}`);
    }

    return result;
  }

  /**
   * Check for peer dependency conflicts for a specific package
   */
  private async checkPeerDependencies(
    dependency: DependencyVersion, 
    currentDeps: Record<string, string>
  ): Promise<PeerDependencyConflict[]> {
    const conflicts: PeerDependencyConflict[] = [];
    
    try {
      // Get package info from npm registry
      const packageInfo = await this.getPackageInfo(dependency.name, dependency.version);
      const peerDeps = packageInfo.peerDependencies || {};

      for (const [peerName, peerRangeRaw] of Object.entries(peerDeps)) {
        const peerRange = String(peerRangeRaw);
        const currentVersion = currentDeps[peerName];
        const installedVersion = this.getInstalledVersion(peerName);
        
        const conflictingRequirements = await this.findConflictingRequirements(peerName, peerRange, currentDeps);
        
        // Only report conflicts if there's a real incompatibility
        const hasRealConflict = currentVersion && 
          !this.versionSatisfiesRange(currentVersion, peerRange) &&
          conflictingRequirements.some(req => !req.satisfied);
        
        if (hasRealConflict || (conflictingRequirements.length > 0 && conflictingRequirements.some(req => !req.satisfied))) {
          conflicts.push({
            packageName: peerName,
            requiredBy: [dependency.name],
            currentVersion: installedVersion,
            conflictingRequirements,
            resolutionStrategy: await this.determineResolutionStrategy(peerName, peerRange, conflictingRequirements),
            recommendedVersion: await this.findBestVersion(peerName, peerRange, conflictingRequirements),
            reasoning: this.generateResolutionReasoning(peerName, peerRange, conflictingRequirements)
          });
        }
      }
    } catch (error) {
      // Non-fatal - package might not exist in registry or network issues
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes('ENOBUFS')) {
        console.warn(`Could not check peer dependencies for ${dependency.name}: ${errorMsg}`);
      }
    }

    return conflicts;
  }

  /**
   * Generate conflict resolution strategy
   */
  private async generateConflictResolution(
    conflicts: PeerDependencyConflict[], 
    currentDeps: Record<string, string>
  ): Promise<ConflictResolution> {
    const resolution: ConflictResolution = {
      conflicts,
      resolutions: {
        packageOverrides: {},
        dependencyUpdates: {},
        warnings: [],
        manualSteps: []
      },
      canAutoResolve: true
    };

    for (const conflict of conflicts) {
      switch (conflict.resolutionStrategy) {
        case 'upgrade':
        case 'downgrade':
          if (conflict.recommendedVersion) {
            resolution.resolutions.dependencyUpdates![conflict.packageName] = conflict.recommendedVersion;
          }
          break;
          
        case 'overrides':
          if (conflict.recommendedVersion) {
            resolution.resolutions.packageOverrides![conflict.packageName] = conflict.recommendedVersion;
          }
          break;
          
        case 'manual':
          resolution.canAutoResolve = false;
          resolution.resolutions.manualSteps!.push(
            `Manual resolution required for ${conflict.packageName}: ${conflict.reasoning}`
          );
          break;
      }
    }

    // Add warnings for complex resolutions
    if (Object.keys(resolution.resolutions.packageOverrides || {}).length > 0) {
      resolution.resolutions.warnings!.push(
        'Using package overrides/resolutions to resolve conflicts. Test thoroughly.'
      );
    }

    return resolution;
  }

  /**
   * Determine the best resolution strategy for a conflict
   */
  private async determineResolutionStrategy(
    packageName: string, 
    requiredRange: string, 
    conflictingRequirements: PeerDependencyConflict['conflictingRequirements']
  ): Promise<PeerDependencyConflict['resolutionStrategy']> {
    
    // If no conflicting requirements, simple upgrade/downgrade
    if (conflictingRequirements.length === 0) {
      return 'upgrade';
    }

    // Try to find a version that satisfies all requirements
    const allRanges = [requiredRange, ...conflictingRequirements.map(req => req.version)];
    const intersection = await this.findVersionIntersection(packageName, allRanges);
    
    if (intersection) {
      return 'upgrade';
    }

    // If no intersection, check if overrides can help
    const canUseOverrides = this.packageManager.name === 'npm' || this.packageManager.name === 'yarn';
    if (canUseOverrides) {
      return 'overrides';
    }

    // Last resort - manual intervention
    return 'manual';
  }

  /**
   * Find the best version that satisfies multiple ranges
   */
  private async findBestVersion(
    packageName: string, 
    primaryRange: string, 
    conflictingRequirements: PeerDependencyConflict['conflictingRequirements']
  ): Promise<string | null> {
    
    try {
      const allRanges = [primaryRange, ...conflictingRequirements.map(req => req.version)];
      const intersection = await this.findVersionIntersection(packageName, allRanges);
      
      if (intersection) {
        return intersection;
      }

      // If no intersection, find the highest version that satisfies the primary range
      const versions = await this.getAvailableVersions(packageName);
      const satisfyingVersions = versions.filter(v => semver.satisfies(v, primaryRange));
      
      if (satisfyingVersions.length > 0) {
        return satisfyingVersions[satisfyingVersions.length - 1]; // Highest version
      }

    } catch (error) {
      console.warn(`Could not determine best version for ${packageName}: ${error}`);
    }

    return null;
  }

  /**
   * Find version that satisfies all given ranges
   */
  private async findVersionIntersection(packageName: string, ranges: string[]): Promise<string | null> {
    try {
      const versions = await this.getAvailableVersions(packageName);
      
      for (const version of versions.reverse()) { // Start with highest versions
        if (ranges.every(range => semver.satisfies(version, range))) {
          return version;
        }
      }
    } catch (error) {
      console.warn(`Could not find version intersection for ${packageName}: ${error}`);
    }
    
    return null;
  }

  /**
   * Get available versions for a package from npm registry
   */
  private async getAvailableVersions(packageName: string): Promise<string[]> {
    try {
      const output = execSync(`npm view ${packageName} versions --json`, { 
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      const versions = JSON.parse(output);
      return Array.isArray(versions) ? versions : [versions];
    } catch (error) {
      throw new Error(`Could not get versions for ${packageName}: ${error}`);
    }
  }

  /**
   * Get package information from npm registry
   */
  private async getPackageInfo(packageName: string, version: string): Promise<any> {
    try {
      const output = execSync(`npm view ${packageName}@${version} --json`, { 
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      return JSON.parse(output);
    } catch (error) {
      throw new Error(`Could not get package info for ${packageName}@${version}: ${error}`);
    }
  }

  /**
   * Find conflicting requirements for a peer dependency
   */
  private async findConflictingRequirements(
    peerName: string, 
    peerRange: string, 
    currentDeps: Record<string, string>
  ): Promise<PeerDependencyConflict['conflictingRequirements']> {
    
    const conflicts: PeerDependencyConflict['conflictingRequirements'] = [];
    
    // Check each dependency to see if it also requires this peer dependency
    for (const [depName, depVersion] of Object.entries(currentDeps)) {
      try {
        const packageInfo = await this.getPackageInfo(depName, depVersion);
        const peerDeps = packageInfo.peerDependencies || {};
        
        if (peerDeps[peerName]) {
          const otherRange = peerDeps[peerName];
          const satisfied = semver.intersects(peerRange, otherRange);
          
          conflicts.push({
            requiredBy: depName,
            version: otherRange,
            satisfied
          });
        }
      } catch (error) {
        // Non-fatal - continue checking other dependencies
      }
    }
    
    return conflicts;
  }

  /**
   * Generate human-readable reasoning for resolution strategy
   */
  private generateResolutionReasoning(
    packageName: string, 
    peerRange: string, 
    conflictingRequirements: PeerDependencyConflict['conflictingRequirements']
  ): string {
    
    if (conflictingRequirements.length === 0) {
      return `Need to install ${packageName}@${peerRange}`;
    }

    const unsatisfied = conflictingRequirements.filter(req => !req.satisfied);
    if (unsatisfied.length === 0) {
      return `All requirements for ${packageName} can be satisfied`;
    }

    const conflictingPackages = unsatisfied.map(req => req.requiredBy).join(', ');
    return `${packageName} has conflicting version requirements from: ${conflictingPackages}`;
  }

  /**
   * Check if a version satisfies a semver range
   */
  private versionSatisfiesRange(version: string, range: string): boolean {
    try {
      const coerced = semver.coerce(version);
      if (!coerced) return false;
      return semver.satisfies(coerced.version, range);
    } catch {
      return false;
    }
  }

  /**
   * Install dependencies with conflict resolution
   */
  private async installDependenciesWithConflictResolution(): Promise<void> {
    let installCommand = this.getInstallCommand();
    
    // Add package manager specific flags for handling peer dependency conflicts
    switch (this.packageManager.name) {
      case 'npm':
        // npm 7+ automatically installs peer dependencies, but we can use --legacy-peer-deps if needed
        break;
      case 'yarn':
        // Yarn uses resolutions field in package.json
        break;
      case 'pnpm':
        // pnpm has strict peer dependency handling, might need --shamefully-hoist
        break;
    }
    
    try {
      execSync(installCommand, {
        cwd: this.projectRoot,
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
    } catch (error) {
      throw new Error(`Installation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    // Auto-update all Angular ecosystem packages to match target version
    this.updateAngularEcosystemPackages(packageJson, migration.to);

    if (!dryRun) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    }
  }

  /**
   * Update all Angular ecosystem packages to match the target version
   * This includes Material adapters, CDK, CLI tools, etc.
   */
  private updateAngularEcosystemPackages(packageJson: any, targetVersion: number): void {
    const angularEcosystemPackages = [
      '@angular/animations',
      '@angular/common',
      '@angular/compiler',
      '@angular/core',
      '@angular/forms',
      '@angular/platform-browser',
      '@angular/platform-browser-dynamic',
      '@angular/router',
      '@angular/service-worker',
      '@angular/cdk',
      '@angular/material',
      '@angular/material-luxon-adapter',
      '@angular/material-moment-adapter',
      '@angular/material-date-fns-adapter',
      '@angular/elements',
      '@angular/pwa',
      '@angular/localize',
      '@angular/platform-server',
      '@angular-devkit/build-angular',
      '@angular/cli',
      '@angular/compiler-cli',
      'ng-packagr'
    ];

    const targetVersionRange = `^${targetVersion}.2.0`;

    // Update in dependencies
    if (packageJson.dependencies) {
      for (const pkg of angularEcosystemPackages) {
        if (packageJson.dependencies[pkg]) {
          const currentVersion = packageJson.dependencies[pkg];
          // Only update if it's an Angular version mismatch
          if (this.isAngularPackageOutdated(currentVersion, targetVersion)) {
            console.log(`  📦 Auto-updating ${pkg}: ${currentVersion} → ${targetVersionRange}`);
            packageJson.dependencies[pkg] = targetVersionRange;
          }
        }
      }
    }

    // Update in devDependencies
    if (packageJson.devDependencies) {
      for (const pkg of angularEcosystemPackages) {
        if (packageJson.devDependencies[pkg]) {
          const currentVersion = packageJson.devDependencies[pkg];
          if (this.isAngularPackageOutdated(currentVersion, targetVersion)) {
            console.log(`  📦 Auto-updating ${pkg}: ${currentVersion} → ${targetVersionRange}`);
            packageJson.devDependencies[pkg] = targetVersionRange;
          }
        }
      }
    }
  }

  /**
   * Check if an Angular package version is outdated compared to target
   */
  private isAngularPackageOutdated(currentVersion: string, targetVersion: number): boolean {
    // Extract major version from version string (e.g., "^17.3.10" -> 17)
    const match = currentVersion.match(/(\d+)\./);
    if (!match) return false;
    
    const currentMajor = parseInt(match[1], 10);
    return currentMajor < targetVersion;
  }

  private async runNgUpdateCommands(migration: MigrationPath, result: DependencyUpdateResult): Promise<void> {
    for (const command of migration.ngUpdateCommands) {
      try {
        console.log(`Running: ${command}`);
        execSync(command, {
          cwd: this.projectRoot,
          stdio: 'pipe',
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
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
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      result.updated.push('dependency installation');
    } catch (error) {
      result.failed.push('dependency installation');
      result.errors.push(`Failed to install dependencies: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Install dependencies with retry strategy for peer dependency conflicts
   */
  private async installDependenciesWithRetry(result: DependencyUpdateResult): Promise<void> {
    try {
      await this.installDependencies(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's a peer dependency conflict (ERESOLVE)
      if (errorMessage.includes('ERESOLVE') || errorMessage.includes('peer dep')) {
        console.log('  ⚠️  Peer dependency conflict detected, attempting clean install...');
        
        try {
          // Remove node_modules and lock file for clean install
          await this.cleanNodeModules();
          
          // Retry installation
          console.log('  🔄 Retrying installation after cleanup...');
          await this.installDependencies(result);
          
          console.log('  ✅ Clean install successful');
        } catch (retryError) {
          result.errors.push('Clean install also failed. You may need to resolve peer dependencies manually.');
          throw retryError;
        }
      } else {
        // Not a peer dep issue, just rethrow
        throw error;
      }
    }
  }

  /**
   * Clean node_modules and lock files for fresh install
   */
  private async cleanNodeModules(): Promise<void> {
    const nodeModulesPath = path.join(this.projectRoot, 'node_modules');
    const lockFiles = [
      'package-lock.json',
      'yarn.lock', 
      'pnpm-lock.yaml'
    ];

    // Remove node_modules
    if (fs.existsSync(nodeModulesPath)) {
      console.log('    Removing node_modules...');
      fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    }

    // Remove lock files
    for (const lockFile of lockFiles) {
      const lockPath = path.join(this.projectRoot, lockFile);
      if (fs.existsSync(lockPath)) {
        console.log(`    Removing ${lockFile}...`);
        fs.unlinkSync(lockPath);
      }
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