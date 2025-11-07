import { SourceFile, SyntaxKind } from 'ts-morph';
import { Codemod, CodemodResult, Issue, IssueSeverity } from '../types';

/**
 * Remove deprecated moduleId from @Component (Angular 17+)
 * The moduleId property is no longer needed
 */
export const removeModuleId: Codemod = {
  name: 'remove-module-id',
  description: 'Remove deprecated moduleId from @Component (Angular 17+)',
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

      const moduleIdProp = objLiteral.getProperty('moduleId');
      
      if (moduleIdProp) {
        const line = moduleIdProp.getStartLineNumber();
        
        issues.push({
          id: `module-id-${filePath}-${line}`,
          filePath,
          line,
          column: moduleIdProp.getStartLinePos(),
          severity: IssueSeverity.ERROR,
          message: 'moduleId is deprecated and should be removed (Angular 17+)',
          rule: 'remove-module-id',
          fixAvailable: true
        });

        moduleIdProp.remove();
        changed = true;
      }
    }

    return { changed, issues };
  }
};
