# Contributing to Code Migration CLI

Thank you for your interest in contributing to Code Migration CLI! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 14.0.0 or higher
- npm or yarn package manager
- Git

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/code-migration-cli.git
   cd code-migration-cli
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run tests to ensure everything works**
   ```bash
   npm test
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 🏗️ Project Structure

```
code-migration-cli/
├── lib/                    # Core library modules
│   ├── scanner.js         # File discovery and reading
│   ├── ruleEngine.js      # Rule processing and pattern matching
│   ├── formatter.js       # Output formatting and colors
│   ├── fixer.js          # Backup and fix operations
│   └── errorHandler.js   # Error handling and edge cases
├── test/                  # Test files
│   ├── *.test.js         # Unit tests for each module
│   └── integration.test.js # End-to-end integration tests
├── index.js              # Main CLI application
├── rules.json            # Default rule configurations
├── package.json          # Project configuration
└── README.md             # Project documentation
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (during development)
npm run test:watch

# Run specific test file
npm test -- test/scanner.test.js

# Run tests with verbose output
npm test -- --verbose
```

### Writing Tests

We use Jest as our testing framework. All new features should include comprehensive tests.

#### Test File Structure

```javascript
const ModuleName = require('../lib/moduleName');

describe('ModuleName', () => {
  let instance;

  beforeEach(() => {
    instance = new ModuleName();
  });

  describe('methodName', () => {
    test('should handle normal case', () => {
      // Test implementation
    });

    test('should handle edge case', () => {
      // Test implementation
    });

    test('should throw error for invalid input', () => {
      // Test implementation
    });
  });
});
```

#### Test Guidelines

- **Unit Tests**: Test individual functions and methods in isolation
- **Integration Tests**: Test complete workflows and component interactions
- **Edge Cases**: Test error conditions, empty inputs, and boundary conditions
- **Cross-platform**: Consider Windows, macOS, and Linux differences
- **Performance**: Include tests for large files and many files scenarios

### Test Coverage

We aim for high test coverage. New contributions should maintain or improve coverage:

```bash
npm run test:coverage
```

Target coverage levels:
- **Statements**: > 90%
- **Branches**: > 85%
- **Functions**: > 90%
- **Lines**: > 90%

## 🎨 Code Style

### Linting and Formatting

We use ESLint and Prettier to maintain consistent code style:

```bash
# Check for linting issues
npm run lint

# Automatically fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format
```

### Code Style Guidelines

#### JavaScript Style

- Use **const** and **let** instead of **var**
- Use **arrow functions** for short functions
- Use **template literals** for string interpolation
- Use **async/await** instead of callbacks or raw promises
- Add **JSDoc comments** for all public methods

#### Example:

```javascript
/**
 * Process files and apply rules
 * @param {Array} files - Array of file paths to process
 * @param {Object} options - Processing options
 * @returns {Promise<Array>} Array of findings
 */
async processFiles(files, options = {}) {
  const findings = [];
  
  for (const filePath of files) {
    try {
      const content = await this.readFile(filePath);
      const fileFindings = this.applyRules(content, filePath);
      findings.push(...fileFindings);
    } catch (error) {
      this.handleError(error, filePath);
    }
  }
  
  return findings;
}
```

#### Error Handling

- Always handle errors gracefully
- Provide meaningful error messages
- Use the ErrorHandler class for consistent error handling
- Log errors with appropriate severity levels

#### Performance Considerations

- Use streaming for large files when possible
- Implement memory management for large datasets
- Add timeout protection for regex operations
- Consider cross-platform file path handling

## 📝 Documentation

### Code Documentation

- Add JSDoc comments to all public methods
- Include parameter types and return types
- Provide usage examples for complex functions
- Document error conditions and edge cases

### README Updates

When adding new features:
- Update the feature list
- Add new command-line options to the table
- Include usage examples
- Update configuration documentation

## 🐛 Bug Reports

### Before Submitting

1. **Search existing issues** to avoid duplicates
2. **Test with the latest version** to ensure the bug still exists
3. **Create a minimal reproduction case**

### Bug Report Template

```markdown
## Bug Description
Brief description of the issue

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [Windows/macOS/Linux]
- Node.js version: [version]
- Tool version: [version]

## Additional Context
- Sample files (if applicable)
- Rules configuration
- Command used
- Full error output
```

## ✨ Feature Requests

### Before Submitting

1. **Check existing feature requests** to avoid duplicates
2. **Consider if the feature fits the project scope**
3. **Think about implementation complexity**

### Feature Request Template

```markdown
## Feature Description
Clear description of the proposed feature

## Use Case
Why is this feature needed? What problem does it solve?

## Proposed Solution
How should this feature work?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Any other relevant information
```

## 🔄 Pull Request Process

### Before Submitting

1. **Create an issue** to discuss the change (for significant features)
2. **Fork the repository** and create a feature branch
3. **Write tests** for your changes
4. **Update documentation** as needed
5. **Ensure all tests pass**
6. **Run linting and formatting**

### Pull Request Guidelines

#### Title Format
```
type(scope): brief description

Examples:
feat(scanner): add support for .vue files
fix(fixer): handle permission errors gracefully
docs(readme): update installation instructions
test(integration): add large file handling tests
```

#### Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No new linting errors
```

### Review Process

1. **Automated checks** must pass (tests, linting, etc.)
2. **Code review** by maintainers
3. **Testing** on different platforms if needed
4. **Approval** and merge by maintainers

## 🏷️ Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release notes
4. Tag the release
5. Publish to npm

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Assume good intentions

### Communication

- **Issues**: For bug reports and feature requests
- **Discussions**: For questions and general discussion
- **Pull Requests**: For code contributions
- **Email**: For security issues or private matters

## 🎯 Areas for Contribution

### High Priority

- **New language support**: Add rules for additional programming languages
- **Performance improvements**: Optimize for large codebases
- **Error handling**: Improve edge case handling
- **Documentation**: Improve examples and guides

### Medium Priority

- **CLI enhancements**: New command-line options and features
- **Rule engine**: Advanced pattern matching capabilities
- **Output formats**: JSON, XML, or other structured output
- **Integration**: CI/CD plugins and integrations

### Good First Issues

Look for issues labeled `good first issue` or `help wanted`:
- Documentation improvements
- Simple bug fixes
- Test coverage improvements
- Example rule additions

## 📚 Resources

### Learning Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [Regular Expressions Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)
- [ESLint Rules](https://eslint.org/docs/rules/)

### Development Tools

- [VS Code](https://code.visualstudio.com/) with recommended extensions
- [Node.js](https://nodejs.org/) LTS version
- [Git](https://git-scm.com/) for version control

## 🙏 Recognition

Contributors will be recognized in:
- `CONTRIBUTORS.md` file
- Release notes for significant contributions
- GitHub contributors page

Thank you for contributing to Code Migration CLI! 🎉