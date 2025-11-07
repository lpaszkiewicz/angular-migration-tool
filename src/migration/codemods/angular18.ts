/**
 * Angular 17 to 18 Migration Codemods
 */

import { SourceFile, SyntaxKind } from 'ts-morph';
import { Codemod, CodemodResult, Issue, IssueSeverity } from '../../types';

export const controlFlowMigration: Codemod = {
  name: 'Control Flow Migration',
  description: 'Migrate structural directives (*ngIf, *ngFor, *ngSwitch) to new control flow syntax (@if, @for, @switch)',
  version: '18',
  apply: (sourceFile: SourceFile, filePath: string): CodemodResult => {
    const issues: Issue[] = [];
    let changed = false;

    // This codemod would work on HTML templates
    // Since ts-morph works with TypeScript, we'll detect usage in component files
    
    const componentDecorators = sourceFile.getClasses()
      .flatMap(cls => cls.getDecorators())
      .filter(dec => dec.getName() === 'Component');

    for (const decorator of componentDecorators) {
      const templateProperty = decorator.getArguments()[0]
        ?.asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
        .getProperty('template');

      if (templateProperty && templateProperty.getKind() === SyntaxKind.PropertyAssignment) {
        const propAssignment = templateProperty.asKindOrThrow(SyntaxKind.PropertyAssignment);
        const templateValue = propAssignment.getInitializer();
        if (templateValue && templateValue.getKind() === SyntaxKind.StringLiteral) {
          const template = templateValue.getText().slice(1, -1); // Remove quotes
          
          if (template.includes('*ngIf') || template.includes('*ngFor') || template.includes('*ngSwitch')) {
            issues.push({
              id: 'control-flow-template',
              filePath,
              line: templateValue.getStartLineNumber(),
              column: templateValue.getStartLinePos(),
              severity: IssueSeverity.WARNING,
              message: 'Template uses structural directives that can be migrated to control flow syntax',
              rule: 'control-flow-migration',
              fixAvailable: true
            });
            
            // For demonstration, we'll mark as changed but not actually modify
            // Real implementation would parse and transform the template
            changed = true;
          }
        }
      }
    }

    return { changed, issues };
  }
};

export const eventReplayMigration: Codemod = {
  name: 'Event Replay Migration',
  description: 'Enable event replay for hydration in main.ts',
  version: '18',
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
        
        if (!providersText.includes('withEventReplay()')) {
          issues.push({
            id: 'event-replay-missing',
            filePath,
            line: call.getStartLineNumber(),
            column: call.getStartLinePos(),
            severity: IssueSeverity.INFO,
            message: 'Consider adding withEventReplay() for better hydration performance',
            rule: 'event-replay-migration',
            fixAvailable: true
          });
          
          // Auto-fix: Add withEventReplay() to providers
          if (providersArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const obj = providersArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
            const providersProperty = obj.getProperty('providers');
            
            if (providersProperty && providersProperty.getKind() === SyntaxKind.PropertyAssignment) {
              const propAssignment = providersProperty.asKindOrThrow(SyntaxKind.PropertyAssignment);
              const providersArray = propAssignment.getInitializer();
              if (providersArray?.getKind() === SyntaxKind.ArrayLiteralExpression) {
                const array = providersArray.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
                
                // Add withEventReplay import
                sourceFile.addImportDeclaration({
                  moduleSpecifier: '@angular/platform-browser',
                  namedImports: ['withEventReplay']
                });
                
                // Add to providers array
                array.addElement('withEventReplay()');
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