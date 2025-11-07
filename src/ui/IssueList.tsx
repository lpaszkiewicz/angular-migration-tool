import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import Spinner from 'ink-spinner';
import SelectInput from 'ink-select-input';
import { Issue, IssueSeverity } from '../types';
import { ScanResult } from '../detector';

interface Props {
  scanResult: ScanResult | null;
  isScanning: boolean;
  onSelectIssue: (issue: Issue) => void;
  onFixAll: () => void;
  onExit: () => void;
}

const getSeverityColor = (severity: IssueSeverity): string => {
  switch (severity) {
    case IssueSeverity.ERROR: return 'red';
    case IssueSeverity.WARNING: return 'yellow';
    case IssueSeverity.INFO: return 'blue';
    default: return 'white';
  }
};

export const IssueList: React.FC<Props> = ({ 
  scanResult, 
  isScanning, 
  onSelectIssue,
  onFixAll,
  onExit 
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (isScanning) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text> Scanning Angular project for issues...</Text>
        </Box>
      </Box>
    );
  }

  if (!scanResult) {
    return <Text color="red">No scan results available</Text>;
  }

  if (scanResult.issues.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="green">✓ No issues found! Your Angular project looks good.</Text>
        <Newline />
        <Text dimColor>Scanned {scanResult.totalFiles} files</Text>
      </Box>
    );
  }

  const items = [
    ...scanResult.issues.map((issue, idx) => ({
      label: `[${issue.severity.toUpperCase()}] ${issue.message} (${issue.filePath}:${issue.line})`,
      value: `issue-${idx}`,
      issue
    })),
    { label: '---', value: 'separator', disabled: true },
    { label: '🔧 Fix all fixable issues', value: 'fix-all' },
    { label: '❌ Exit', value: 'exit' }
  ];

  const handleSelect = (item: any) => {
    if (item.value === 'fix-all') {
      onFixAll();
    } else if (item.value === 'exit') {
      onExit();
    } else if (item.issue) {
      onSelectIssue(item.issue);
    }
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">Angular Migration Assistant (v17-20)</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text>
          Found <Text bold color="yellow">{scanResult.issues.length}</Text> issues 
          in <Text bold>{scanResult.filesWithIssues}</Text> files
          {' '}({scanResult.fixableIssues} fixable)
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>Select an issue to view details or choose an action:</Text>
      </Box>

      <SelectInput items={items} onSelect={handleSelect} />
    </Box>
  );
};
