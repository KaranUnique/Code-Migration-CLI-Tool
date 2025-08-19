# Design Document

## Overview

The Code Migration CLI is a Node.js command-line application that provides automated code scanning and migration capabilities. The tool follows a modular architecture with clear separation of concerns between file scanning, rule processing, pattern matching, and output formatting. It leverages popular npm packages for cross-platform compatibility and enhanced user experience.

## Architecture

The application follows a layered architecture:

```
┌─────────────────────────────────────┐
│           CLI Interface             │
│        (yargs, chalk)               │
├─────────────────────────────────────┤
│         Core Engine                 │
│    (Scanner, RuleEngine, Fixer)     │
├─────────────────────────────────────┤
│        File System Layer           │
│     (fs, path, glob patterns)      │
├─────────────────────────────────────┤
│       Configuration Layer          │
│        (rules.json loader)         │
└─────────────────────────────────────┘
```

## Components and Interfaces

### CLI Interface (`index.js`)
- **Purpose**: Entry point handling command-line arguments and orchestrating the scanning process
- **Dependencies**: yargs for argument parsing, chalk for colored output
- **Key Functions**:
  - `parseArguments()`: Process command-line options
  - `main()`: Orchestrate the scanning workflow
  - `displayResults()`: Format and display scan results
  - `displaySummary()`: Show final statistics

### File Scanner (`lib/scanner.js`)
- **Purpose**: Recursively discover and read source code files
- **Key Functions**:
  - `scanDirectory(targetPath, extensions)`: Find all matching files
  - `readFileContent(filePath)`: Read file with proper encoding detection
  - `getFileExtension(filePath)`: Determine file type for rule application
- **Interface**:
```javascript
class Scanner {
  async scanDirectory(path, options = {})
  async readFile(filePath)
  getSupportedExtensions()
}
```

### Rule Engine (`lib/ruleEngine.js`)
- **Purpose**: Load rules configuration and apply pattern matching
- **Key Functions**:
  - `loadRules(rulesPath)`: Parse and validate rules.json
  - `applyRules(content, filePath)`: Execute pattern matching
  - `validateRule(rule)`: Ensure rule format is correct
- **Interface**:
```javascript
class RuleEngine {
  constructor(rulesPath)
  async loadRules()
  applyRules(content, filePath, fileExtension)
  getRuleById(id)
}
```

### Pattern Fixer (`lib/fixer.js`)
- **Purpose**: Apply automatic fixes with backup creation
- **Key Functions**:
  - `createBackup(filePath)`: Create timestamped backup files
  - `applyFixes(findings)`: Execute pattern replacements
  - `restoreBackups()`: Rollback mechanism for failed operations
- **Interface**:
```javascript
class Fixer {
  async createBackup(filePath)
  async applyFixes(findings)
  async restoreFromBackup(filePath)
}
```

### Output Formatter (`lib/formatter.js`)
- **Purpose**: Generate colored, readable terminal output
- **Key Functions**:
  - `formatFinding(finding)`: Style individual issues
  - `formatSummary(stats)`: Create final report
  - `colorizeByType(text, type)`: Apply appropriate colors
- **Interface**:
```javascript
class Formatter {
  formatFinding(finding)
  formatSummary(statistics)
  formatError(error)
}
```

## Data Models

### Rule Structure
```javascript
{
  "id": "string",
  "name": "string", 
  "description": "string",
  "pattern": "regex_string",
  "replacement": "string|null",
  "fileTypes": ["js", "py", "ts"],
  "severity": "error|warning|info"
}
```

### Finding Structure
```javascript
{
  "ruleId": "string",
  "ruleName": "string",
  "filePath": "string",
  "lineNumber": "number",
  "columnNumber": "number",
  "matchedText": "string",
  "severity": "string",
  "fixable": "boolean"
}
```

### Configuration Structure
```javascript
{
  "rules": [Rule],
  "fileExtensions": ["js", "ts", "py", "java"],
  "ignorePatterns": ["node_modules/**", "*.min.js"],
  "maxFileSize": "1MB"
}
```

## Error Handling

### File System Errors
- **Permission Issues**: Graceful handling with informative messages
- **Missing Files**: Skip with warning, continue processing
- **Large Files**: Size limits with configurable thresholds
- **Binary Files**: Automatic detection and exclusion

### Rule Processing Errors
- **Invalid Regex**: Validate patterns during rule loading
- **Malformed Rules**: Schema validation with detailed error messages
- **Missing Rules File**: Provide default rules or clear setup instructions

### Backup and Recovery
- **Backup Creation Failures**: Abort fix operation, preserve original files
- **Partial Fix Failures**: Rollback mechanism for incomplete operations
- **Disk Space Issues**: Pre-flight checks before creating backups

## Testing Strategy

### Unit Tests
- **Rule Engine**: Pattern matching accuracy, edge cases
- **File Scanner**: Directory traversal, file filtering
- **Fixer**: Backup creation, pattern replacement
- **Formatter**: Output formatting, color codes

### Integration Tests
- **End-to-End Workflows**: Complete scan and fix operations
- **Cross-Platform**: File path handling on different OS
- **Large Codebases**: Performance with realistic project sizes

### Test Data
- **Sample Projects**: JavaScript, Python, mixed-language repositories
- **Edge Cases**: Empty files, binary files, permission-restricted files
- **Rule Variations**: Simple replacements, complex patterns, conditional logic

## Dependencies

### Core Dependencies
- **yargs**: Command-line argument parsing with help generation
- **chalk**: Cross-platform terminal colors and styling
- **glob**: File pattern matching for directory scanning
- **fs-extra**: Enhanced file system operations with promises

### Development Dependencies
- **jest**: Testing framework for unit and integration tests
- **eslint**: Code quality and style consistency
- **prettier**: Code formatting for maintainability

## Performance Considerations

### File Processing
- **Streaming**: Process large files without loading entirely into memory
- **Parallel Processing**: Concurrent file scanning with worker threads
- **Caching**: Rule compilation and file metadata caching

### Memory Management
- **Chunked Reading**: Process files in manageable chunks
- **Garbage Collection**: Explicit cleanup of large objects
- **Progress Reporting**: Real-time feedback for long-running operations

## Security Considerations

### File Access
- **Path Traversal**: Validate and sanitize all file paths
- **Permission Checks**: Verify read/write access before operations
- **Symlink Handling**: Detect and handle symbolic links safely

### Pattern Execution
- **Regex Safety**: Prevent ReDoS attacks with pattern validation
- **Code Injection**: Sanitize replacement strings
- **Resource Limits**: Timeout protection for complex patterns