# Publishing to NPM - Step-by-Step Guide

## Prerequisites

1. **NPM Account**: Create an account at https://www.npmjs.com/
2. **NPM CLI**: Ensure you have npm installed and are logged in
3. **Git Repository**: Your code should be in a Git repository (GitHub recommended)

## Quick Setup Checklist

✅ **package.json** - Updated with npm-ready configuration
✅ **README.md** - Comprehensive documentation for users
✅ **LICENSE** - MIT license included
✅ **.npmignore** - Excludes unnecessary files from package
✅ **dist/** - Built JavaScript files ready for distribution
✅ **TypeScript declarations** - .d.ts files for TypeScript users

## Step 1: Verify Your Package Configuration

Your `package.json` is already configured for npm publishing:

```json
{
  "name": "angular-advanced-migration",
  "version": "2.0.0",
  "description": "Advanced Angular 17-20 migration tool...",
  "main": "dist/cli.js",
  "bin": {
    "ang-fix": "dist/cli.js"
  },
  "files": [
    "dist/**/*",
    "README.md", 
    "MIGRATION_README.md",
    "LICENSE"
  ]
}
```

## Step 2: Build and Test Your Package

```bash
# Build the project
npm run build

# Test the built CLI locally
node dist/cli.js versions
node dist/cli.js --help

# Test installation locally (optional)
npm pack
npm install -g angular-advanced-migration-2.0.0.tgz
```

## Step 3: Login to NPM

```bash
# Login to your npm account
npm login

# Verify you're logged in
npm whoami
```

## Step 4: Check Package Name Availability

```bash
# Check if the package name is available
npm view angular-advanced-migration

# If the package exists, you'll need to:
# 1. Choose a different name, OR
# 2. Contact the current owner if it's unused
```

## Step 5: Publish Your Package

### First-time Publishing

```bash
# Publish to npm
npm publish

# For scoped packages (if using @yourname/package-name)
npm publish --access public
```

### Version Updates

```bash
# Update version and publish
npm version patch  # 2.0.0 → 2.0.1
npm version minor  # 2.0.0 → 2.1.0  
npm version major  # 2.0.0 → 3.0.0

# Publish the new version
npm publish
```

## Step 6: Verify Publication

```bash
# Check your package on npm
npm view angular-advanced-migration

# Test installation from npm
npm install -g angular-advanced-migration

# Test the global command
ang-fix versions
```

## Alternative Package Names (if needed)

If `angular-advanced-migration` is taken, consider these alternatives:

- `angular-migration-pro`
- `ng-migration-tool`
- `angular-upgrade-assistant`
- `@yourusername/angular-migration`
- `angular-version-migrator`

## Package Management Commands

```bash
# View package info
npm view angular-advanced-migration

# View all versions
npm view angular-advanced-migration versions --json

# Unpublish (only within 72 hours)
npm unpublish angular-advanced-migration@2.0.0

# Deprecate a version
npm deprecate angular-advanced-migration@2.0.0 "Use version 2.1.0 instead"
```

## Best Practices

### Semantic Versioning
- **Patch (2.0.1)**: Bug fixes, no breaking changes
- **Minor (2.1.0)**: New features, no breaking changes  
- **Major (3.0.0)**: Breaking changes

### Pre-publish Checklist
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] README is up-to-date
- [ ] Version number is correct
- [ ] No sensitive information in code
- [ ] .npmignore excludes development files

### Security
- [ ] Use `npm audit` to check for vulnerabilities
- [ ] Keep dependencies up-to-date
- [ ] Don't include secrets or API keys

## Automation (Optional)

### GitHub Actions for Auto-publishing

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### NPM Scripts for Release Management

Add to your `package.json`:

```json
{
  "scripts": {
    "release:patch": "npm version patch && npm publish",
    "release:minor": "npm version minor && npm publish", 
    "release:major": "npm version major && npm publish"
  }
}
```

## Troubleshooting

### Common Issues

**403 Forbidden Error**
```bash
# Check if you're logged in
npm whoami

# Check package permissions
npm owner ls angular-advanced-migration
```

**Package name conflicts**
```bash
# Search for similar names
npm search angular migration
```

**Build errors**
```bash
# Clean and rebuild
rm -rf dist/ node_modules/
npm install
npm run build
```

## After Publishing

1. **Update Documentation**: Add installation instructions to README
2. **Create GitHub Release**: Tag your version in GitHub
3. **Share**: Announce on social media, Angular communities
4. **Monitor**: Watch for issues and user feedback

## Example Full Workflow

```bash
# 1. Prepare for publishing
git add .
git commit -m "Prepare v2.0.0 for npm publishing"
git push origin main

# 2. Build and test
npm run build
npm test  # if you have tests

# 3. Publish
npm login
npm publish

# 4. Verify
npm view angular-advanced-migration
npm install -g angular-advanced-migration
ang-fix --help

# 5. Create GitHub release
git tag v2.0.0
git push origin v2.0.0
```

## Success! 🎉

Your package is now available worldwide:

- **NPM**: https://www.npmjs.com/package/angular-advanced-migration
- **Install**: `npm install -g angular-advanced-migration`
- **Usage**: `ang-fix migrate 18`

Users can now install and use your Angular migration tool from anywhere in the world!