import { Project, SourceFile } from 'ts-morph';
import { sync as globSync } from 'glob';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { applyImportFix } from './codemods/importFix';

export async function runFixes(pattern: string, dryRun = true) {
  const files = globSync(pattern, { ignore: 'node_modules/**' });
  if (files.length === 0) {
    console.log('No files found for', pattern);
    return;
  }

  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
    skipAddingFilesFromTsConfig: true,
  });

  for (const filePath of files) {
    const abs = path.resolve(filePath);
    const sourceFile = project.addSourceFileAtPathIfExists(abs);
    if (!sourceFile) continue;

    const original = sourceFile.getFullText();

    let changed = false;
    // Run codemods (add more as needed)
    changed = applyImportFix(sourceFile) || changed;

    if (changed) {
      const modified = sourceFile.getFullText();
      console.log('\n===', filePath, '===' );
      console.log('--- original (head) ---');
      console.log(original.slice(0, 800));
      console.log('--- modified (head) ---');
      console.log(modified.slice(0, 800));

      if (!dryRun) {
        // write file
        fs.writeFileSync(abs, modified, 'utf8');
        console.log('Wrote', filePath);

        // Try to run ESLint --fix on the file if available
        try {
          // Use npx to ensure local eslint is used when present
          execSync(`npx eslint --fix "${abs}"`, { stdio: 'inherit' });
          console.log('Ran eslint --fix on', filePath);
        } catch (e) {
          // Non-fatal: eslint may not be installed; show a hint
          console.log('eslint --fix failed or is not available (skipping).');
        }
      } else {
        console.log('Dry run: no files written. Use --no-dry-run to apply.');
      }
    }
  }
}
