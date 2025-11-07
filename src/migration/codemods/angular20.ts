/**
 * Angular 19 to 20 Migration Codemods
 */

import { SourceFile, SyntaxKind } from 'ts-morph';
import { Codemod, CodemodResult, Issue, IssueSeverity } from '../../types';

export const fullSignalMigration: Codemod = {
  name: 'Full Signal Migration',
  description: 'Migrate to signal-based inputs and outputs',
  version: '20',
  apply: (sourceFile: SourceFile, filePath: string): CodemodResult => {
    const issues: Issue[] = [];
    let changed = false;

    // Look for @Input() decorators that can be migrated to input()
    const classes = sourceFile.getClasses();
    
    for (const cls of classes) {
      const properties = cls.getProperties();
      
      for (const property of properties) {
        const inputDecorator = property.getDecorator('Input');
        
        if (inputDecorator) {
          issues.push({
            id: 'signal-input-migration',
            filePath,
            line: property.getStartLineNumber(),
            column: property.getStartLinePos(),
            severity: IssueSeverity.INFO,
            message: `Property '${property.getName()}' can be migrated to signal input()`,
            rule: 'full-signal-migration',
            fixAvailable: true
          });
          
          // Auto-migrate to signal input
          const propertyName = property.getName();
          const typeNode = property.getTypeNode();
          const typeText = typeNode ? typeNode.getText() : 'any';
          
          // Remove @Input() decorator
          inputDecorator.remove();
          
          // Convert to signal input
          property.set({
            name: propertyName,
            initializer: `input<${typeText}>()`
          });
          
          // Add import for input signal
          sourceFile.addImportDeclaration({
            moduleSpecifier: '@angular/core',
            namedImports: ['input']
          });
          
          changed = true;
        }
        
        // Similar logic for @Output()
        const outputDecorator = property.getDecorator('Output');
        
        if (outputDecorator) {
          issues.push({
            id: 'signal-output-migration',
            filePath,
            line: property.getStartLineNumber(),
            column: property.getStartLinePos(),
            severity: IssueSeverity.INFO,
            message: `Property '${property.getName()}' can be migrated to signal output()`,
            rule: 'full-signal-migration',
            fixAvailable: true
          });
          
          // Auto-migrate to signal output
          const propertyName = property.getName();
          
          // Remove @Output() decorator
          outputDecorator.remove();
          
          // Convert to signal output
          property.set({
            name: propertyName,
            initializer: `output()`
          });
          
          // Add import for output signal
          sourceFile.addImportDeclaration({
            moduleSpecifier: '@angular/core',
            namedImports: ['output']
          });
          
          changed = true;
        }
      }
    }

    return { changed, issues };
  }
};

export const zonelessDefaultMigration: Codemod = {
  name: 'Zoneless Default Migration',
  description: 'Configure for zoneless change detection',
  version: '20',
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
        
        // Check if zoneless change detection is configured
        if (!providersText.includes('provideExperimentalZonelessChangeDetection')) {
          issues.push({
            id: 'zoneless-change-detection',
            filePath,
            line: call.getStartLineNumber(),
            column: call.getStartLinePos(),
            severity: IssueSeverity.WARNING,
            message: 'Angular 20 defaults to zoneless change detection. Consider enabling provideExperimentalZonelessChangeDetection()',
            rule: 'zoneless-default-migration',
            fixAvailable: true
          });

          // Auto-fix: Add zoneless change detection
          if (providersArg.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const obj = providersArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
            const providersProperty = obj.getProperty('providers');
            
            if (providersProperty && providersProperty.getKind() === SyntaxKind.PropertyAssignment) {
              const propAssignment = providersProperty.asKindOrThrow(SyntaxKind.PropertyAssignment);
              const providersArray = propAssignment.getInitializer();
              if (providersArray?.getKind() === SyntaxKind.ArrayLiteralExpression) {
                const array = providersArray.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
                
                // Add zoneless import
                sourceFile.addImportDeclaration({
                  moduleSpecifier: '@angular/core',
                  namedImports: ['provideExperimentalZonelessChangeDetection']
                });
                
                // Add to providers array
                array.addElement('provideExperimentalZonelessChangeDetection()');
                changed = true;
              }
            }
          }
        }

        // Check if zone.js is still imported and suggest removal
        const imports = sourceFile.getImportDeclarations();
        const zoneImport = imports.find(imp => 
          imp.getModuleSpecifierValue().includes('zone.js')
        );
        
        if (zoneImport && providersText.includes('provideExperimentalZonelessChangeDetection')) {
          issues.push({
            id: 'zone-js-removal',
            filePath,
            line: zoneImport.getStartLineNumber(),
            column: zoneImport.getStartLinePos(),
            severity: IssueSeverity.INFO,
            message: 'zone.js import can be removed when using zoneless change detection',
            rule: 'zoneless-default-migration',
            fixAvailable: true
          });
          
          // Auto-fix: Remove zone.js import
          zoneImport.remove();
          changed = true;
        }
      }
    }

    return { changed, issues };
  }
};