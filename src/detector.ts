import { Project, SourceFile } from 'ts-morph';
import { sync as globSync } from 'glob';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { allCodemods } from './codemods';
import { Issue, FixResult } from './types';

export interface ScanResult {
  totalFiles: number;
  filesWithIssues: number;
  issues: Issue[];
  fixableIssues: number;
}

export interface FixOptions {
  dryRun?: boolean;
  autoFix?: boolean;
  issueIds?: string[]; // Specific issues to fix
}

export async function scanForIssues(pattern: string): Promise<ScanResult> {
  const files = globSync(pattern, { ignore: 'node_modules/**' });
  
  if (files.length === 0) {
    return {
      totalFiles: 0,
      filesWithIssues: 0,
      issues: [],
      fixableIssues: 0
    };
  }

  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
    skipAddingFilesFromTsConfig: true,
  });

  const allIssues: Issue[] = [];
  const filesWithIssues = new Set<string>();

  for (const filePath of files) {
    const abs = path.resolve(filePath);
    const sourceFile = project.addSourceFileAtPathIfExists(abs);
    if (!sourceFile) continue;

    // Run all codemods in detection mode (don't modify yet)
    for (const codemod of allCodemods) {
      const result = codemod.apply(sourceFile, abs);
      
      if (result.issues.length > 0) {
        allIssues.push(...result.issues);
        filesWithIssues.add(abs);
      }
      
      // Revert any changes made during detection
      sourceFile.refreshFromFileSystemSync();
    }
  }

  const fixableIssues = allIssues.filter(i => i.fixAvailable).length;

  return {
    totalFiles: files.length,
    filesWithIssues: filesWithIssues.size,
    issues: allIssues,
    fixableIssues
  };
}

export async function applyFixes(
  pattern: string, 
  options: FixOptions = {}
): Promise<FixResult[]> {
  const { dryRun = true, issueIds } = options;
  
  const files = globSync(pattern, { ignore: 'node_modules/**' });
  const results: FixResult[] = [];

  if (files.length === 0) {
    return results;
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
    const issuesFixed: Issue[] = [];

    // Run codemods
    for (const codemod of allCodemods) {
      const result = codemod.apply(sourceFile, abs);
      
      // Filter by issueIds if provided
      const relevantIssues = issueIds 
        ? result.issues.filter(i => issueIds.includes(i.id))
        : result.issues;
      
      if (relevantIssues.length > 0 && result.changed) {
        changed = true;
        issuesFixed.push(...relevantIssues);
      }
    }

    if (changed) {
      const modified = sourceFile.getFullText();
      
      if (!dryRun) {
        fs.writeFileSync(abs, modified, 'utf8');
        
        // Try ESLint --fix
        try {
          execSync(`npx eslint --fix "${abs}"`, { stdio: 'pipe' });
        } catch (e) {
          // Non-fatal
        }
      }

      results.push({
        filePath: abs,
        original,
        modified,
        issuesFixed
      });
    }
  }

  return results;
}
