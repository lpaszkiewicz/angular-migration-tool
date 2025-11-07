import { Codemod } from '../types';
import { standaloneComponentMigration } from './standaloneComponents';
import { injectFunctionMigration } from './injectFunction';
import { removeModuleId } from './removeModuleId';
import { rxjsImportMigration } from './rxjsImports';
import { importFix } from './importFixNew';

export const allCodemods: Codemod[] = [
  removeModuleId,
  standaloneComponentMigration,
  rxjsImportMigration,
  injectFunctionMigration,
  importFix
];

export function getCodemodsForVersion(version: number): Codemod[] {
  return allCodemods.filter(codemod => {
    if (codemod.version === 'all') return true;
    
    const versionMatch = codemod.version.match(/(\d+)\+/);
    if (versionMatch) {
      const minVersion = parseInt(versionMatch[1]);
      return version >= minVersion;
    }
    
    return true;
  });
}
