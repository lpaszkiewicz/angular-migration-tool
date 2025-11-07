import { SourceFile, SyntaxKind } from 'ts-morph';
import { Codemod, CodemodResult, Issue, IssueSeverity } from '../types';

/**
 * Migrate constructor DI to inject() function (Angular 14+, recommended in 17+)
 * Converts constructor parameters to inject() calls
 */
export const injectFunctionMigration: Codemod = {
  name: 'inject-function',
  description: 'Migrate constructor DI to inject() function (Angular 14+)',
  version: '14+',
  apply: (sourceFile: SourceFile, filePath: string): CodemodResult => {
    const issues: Issue[] = [];
    let changed = false;

    const classes = sourceFile.getClasses();
    
    for (const cls of classes) {
      const decorator = cls.getDecorator('Component') || cls.getDecorator('Directive') || cls.getDecorator('Injectable');
      if (!decorator) continue;

      const constructor = cls.getConstructors()[0];
      if (!constructor) continue;

      const params = constructor.getParameters();
      if (params.length === 0) continue;

      const line = constructor.getStartLineNumber();
      
      // Only detect for now, actual migration is complex
      issues.push({
        id: `inject-${filePath}-${line}`,
        filePath,
        line,
        column: constructor.getStartLinePos(),
        severity: IssueSeverity.INFO,
        message: `Consider migrating ${params.length} constructor injection(s) to inject() function (Angular 14+)`,
        rule: 'inject-function',
        fixAvailable: false // Complex migration, suggest only
      });
    }

    return { changed, issues };
  }
};
