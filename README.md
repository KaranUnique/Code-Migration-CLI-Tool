# Code Migration CLI

A powerful, cross-platform command-line tool for detecting and automatically fixing deprecated API usages and invalid syntax patterns in your codebase. Perfect for code migrations, refactoring, and maintaining code quality across large projects.

## 🚀 Features

- **Multi-language Support**: JavaScript, TypeScript, Python, Java, C/C++, and more
- **Configurable Rules**: Custom pattern detection with JSON configuration
- **Automatic Fixes**: Safe pattern replacement with backup creation
- **Cross-platform**: Works seamlessly on Windows, macOS, and Linux
- **Colored Output**: Beautiful, readable terminal output with progress indicators
- **Dry Run Mode**: Preview changes before applying them
- **Robust Error Handling**: Graceful handling of edge cases and large codebases
- **Performance Optimized**: Efficient scanning of large projects with memory management

## 📦 Installation

### Prerequisites

- Node.js 14.0.0 or higher
- npm or yarn package manager

### Install from npm (when published)

```bash
npm install -g code-migration-cli
```

### Install from source

```bash
git clone https://github.com/username/code-migration-cli.git
cd code-migration-cli
npm install
npm link  # Makes 'code-migrate' command available globally
```

## 🎯 Quick Start

### Basic Usage

Scan your project directory for issues:

```bash
code-migrate ./src
```

Scan and automatically fix issues:

```bash
code-migrate ./src --fix
```

Preview what would be fixed without making changes:

```bash
code-migrate ./src --dry-run
```

### Example Output

```
🔍 Starting code migration scan...
Target directory: ./src
✓ Found 25 files in 45ms

📋 Analyzing 25 files...
⏳ Scanning files ████████████████████ 100% (25/25)
✓ Analyzed 25 files in 1.2s

📊 Generating report...

Found 8 issues in 3 files:

src/main.js
  ⚠ Replace var with const src/main.js:5:1 "var userName" [var-to-const]
  ✖ Replace deprecated substr() src/main.js:12:20 ".substr(" [deprecated-substr]
  ℹ Console.log statements src/main.js:15:3 "console.log(" [console-log-detection]

src/utils.js
  ⚠ Replace var with const src/utils.js:3:1 "var config" [var-to-const]
  ✖ Replace deprecated substr() src/utils.js:8:15 ".substr(" [deprecated-substr]

📊 Summary:
──────────────────────────────────────────────────
Files scanned: 25
Scan time: 1.2s
Total issues: 8
  ✖ Errors: 2
  ⚠ Warnings: 3
  ℹ Info: 3
Fixable issues: 5
```

## 🛠️ Configuration

### Rules File

Create a `rules.json` file to define custom patterns:

```json
{
  "rules": [
    {
      "id": "var-to-const",
      "name": "Replace var with const/let",
      "description": "Detects var declarations that should be const or let",
      "pattern": "\\bvar\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=",
      "replacement": "const $1 =",
      "fileTypes": ["js", "jsx", "ts", "tsx"],
      "severity": "warning"
    },
    {
      "id": "deprecated-substr",
      "name": "Replace deprecated substr()",
      "description": "The substr() method is deprecated, use substring() instead",
      "pattern": "\\.substr\\(",
      "replacement": ".substring(",
      "fileTypes": ["js", "jsx", "ts", "tsx"],
      "severity": "error"
    }
  ],
  "fileExtensions": ["js", "jsx", "ts", "tsx", "py"],
  "ignorePatterns": [
    "node_modules/**",
    "*.min.js",
    "dist/**",
    "build/**"
  ],
  "maxFileSize": "1MB"
}
```

### Rule Properties

- **id**: Unique identifier for the rule
- **name**: Human-readable name
- **description**: Detailed description of what the rule does
- **pattern**: Regular expression pattern to match
- **replacement**: Replacement string (use `null` for detection-only rules)
- **fileTypes**: Array of file extensions this rule applies to
- **severity**: `"error"`, `"warning"`, or `"info"`

## 📋 Command Line Options

### Basic Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--fix` | `-f` | Automatically fix issues where possible | `false` |
| `--dry-run` | `-d` | Show what would be fixed without making changes | `false` |
| `--verbose` | `-v` | Show detailed output | `false` |
| `--help` | `-h` | Show help information | |
| `--version` | `-V` | Show version number | |

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `--rules` | Path to rules configuration file | `rules.json` |
| `--extensions` | File extensions to scan (comma-separated) | Auto-detect |
| `--ignore` | Patterns to ignore (can be used multiple times) | See rules.json |
| `--max-file-size` | Maximum file size to process | `1MB` |

### Output Options

| Option | Description | Default |
|--------|-------------|---------|
| `--no-color` | Disable colored output | `false` |
| `--yes` | Automatically confirm all prompts | `false` |

### Advanced Options

| Option | Description | Default |
|--------|-------------|---------|
| `--backup-dir` | Directory for backup files | `.code-migration-backups` |
| `--no-backup` | Skip creating backup files when fixing | `false` |
| `--regex-timeout` | Timeout for regex operations (ms) | `5000` |

## 💡 Usage Examples

### Scan Specific File Types

```bash
# Only scan JavaScript and TypeScript files
code-migrate ./src --extensions js,ts,jsx,tsx

# Only scan Python files
code-migrate ./src --extensions py
```

### Ignore Patterns

```bash
# Ignore multiple patterns
code-migrate ./src --ignore "*.min.js" --ignore "dist/**" --ignore "node_modules/**"

# Ignore test files
code-migrate ./src --ignore "**/*.test.js" --ignore "**/*.spec.js"
```

### Custom Rules File

```bash
# Use custom rules file
code-migrate ./src --rules ./my-custom-rules.json

# Use rules from different directory
code-migrate ./src --rules ../shared-rules/migration-rules.json
```

### Fix Operations

```bash
# Fix with confirmation
code-migrate ./src --fix

# Fix without confirmation prompts
code-migrate ./src --fix --yes

# Preview fixes without applying them
code-migrate ./src --dry-run --verbose

# Fix with custom backup directory
code-migrate ./src --fix --backup-dir ./backups/$(date +%Y%m%d)
```

### Large Projects

```bash
# Scan large project with increased file size limit
code-migrate ./src --max-file-size 5MB --verbose

# Scan with custom timeout for complex regex patterns
code-migrate ./src --regex-timeout 10000
```

## 🔧 Advanced Configuration

### Custom Rule Examples

#### JavaScript/TypeScript Rules

```json
{
  "id": "arrow-functions",
  "name": "Convert to arrow functions",
  "description": "Convert simple function expressions to arrow functions",
  "pattern": "function\\s*\\(([^)]*)\\)\\s*{\\s*return\\s+([^;]+);\\s*}",
  "replacement": "($1) => $2",
  "fileTypes": ["js", "jsx", "ts", "tsx"],
  "severity": "info"
}
```

#### Python Rules

```json
{
  "id": "print-function",
  "name": "Python 3 print function",
  "description": "Convert Python 2 print statements to Python 3 functions",
  "pattern": "print\\s+([^(\\n]+)(?!\\s*\\()",
  "replacement": "print($1)",
  "fileTypes": ["py"],
  "severity": "error"
}
```

#### Detection-Only Rules

```json
{
  "id": "todo-comments",
  "name": "TODO comments",
  "description": "Find TODO comments that need attention",
  "pattern": "(TODO|FIXME|XXX)\\s*:?\\s*(.+)",
  "replacement": null,
  "fileTypes": ["js", "py", "java", "cpp"],
  "severity": "info"
}
```

### Environment-Specific Configuration

Create different rule files for different environments:

```bash
# Development rules (more lenient)
code-migrate ./src --rules rules-dev.json

# Production rules (strict)
code-migrate ./src --rules rules-prod.json --fix

# Legacy migration rules
code-migrate ./legacy --rules rules-legacy-migration.json --fix --yes
```

## 🚨 Error Handling

The tool provides comprehensive error handling for various scenarios:

### Common Issues and Solutions

#### Permission Errors
```
⚠ Warning: Permission denied: restricted.js - Check file permissions and ensure read access
```
**Solution**: Ensure the tool has read access to all files in the target directory.

#### File Size Limits
```
⚠ Warning: File too large: bundle.js (5.2MB) - Increase --max-file-size limit (current: 1.0MB)
```
**Solution**: Increase the file size limit or exclude large generated files.

#### Memory Issues
```
⚠ Warning: High memory usage detected during file scanning (1.2GB) - Consider processing smaller batches
```
**Solution**: Process directories in smaller batches or increase available memory.

#### Regex Timeouts
```
⚠ Warning: Regex timeout in rule "complex-pattern" for large-file.js - Rule pattern may be too complex
```
**Solution**: Simplify the regex pattern or increase the timeout with `--regex-timeout`.

## 🧪 Testing Your Rules

### Dry Run Testing

Always test new rules with dry run mode:

```bash
# Test rules without making changes
code-migrate ./test-files --rules new-rules.json --dry-run --verbose
```

### Small Batch Testing

Test on a small subset first:

```bash
# Test on a single file
code-migrate ./src/single-file.js --rules new-rules.json --dry-run

# Test on a small directory
code-migrate ./src/components --rules new-rules.json --dry-run
```

### Backup Verification

When applying fixes, always verify backups are created:

```bash
code-migrate ./src --fix --backup-dir ./my-backups
ls -la ./my-backups  # Verify backups exist
```

## 🔄 Integration with CI/CD

### GitHub Actions

```yaml
name: Code Migration Check
on: [push, pull_request]

jobs:
  migration-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install -g code-migration-cli
      - run: code-migrate ./src --rules .github/migration-rules.json
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit
code-migrate ./src --rules migration-rules.json
if [ $? -ne 0 ]; then
  echo "Code migration issues found. Please fix before committing."
  exit 1
fi
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/username/code-migration-cli.git
cd code-migration-cli
npm install
npm test
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- test/scanner.test.js

# Run tests in watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [yargs](https://github.com/yargs/yargs) for excellent CLI argument parsing
- [chalk](https://github.com/chalk/chalk) for beautiful terminal colors
- [glob](https://github.com/isaacs/node-glob) for file pattern matching
- [fs-extra](https://github.com/jprichardson/node-fs-extra) for enhanced file operations

## 📞 Support

- 📖 [Documentation](https://github.com/username/code-migration-cli/wiki)
- 🐛 [Issue Tracker](https://github.com/username/code-migration-cli/issues)
- 💬 [Discussions](https://github.com/username/code-migration-cli/discussions)

---

**Happy coding! 🎉**