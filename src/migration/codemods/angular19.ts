/**
 * Angular 18 to 19 Migration Codemods
 */

import { SourceFile, SyntaxKind } from 'ts-morph';
import { Codemod, CodemodResult, Issue, IssueSeverity } from '../../types';

export const standaloneDefaultMigration: Codemod = {
  name: 'Standalone Default Migration',
  description: 'Ensure application is configured for standalone components by default',
  version: '19',
  apply: (sourceFile: SourceFile, filePath: string): CodemodResult => {
    const issues: Issue[] = [];
    let changed = false;

    // Check if this is main.ts
    if (!filePath.endsWith('main.ts')) {
      return { changed: false, issues: [] };
    }

    // Look for platformBrowserDynamic().bootstrapModule() - old module-based bootstrap
    const platformCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => {
        const expr = call.getExpression();
        return expr.getKind() === SyntaxKind.PropertyAccessExpression &&
               expr.asKind(SyntaxKind.PropertyAccessExpression)?.getName() === 'bootstrapModule';
      });

    for (const call of platformCalls) {
      issues.push({
        id: 'module-bootstrap-deprecated',
        filePath,
        line: call.getStartLineNumber(),
        column: call.getStartLinePos(),
        severity: IssueSeverity.WARNING,
        message: 'Module-based bootstrap is deprecated. Consider migrating to standalone components with bootstrapApplication',
        rule: 'standalone-default-migration',
        fixAvailable: false // This requires manual migration
      });
    }

    return { changed, issues };
  }
};

export const incrementalHydrationMigration: Codemod = {
  name: 'Incremental Hydration Migration',
  description: 'Enable incremental hydration for better performance',
  version: '19',
  apply: (sourceFile: SourceFile, filePath: string): CodemodResult => {
    const issues: Issue[] = [];
    let changed = false;

    // Check if this is main.ts
    if (!filePath.endsWith('main.ts')) {
      return { changed: false, issues: [] };
    }

    // Look for bootstrapApplication call
    const bootstrapCalls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => call.getExpression().getText() === 'bootstrapApplication');

    for (const call of bootstrapCalls) {
      const args = call.getArguments();
      if (args.length >= 2) {
        const providersArg = args[1];
        const providersText = providersArg.getText();
        
        // Check if hydration is already configured
        if (!providersText.includes('provideClientHydration')) {
          issues.push({
            id: 'incremental-hydration-missing',
            filePath,
            line: call.getStartLineNumber(),
            column: call.getStartLinePos(),
            severity: IssueSeverity.INFO,
            message: 'Consider adding provideClientHydration() with incremental hydration for better performance',
            rule: 'incremental-hydration-migration',
            fixAvailable: true
          });

          // Auto-fix: Add provideClientHydration
          if (providersArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const obj = providersArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
            const providersProperty = obj.getProperty('providers');
            
            if (providersProperty && providersProperty.getKind() === SyntaxKind.PropertyAssignment) {
              const propAssignment = providersProperty.asKindOrThrow(SyntaxKind.PropertyAssignment);
              const providersArray = propAssignment.getInitializer();
              if (providersArray?.getKind() === SyntaxKind.ArrayLiteralExpression) {
                const array = providersArray.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
                
                // Add hydration import
                sourceFile.addImportDeclaration({
                  moduleSpecifier: '@angular/platform-browser',
                  namedImports: ['provideClientHydration']
                });
                
                // Add to providers array
                array.addElement('provideClientHydration()');
                changed = true;
              }
            }
          }
        }
      }
    }

    return { changed, issues };
  }
};