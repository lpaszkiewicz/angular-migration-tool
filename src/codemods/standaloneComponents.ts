import { SourceFile, SyntaxKind } from 'ts-morph';
import { Codemod, CodemodResult, Issue, IssueSeverity } from '../types';

/**
 * Migrate to standalone components (Angular 17+)
 * Adds standalone: true to @Component decorators that don't have it
 */
export const standaloneComponentMigration: Codemod = {
  name: 'standalone-components',
  description: 'Migrate to standalone components (Angular 17+)',
  version: '17+',
  apply: (sourceFile: SourceFile, filePath: string): CodemodResult => {
    const issues: Issue[] = [];
    let changed = false;

    const classes = sourceFile.getClasses();
    
    for (const cls of classes) {
      const decorator = cls.getDecorator('Component');
      if (!decorator) continue;

      const args = decorator.getArguments();
      if (args.length === 0) continue;

      const configObj = args[0];
      if (configObj.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;

      const objLiteral = configObj.asKind(SyntaxKind.ObjectLiteralExpression);
      if (!objLiteral) continue;

      const standaloneProp = objLiteral.getProperty('standalone');
      
      if (!standaloneProp) {
        const line = decorator.getStartLineNumber();
        const column = decorator.getStartLinePos();
        
        issues.push({
          id: `standalone-${filePath}-${line}`,
          filePath,
          line,
          column,
          severity: IssueSeverity.WARNING,
          message: 'Component should migrate to standalone (Angular 17+)',
          rule: 'standalone-components',
          fixAvailable: true
        });

        // Add standalone: true
        objLiteral.addPropertyAssignment({
          name: 'standalone',
          initializer: 'true'
        });
        changed = true;
      }
    }

    return { changed, issues };
  }
};
