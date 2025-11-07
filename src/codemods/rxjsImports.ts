import { SourceFile } from 'ts-morph';
import { Codemod, CodemodResult, Issue, IssueSeverity } from '../types';

/**
 * Update RxJS imports (Angular 17-20 use RxJS 7+)
 * Detect old RxJS import patterns
 */
export const rxjsImportMigration: Codemod = {
  name: 'rxjs-imports',
  description: 'Update RxJS imports for RxJS 7+ (Angular 17-20)',
  version: '17+',
  apply: (sourceFile: SourceFile, filePath: string): CodemodResult => {
    const issues: Issue[] = [];
    let changed = false;

    const imports = sourceFile.getImportDeclarations();
    
    for (const imp of imports) {
      const spec = imp.getModuleSpecifierValue();
      
      // Detect old rxjs/add/* imports
      if (spec.startsWith('rxjs/add/')) {
        const line = imp.getStartLineNumber();
        
        issues.push({
          id: `rxjs-add-${filePath}-${line}`,
          filePath,
          line,
          column: imp.getStartLinePos(),
          severity: IssueSeverity.ERROR,
          message: `Deprecated import pattern: ${spec}. Use 'rxjs' or 'rxjs/operators' instead`,
          rule: 'rxjs-imports',
          fixAvailable: false
        });
      }
      
      // Detect rxjs-compat imports
      if (spec.includes('rxjs-compat')) {
        const line = imp.getStartLineNumber();
        
        issues.push({
          id: `rxjs-compat-${filePath}-${line}`,
          filePath,
          line,
          column: imp.getStartLinePos(),
          severity: IssueSeverity.WARNING,
          message: 'rxjs-compat is deprecated. Migrate to modern RxJS imports',
          rule: 'rxjs-imports',
          fixAvailable: false
        });
      }
    }

    return { changed, issues };
  }
};
