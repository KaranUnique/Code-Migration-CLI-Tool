# Sample Project for Code Migration CLI

This is a sample project that demonstrates various code issues that can be detected and fixed by the Code Migration CLI tool.

## Files Included

### JavaScript Files (`src/main.js`)
- `var` declarations that should be `const`
- Deprecated `substr()` method usage
- `console.log` statements for production cleanup
- Non-strict equality operators (`==`, `!=`)
- String concatenation that could use template literals
- Functions that could be converted to arrow functions

### Python Files (`src/utils.py`)
- Python 2 print statements
- Old-style string formatting (`%` operator)
- `.format()` calls that could be f-strings
- Deprecated `imp` module usage
- Old exception syntax
- Import order violations
- Deprecated collections imports

## Usage Examples

### Scan for Issues

```bash
# Scan JavaScript files
code-migrate ./src --rules ../rules-javascript.json --extensions js

# Scan Python files  
code-migrate ./src --rules ../rules-python.json --extensions py

# Scan all supported files
code-migrate ./src
```

### Preview Fixes

```bash
# See what would be fixed in JavaScript files
code-migrate ./src --rules ../rules-javascript.json --extensions js --dry-run --verbose

# See what would be fixed in Python files
code-migrate ./src --rules ../rules-python.json --extensions py --dry-run --verbose
```

### Apply Fixes

```bash
# Fix JavaScript issues
code-migrate ./src --rules ../rules-javascript.json --extensions js --fix --yes

# Fix Python issues
code-migrate ./src --rules ../rules-python.json --extensions py --fix --yes
```

## Expected Results

When you run the tool on these files, you should see:

### JavaScript Issues Found
- 3 `var` to `const` warnings
- 1 deprecated `substr()` error
- 2 `console.log` info messages
- 2 strict equality warnings
- 1 template literal suggestion
- 1 arrow function suggestion

### Python Issues Found
- 4 Python 2 print statement errors
- 1 deprecated `imp` module error
- 2 deprecated collections warnings
- 1 old string formatting warning
- 1 f-string suggestion
- 2 old exception syntax errors
- 1 import order info message

## After Fixes Applied

The fixed files will demonstrate modern, best-practice code patterns for both JavaScript and Python.