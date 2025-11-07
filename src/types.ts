import { SourceFile } from 'ts-morph';

export enum IssueSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export interface Issue {
  id: string;
  filePath: string;
  line: number;
  column: number;
  severity: IssueSeverity;
  message: string;
  rule: string;
  fixAvailable: boolean;
}

export interface CodemodResult {
  changed: boolean;
  issues: Issue[];
}

export interface Codemod {
  name: string;
  description: string;
  version: string; // Angular version this applies to
  apply: (sourceFile: SourceFile, filePath: string) => CodemodResult;
}

export interface FixResult {
  filePath: string;
  original: string;
  modified: string;
  issuesFixed: Issue[];
}
