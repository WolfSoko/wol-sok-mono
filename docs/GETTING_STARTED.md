# Getting Started Guide

Welcome to the wol-sok-mono repository! This guide will help you set up your development environment and start contributing.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Troubleshooting](#troubleshooting)
- [First Steps](#first-steps)
- [Development Workflow](#development-workflow)
- [IDE Setup](#ide-setup)

## Prerequisites

### Required Software

1. **Node.js**
   - Version: **20.x** (as specified in `.nvmrc`)
   - Download: [nodejs.org](https://nodejs.org/)
   - Or use [nvm](https://github.com/nvm-sh/nvm): `nvm install`

2. **npm**
   - Version: **10.x or higher** (comes with Node.js)
   - Check version: `npm --version`

3. **Git**
   - Version: **2.x or higher**
   - Download: [git-scm.com](https://git-scm.com/)

### System Dependencies (for node-gyp)

The repository uses native modules that require compilation tools.

#### macOS

```bash
xcode-select --install
```

#### Ubuntu/Debian Linux

```bash
sudo apt-get update
sudo apt-get install -y build-essential python3 libx11-dev libxi-dev libxext-dev
```

#### Windows

Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022):
- Select "Desktop development with C++"
- Or use: `npm install --global windows-build-tools`

### Optional but Recommended

- **nvm** (Node Version Manager): Manage multiple Node.js versions
- **VS Code**: Recommended IDE with extensions
- **Git GUI**: GitKraken, GitHub Desktop, or SourceTree

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/WolfSoko/wol-sok-mono.git
cd wol-sok-mono
```

### 2. Use Correct Node Version

If using nvm:

```bash
nvm use
# If version not installed: nvm install
```

Verify Node version:

```bash
node --version  # Should output v20.x.x
```

### 3. Install Dependencies

```bash
npm ci
```

**Note**: Use `npm ci` (clean install) instead of `npm install` for consistent dependencies.

This may take 5-10 minutes depending on your system and internet connection.

### 4. Verify Installation

Check that Nx is available:

```bash
npx nx --version
```

List available projects:

```bash
npx nx show projects
```

## Troubleshooting

### Common Issues

#### Issue: `node-gyp` Build Errors

**Symptom**: Installation fails with errors about `node-gyp`, `gl`, or native modules.

**Solutions**:

1. **Install system build tools** (see [Prerequisites](#system-dependencies-for-node-gyp))

2. **Clear npm cache**:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm ci
   ```

3. **Set Python version** (if you have multiple Python installations):
   ```bash
   npm config set python /usr/bin/python3
   ```

4. **Skip optional dependencies** (temporary workaround):
   ```bash
   npm ci --no-optional
   ```

#### Issue: Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::4200`

**Solutions**:

1. **Kill process on port**:
   ```bash
   # macOS/Linux
   lsof -ti:4200 | xargs kill -9
   
   # Windows
   netstat -ano | findstr :4200
   taskkill /PID <PID> /F
   ```

2. **Use different port**:
   ```bash
   npx nx serve pacetrainer --port 4201
   ```

#### Issue: Out of Memory

**Symptom**: `JavaScript heap out of memory`

**Solutions**:

1. **Increase Node.js memory**:
   ```bash
   export NODE_OPTIONS="--max_old_space_size=8192"
   # Add to ~/.bashrc or ~/.zshrc for persistence
   ```

2. **Use provided script** (for production builds):
   ```bash
   npm run start:prod
   ```

#### Issue: Permission Errors (npm)

**Symptom**: `EACCES` permission errors during installation

**Solutions**:

1. **Don't use sudo with npm** (causes permission issues)

2. **Fix npm permissions**:
   ```bash
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
   source ~/.profile
   ```

#### Issue: Nx Commands Not Found

**Symptom**: `nx: command not found`

**Solution**: Always use `npx nx` instead of just `nx`

```bash
npx nx serve pacetrainer  # ✓ Correct
nx serve pacetrainer      # ✗ Won't work
```

#### Issue: Git Hooks Not Running

**Symptom**: Pre-commit hooks don't run

**Solution**: Reinstall Husky:

```bash
npm run prepare
```

## First Steps

### 1. Explore the Project Structure

```bash
# View project dependency graph
npx nx graph

# List all projects
npx nx show projects

# Show project details
npx nx show project pacetrainer
```

### 2. Run Your First Application

Start the development server:

```bash
npx nx serve pacetrainer
```

The application will be available at: http://localhost:4200

### 3. Make a Test Change

1. Open `apps/pacetrainer/src/app/app.component.ts`
2. Modify the component template
3. Save the file
4. See the changes hot-reload in your browser

### 4. Run Tests

```bash
# Run unit tests for a project
npx nx test pacetrainer

# Run all tests
npx nx run-many -t test

# Run tests in watch mode
npx nx test pacetrainer --watch
```

### 5. Lint Your Code

```bash
# Lint a specific project
npx nx lint pacetrainer

# Lint and auto-fix
npx nx lint pacetrainer --fix

# Lint all projects
npm run lint
```

## Development Workflow

### Daily Workflow

1. **Pull latest changes**:
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Update dependencies** (if needed):
   ```bash
   npm ci
   ```

3. **Create a feature branch**:
   ```bash
   git checkout -b feat/my-feature
   ```

4. **Make changes** and test locally:
   ```bash
   npx nx serve <project>
   npx nx test <project>
   npx nx lint <project> --fix
   ```

5. **Commit changes** (following [Conventional Commits](https://www.conventionalcommits.org/)):
   ```bash
   git add .
   git commit -m "feat(pacetrainer): add new timer feature"
   ```

6. **Push and create PR**:
   ```bash
   git push origin feat/my-feature
   # Then create Pull Request on GitHub
   ```

### Running Different Applications

#### Main Applications

```bash
# Angular Examples (main showcase)
npx nx serve angular-examples
# → http://localhost:4200

# Pacetrainer
npx nx serve pacetrainer
# → http://localhost:4200

# Rollapolla (Analog.js)
npx nx serve rollapolla-analog
# → http://localhost:4200
```

#### Remote Applications

These are typically loaded via Module Federation:

```bash
# Fourier Analysis
npx nx serve fourier-analysis-remote --port 4201

# Bacteria Game
npx nx serve bacteria-game-remote --port 4202

# Shader Examples
npx nx serve shader-examples-remote --port 4203
```

### Building for Production

```bash
# Build a specific application
npx nx build pacetrainer --configuration production

# Build all applications
npx nx run-many -t build --configuration production

# Build only affected projects
npx nx affected -t build --configuration production
```

### Running E2E Tests

```bash
# Run E2E tests
npx nx run pacetrainer:e2e

# Run E2E tests in UI mode (interactive)
npx nx run pacetrainer:e2e --ui

# Run specific test file
npx nx run pacetrainer:e2e --grep "login"
```

### Using Nx Affected Commands

Only test/build/lint projects affected by your changes:

```bash
# Test affected projects
npx nx affected -t test

# Build affected projects
npx nx affected -t build

# Lint affected projects
npx nx affected -t lint

# Run multiple targets on affected projects
npx nx affected -t lint,test,build
```

## IDE Setup

### Visual Studio Code (Recommended)

#### Required Extensions

Install these extensions from VS Code marketplace:

1. **Angular Language Service** (`Angular.ng-template`)
   - Angular template IntelliSense and error checking

2. **ESLint** (`dbaeumer.vscode-eslint`)
   - Real-time linting in editor

3. **Prettier - Code formatter** (`esbenp.prettier-vscode`)
   - Auto-formatting on save

4. **Nx Console** (`nrwl.angular-console`)
   - Visual interface for Nx commands

#### Recommended Extensions

5. **GitLens** (`eamodio.gitlens`)
   - Enhanced Git capabilities

6. **Error Lens** (`usernamehw.errorlens`)
   - Inline error messages

7. **Auto Rename Tag** (`formulahendry.auto-rename-tag`)
   - Auto-rename paired HTML tags

8. **Path Intellisense** (`christian-kohler.path-intellisense`)
   - Autocomplete file paths

#### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[html]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[scss]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### WebStorm / IntelliJ IDEA

1. **Enable Angular Plugin**: Preferences → Plugins → Install "Angular"
2. **Set Node Interpreter**: Preferences → Languages & Frameworks → Node.js
3. **Enable ESLint**: Preferences → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
4. **Enable Prettier**: Preferences → Languages & Frameworks → JavaScript → Prettier
5. **Set TypeScript Version**: Preferences → Languages & Frameworks → TypeScript → Use project TypeScript

## Next Steps

Now that you're set up, explore these resources:

1. **[Architecture Overview](./ARCHITECTURE.md)** - Understand the project structure
2. **[Contributing Guide](./CONTRIBUTING.md)** - Learn how to contribute
3. **[Testing Guide](./TESTING.md)** - Learn testing practices
4. **[Angular Guide](./ANGULAR.md)** - Angular patterns used in this repo

## Getting Help

- **Issues**: Check [existing issues](https://github.com/WolfSoko/wol-sok-mono/issues)
- **Discussions**: Start a [discussion](https://github.com/WolfSoko/wol-sok-mono/discussions)
- **Documentation**: Browse other docs in the `docs/` folder

## Quick Reference

### Essential Commands

```bash
# Development
npx nx serve <project>                    # Start dev server
npx nx test <project>                     # Run tests
npx nx lint <project> --fix               # Lint and fix
npx nx build <project>                    # Build project

# Monorepo
npx nx graph                              # Visualize dependencies
npx nx affected -t test                   # Test affected
npx nx run-many -t build                  # Build all

# Utilities
npm run lint                              # Lint all
npm test                                  # Test all
npm ci                                    # Clean install
```

Happy coding! 🚀
