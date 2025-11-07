import React, { useState, useEffect } from 'react';
import { render } from 'ink';
import { IssueList } from './IssueList';
import { scanForIssues, applyFixes, ScanResult } from '../detector';
import { Issue } from '../types';

interface InteractiveAppProps {
  pattern: string;
}

const InteractiveApp: React.FC<InteractiveAppProps> = ({ pattern }) => {
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [shouldExit, setShouldExit] = useState(false);

  useEffect(() => {
    (async () => {
      const result = await scanForIssues(pattern);
      setScanResult(result);
      setIsScanning(false);
    })();
  }, [pattern]);

  const handleSelectIssue = (issue: Issue) => {
    // TODO: Show issue details in a separate view
    console.log('Selected issue:', issue);
  };

  const handleFixAll = async () => {
    if (!scanResult) return;
    
    setIsScanning(true);
    const fixableIssueIds = scanResult.issues
      .filter(i => i.fixAvailable)
      .map(i => i.id);
    
    await applyFixes(pattern, { 
      dryRun: false, 
      issueIds: fixableIssueIds 
    });
    
    // Re-scan after fixes
    const result = await scanForIssues(pattern);
    setScanResult(result);
    setIsScanning(false);
  };

  const handleExit = () => {
    setShouldExit(true);
    process.exit(0);
  };

  if (shouldExit) {
    return null;
  }

  return (
    <IssueList
      scanResult={scanResult}
      isScanning={isScanning}
      onSelectIssue={handleSelectIssue}
      onFixAll={handleFixAll}
      onExit={handleExit}
    />
  );
};

export function startInteractiveMode(pattern: string) {
  render(<InteractiveApp pattern={pattern} />);
}
