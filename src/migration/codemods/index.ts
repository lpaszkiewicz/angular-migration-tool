/**
 * Migration Codemods Index
 * Organizes all codemods by Angular version
 */

import { Codemod } from '../../types';
import { controlFlowMigration, eventReplayMigration } from './angular18';
import { standaloneDefaultMigration, incrementalHydrationMigration } from './angular19';
import { fullSignalMigration, zonelessDefaultMigration } from './angular20';

// Import existing codemods from the original project
import { standaloneComponentMigration } from '../../codemods/standaloneComponents';
import { injectFunctionMigration } from '../../codemods/injectFunction';
import { removeModuleId } from '../../codemods/removeModuleId';
import { rxjsImportMigration } from '../../codemods/rxjsImports';
import { importFix } from '../../codemods/importFixNew';

// Group codemods by target Angular version
export const MIGRATION_CODEMODS: Record<number, Codemod[]> = {
  17: [
    // Existing codemods for general Angular improvements
    removeModuleId,
    rxjsImportMigration,
    importFix
  ],
  
  18: [
    // Angular 17 → 18 specific migrations
    controlFlowMigration,
    eventReplayMigration,
    standaloneComponentMigration,
    injectFunctionMigration
  ],
  
  19: [
    // Angular 18 → 19 specific migrations
    standaloneDefaultMigration,
    incrementalHydrationMigration
  ],
  
  20: [
    // Angular 19 → 20 specific migrations
    fullSignalMigration,
    zonelessDefaultMigration
  ]
};

// All codemods for backward compatibility
export const allMigrationCodemods: Codemod[] = [
  ...MIGRATION_CODEMODS[17],
  ...MIGRATION_CODEMODS[18],
  ...MIGRATION_CODEMODS[19],
  ...MIGRATION_CODEMODS[20]
];

/**
 * Get codemods for a specific Angular version migration
 */
export function getCodemodsForVersion(targetVersion: number): Codemod[] {
  return MIGRATION_CODEMODS[targetVersion] || [];
}

/**
 * Get codemods for a migration path (from version to version)
 */
export function getCodemodsForMigrationPath(fromVersion: number, toVersion: number): Codemod[] {
  const codemods: Codemod[] = [];
  
  for (let version = fromVersion + 1; version <= toVersion; version++) {
    codemods.push(...getCodemodsForVersion(version));
  }
  
  return codemods;
}

/**
 * Get all available migration versions
 */
export function getAvailableMigrationVersions(): number[] {
  return Object.keys(MIGRATION_CODEMODS).map(v => parseInt(v, 10)).sort((a, b) => a - b);
}