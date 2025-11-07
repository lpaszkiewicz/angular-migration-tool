import { SourceFile } from 'ts-morph';
import { Codemod, CodemodResult, Issue, IssueSeverity } from '../types';

/**
 * Ensure ChangeDetectionStrategy is imported from @angular/core
 * Returns true if it modified the SourceFile.
 */
export const importFix: Codemod = {
  name: 'import-change-detection-strategy',
  description: 'Ensure ChangeDetectionStrategy is imported',
  version: 'all',
  apply: (sourceFile: SourceFile, filePath: string): CodemodResult => {
    const issues: Issue[] = [];
    let changed = false;

    const imports = sourceFile.getImportDeclarations();
    for (const imp of imports) {
      const spec = imp.getModuleSpecifierValue();
      if (spec === '@angular/core') {
        const named = imp.getNamedImports().map(n => n.getName());
        if (!named.includes('ChangeDetectionStrategy')) {
          const line = imp.getStartLineNumber();
          
          issues.push({
            id: `import-cds-${filePath}-${line}`,
            filePath,
            line,
            column: imp.getStartLinePos(),
            severity: IssueSeverity.INFO,
            message: 'Added ChangeDetectionStrategy to imports',
            rule: 'import-change-detection-strategy',
            fixAvailable: true
          });
          
          imp.addNamedImport('ChangeDetectionStrategy');
          changed = true;
        }
      }
    }

    return { changed, issues };
  }
};
