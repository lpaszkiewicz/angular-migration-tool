# Peer Dependency Resolution Improvements

## Changes Made

### 1. Increased Buffer Size for npm Commands
**Problem:** `ENOBUFS` errors when checking npm registry for package information.

**Solution:** Added `maxBuffer: 10 * 1024 * 1024` (10MB) to all `execSync` calls:
- `getPackageInfo()` - Line ~519
- `getAvailableVersions()` - Line ~502
- `installDependencies()` - Line ~715
- `installDependenciesWithConflictResolution()` - Line ~607
- `runNgUpdateCommands()` - Line ~697

### 2. Automatic Clean Install on Peer Dependency Conflicts
**Problem:** Peer dependency conflicts (ERESOLVE errors) causing installation failures.

**Solution:** Added `installDependenciesWithRetry()` method that:
1. Attempts normal installation
2. If ERESOLVE error detected, performs clean install:
   - Removes `node_modules` directory
   - Removes lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`)
   - Retries installation from scratch
3. Provides clear console feedback during the process

### 3. Improved Peer Dependency Conflict Detection
**Problem:** False positives in peer dependency conflict detection.

**Solution:** 
- Added `versionSatisfiesRange()` helper for better version checking
- Only report conflicts when there's a real incompatibility
- Improved error handling to suppress ENOBUFS warnings in conflict checking
- Better error messages that don't spam console on network issues

### 4. Better Version Satisfaction Checking
**Problem:** Version checking was too strict, causing unnecessary conflicts.

**Solution:**
- Use `semver.coerce()` for more flexible version parsing
- Check for actual conflicts before reporting them
- Only flag unsatisfied requirements as true conflicts

## Benefits

1. **No Forced Installations:** Migration tool resolves conflicts properly without requiring `--force` or `--legacy-peer-deps`

2. **Automatic Recovery:** Clean install strategy automatically recovers from peer dependency conflicts

3. **Better User Experience:** 
   - Clear console messages during conflict resolution
   - Reduced false positive warnings
   - Automatic retry with clean install

4. **Network Resilient:** Handles ENOBUFS and other network errors gracefully

## Testing

The fixes were tested with:
- Angular 17 → 18 migration
- Multiple peer dependency conflicts
- Various package managers (npm primary focus)
- Clean installation after conflicts

## Usage

No changes to CLI usage required. The improvements work automatically:

```bash
# Standard migration - now handles peer deps automatically
ang-fix migrate 18

# Skip peer dep checking entirely if needed
ang-fix migrate 18 --no-peer-resolution

# Skip dependency updates (code mods only)
ang-fix migrate 18 --skip-deps
```

## Technical Details

### New Methods Added:
- `installDependenciesWithRetry(result: DependencyUpdateResult): Promise<void>`
- `cleanNodeModules(): Promise<void>`
- `versionSatisfiesRange(version: string, range: string): boolean`

### Modified Methods:
- `updateDependencies()` - Now calls `installDependenciesWithRetry()` instead of `installDependencies()`
- `checkPeerDependencies()` - Improved conflict detection and error handling
- All `execSync()` calls - Added `maxBuffer` option

## Future Improvements

Potential enhancements:
1. Support for `pnpm` specific peer dependency handling
2. Interactive conflict resolution mode
3. Caching of npm registry queries to reduce ENOBUFS risk
4. Parallel package info fetching with rate limiting
