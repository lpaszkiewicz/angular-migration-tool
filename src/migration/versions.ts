/**
 * Angular Version Migration Definitions
 * Comprehensive mapping of Angular version migrations with dependencies and breaking changes
 */

export interface DependencyVersion {
  name: string;
  version: string;
  dev?: boolean;
  optional?: boolean;
}

export interface BreakingChange {
  id: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  autoFixable: boolean;
  codemodName?: string;
  manualSteps?: string[];
}

export interface MigrationPath {
  from: number;
  to: number;
  name: string;
  description: string;
  
  // Dependencies to update
  dependencies: DependencyVersion[];
  devDependencies: DependencyVersion[];
  peerDependencies: DependencyVersion[];
  
  // Breaking changes and fixes
  breakingChanges: BreakingChange[];
  
  // Pre and post migration scripts
  preMigrationTasks?: string[];
  postMigrationTasks?: string[];
  
  // Angular CLI update commands
  ngUpdateCommands: string[];
  
  // Required Node.js version
  nodeVersion?: string;
  
  // TypeScript version compatibility
  typescriptVersion?: string;
}

export const ANGULAR_MIGRATIONS: Record<string, MigrationPath> = {
  '17-18': {
    from: 17,
    to: 18,
    name: 'Angular 17 to 18',
    description: 'Migration from Angular 17 to Angular 18 with Material Design 3, built-in control flow, and event replay',
    
    dependencies: [
      { name: '@angular/animations', version: '^18.2.0' },
      { name: '@angular/common', version: '^18.2.0' },
      { name: '@angular/compiler', version: '^18.2.0' },
      { name: '@angular/core', version: '^18.2.0' },
      { name: '@angular/forms', version: '^18.2.0' },
      { name: '@angular/platform-browser', version: '^18.2.0' },
      { name: '@angular/platform-browser-dynamic', version: '^18.2.0' },
      { name: '@angular/router', version: '^18.2.0' },
      { name: '@angular/service-worker', version: '^18.2.0' },
      { name: '@angular/material', version: '^18.2.0' },
      { name: '@angular/cdk', version: '^18.2.0' },
      { name: 'rxjs', version: '~7.8.0' },
      { name: 'tslib', version: '^2.3.0' },
      { name: 'zone.js', version: '~0.14.3' }
    ],
    
    devDependencies: [
      { name: '@angular-devkit/build-angular', version: '^18.2.0' },
      { name: '@angular/cli', version: '^18.2.0' },
      { name: '@angular/compiler-cli', version: '^18.2.0' },
      { name: '@types/jasmine', version: '~5.1.0' },
      { name: 'jasmine-core', version: '~5.1.0' },
      { name: 'karma', version: '~6.4.0' },
      { name: 'karma-chrome-launcher', version: '~3.2.0' },
      { name: 'karma-coverage', version: '~2.2.0' },
      { name: 'karma-jasmine', version: '~5.1.0' },
      { name: 'karma-jasmine-html-reporter', version: '~2.1.0' },
      { name: 'typescript', version: '~5.5.2' }
    ],
    
    peerDependencies: [],
    
    breakingChanges: [
      {
        id: 'ng18-control-flow',
        description: 'Migrate to built-in control flow (@if, @for, @switch)',
        impact: 'medium',
        autoFixable: true,
        codemodName: 'controlFlowMigration',
        manualSteps: ['Review migrated control flow syntax', 'Test template rendering']
      },
      {
        id: 'ng18-material3',
        description: 'Update Angular Material to Material Design 3 (M3)',
        impact: 'high',
        autoFixable: false,
        manualSteps: [
          'Update Material theme configuration',
          'Review color system changes',
          'Update custom component styles',
          'Test Material component appearance'
        ]
      },
      {
        id: 'ng18-zoneless',
        description: 'Optional: Enable experimental zoneless change detection',
        impact: 'low',
        autoFixable: false,
        manualSteps: [
          'Add provideExperimentalZonelessChangeDetection() to bootstrapApplication',
          'Test change detection behavior',
          'Update OnPush strategies if needed'
        ]
      },
      {
        id: 'ng18-event-replay',
        description: 'Enable event replay for hydration',
        impact: 'low',
        autoFixable: true,
        codemodName: 'eventReplayMigration'
      }
    ],
    
    ngUpdateCommands: [
      'ng update @angular/core@18 @angular/cli@18',
      'ng update @angular/material@18'
    ],
    
    nodeVersion: '>=18.19.1',
    typescriptVersion: '>=5.4.0 <5.6.0'
  },

  '18-19': {
    from: 18,
    to: 19,
    name: 'Angular 18 to 19',
    description: 'Migration from Angular 18 to Angular 19 with standalone ng-new, incremental hydration, and modern bundling',
    
    dependencies: [
      { name: '@angular/animations', version: '^19.0.0' },
      { name: '@angular/common', version: '^19.0.0' },
      { name: '@angular/compiler', version: '^19.0.0' },
      { name: '@angular/core', version: '^19.0.0' },
      { name: '@angular/forms', version: '^19.0.0' },
      { name: '@angular/platform-browser', version: '^19.0.0' },
      { name: '@angular/platform-browser-dynamic', version: '^19.0.0' },
      { name: '@angular/router', version: '^19.0.0' },
      { name: '@angular/service-worker', version: '^19.0.0' },
      { name: '@angular/material', version: '^19.0.0' },
      { name: '@angular/cdk', version: '^19.0.0' },
      { name: 'rxjs', version: '~7.8.0' },
      { name: 'tslib', version: '^2.3.0' },
      { name: 'zone.js', version: '~0.15.0' }
    ],
    
    devDependencies: [
      { name: '@angular-devkit/build-angular', version: '^19.0.0' },
      { name: '@angular/cli', version: '^19.0.0' },
      { name: '@angular/compiler-cli', version: '^19.0.0' },
      { name: '@types/jasmine', version: '~5.1.0' },
      { name: 'jasmine-core', version: '~5.1.0' },
      { name: 'karma', version: '~6.4.0' },
      { name: 'karma-chrome-launcher', version: '~3.2.0' },
      { name: 'karma-coverage', version: '~2.2.0' },
      { name: 'karma-jasmine', version: '~5.1.0' },
      { name: 'karma-jasmine-html-reporter', version: '~2.1.0' },
      { name: 'typescript', version: '~5.6.2' }
    ],
    
    peerDependencies: [],
    
    breakingChanges: [
      {
        id: 'ng19-standalone-default',
        description: 'New applications are standalone by default',
        impact: 'low',
        autoFixable: true,
        codemodName: 'standaloneDefaultMigration'
      },
      {
        id: 'ng19-incremental-hydration',
        description: 'Enable incremental hydration for better performance',
        impact: 'medium',
        autoFixable: true,
        codemodName: 'incrementalHydrationMigration'
      },
      {
        id: 'ng19-modern-bundling',
        description: 'Update to modern bundling with esbuild',
        impact: 'medium',
        autoFixable: false,
        manualSteps: [
          'Update angular.json builder configurations',
          'Test build output and performance',
          'Update CI/CD scripts if needed'
        ]
      },
      {
        id: 'ng19-signal-apis',
        description: 'Adopt new signal-based APIs',
        impact: 'low',
        autoFixable: false,
        manualSteps: [
          'Consider migrating to signal inputs/outputs',
          'Evaluate signal-based state management',
          'Update reactive patterns'
        ]
      }
    ],
    
    ngUpdateCommands: [
      'ng update @angular/core@19 @angular/cli@19',
      'ng update @angular/material@19'
    ],
    
    nodeVersion: '>=18.19.1',
    typescriptVersion: '>=5.5.0 <5.7.0'
  },

  '19-20': {
    from: 19,
    to: 20,
    name: 'Angular 19 to 20',
    description: 'Migration from Angular 19 to Angular 20 with full signal migration and advanced optimizations',
    
    dependencies: [
      { name: '@angular/animations', version: '^20.0.0' },
      { name: '@angular/common', version: '^20.0.0' },
      { name: '@angular/compiler', version: '^20.0.0' },
      { name: '@angular/core', version: '^20.0.0' },
      { name: '@angular/forms', version: '^20.0.0' },
      { name: '@angular/platform-browser', version: '^20.0.0' },
      { name: '@angular/platform-browser-dynamic', version: '^20.0.0' },
      { name: '@angular/router', version: '^20.0.0' },
      { name: '@angular/service-worker', version: '^20.0.0' },
      { name: '@angular/material', version: '^20.0.0' },
      { name: '@angular/cdk', version: '^20.0.0' },
      { name: 'rxjs', version: '~7.8.0' },
      { name: 'tslib', version: '^2.3.0' },
      { name: 'zone.js', version: '~0.15.0' }
    ],
    
    devDependencies: [
      { name: '@angular-devkit/build-angular', version: '^20.0.0' },
      { name: '@angular/cli', version: '^20.0.0' },
      { name: '@angular/compiler-cli', version: '^20.0.0' },
      { name: '@types/jasmine', version: '~5.1.0' },
      { name: 'jasmine-core', version: '~5.1.0' },
      { name: 'karma', version: '~6.4.0' },
      { name: 'karma-chrome-launcher', version: '~3.2.0' },
      { name: 'karma-coverage', version: '~2.2.0' },
      { name: 'karma-jasmine', version: '~5.1.0' },
      { name: 'karma-jasmine-html-reporter', version: '~2.1.0' },
      { name: 'typescript', version: '~5.7.2' }
    ],
    
    peerDependencies: [],
    
    breakingChanges: [
      {
        id: 'ng20-full-signals',
        description: 'Complete signal-based reactivity system',
        impact: 'high',
        autoFixable: true,
        codemodName: 'fullSignalMigration',
        manualSteps: [
          'Review signal conversion results',
          'Update reactive patterns',
          'Test change detection performance'
        ]
      },
      {
        id: 'ng20-zoneless-default',
        description: 'Zoneless change detection becomes default',
        impact: 'high',
        autoFixable: true,
        codemodName: 'zonelessDefaultMigration',
        manualSteps: [
          'Remove zone.js if not needed',
          'Update change detection strategies',
          'Test async operations'
        ]
      },
      {
        id: 'ng20-advanced-bundling',
        description: 'Advanced tree-shaking and optimization',
        impact: 'medium',
        autoFixable: false,
        manualSteps: [
          'Review build configuration',
          'Optimize bundle size',
          'Update lazy loading strategies'
        ]
      }
    ],
    
    ngUpdateCommands: [
      'ng update @angular/core@20 @angular/cli@20',
      'ng update @angular/material@20'
    ],
    
    nodeVersion: '>=20.0.0',
    typescriptVersion: '>=5.6.0 <5.8.0'
  }
};

// Helper functions
export function getMigrationPath(from: number, to: number): MigrationPath | null {
  const key = `${from}-${to}`;
  return ANGULAR_MIGRATIONS[key] || null;
}

export function getMigrationChain(from: number, to: number): MigrationPath[] {
  const chain: MigrationPath[] = [];
  let current = from;
  
  while (current < to) {
    const next = current + 1;
    const migration = getMigrationPath(current, next);
    
    if (!migration) {
      throw new Error(`No migration path found from Angular ${current} to ${next}`);
    }
    
    chain.push(migration);
    current = next;
  }
  
  return chain;
}

export function getAllAvailableVersions(): number[] {
  const versions = new Set<number>();
  
  Object.values(ANGULAR_MIGRATIONS).forEach(migration => {
    versions.add(migration.from);
    versions.add(migration.to);
  });
  
  return Array.from(versions).sort((a, b) => a - b);
}