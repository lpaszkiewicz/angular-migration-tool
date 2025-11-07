import { SourceFile } from 'ts-morph';

/**
 * Example codemod: ensure ChangeDetectionStrategy is imported from @angular/core
 * Returns true if it modified the SourceFile.
 */
export function applyImportFix(sourceFile: SourceFile): boolean {
  let changed = false;

  const imports = sourceFile.getImportDeclarations();
  for (const imp of imports) {
    const spec = imp.getModuleSpecifierValue();
    if (spec === '@angular/core') {
      const named = imp.getNamedImports().map(n => n.getName());
      if (!named.includes('ChangeDetectionStrategy')) {
        imp.addNamedImport('ChangeDetectionStrategy');
        changed = true;
      }
    }
  }

  return changed;
}
