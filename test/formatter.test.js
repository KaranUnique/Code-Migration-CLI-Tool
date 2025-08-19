const Formatter = require('../lib/formatter');
const chalk = require('chalk');

describe('Formatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new Formatter();
  });

  describe('formatFinding', () => {
    test('should format finding with colors and proper layout', () => {
      const finding = {
        ruleId: 'test-rule',
        ruleName: 'Test Rule',
        description: 'A test rule description',
        filePath: '/project/src/test.js',
        lineNumber: 10,
        columnNumber: 5,
        matchedText: 'var x = 1;',
        severity: 'warning',
        fixable: true
      };

      const formatted = formatter.formatFinding(finding, '/project');
      
      expect(formatted).toContain('Test Rule');
      expect(formatted).toContain('src/test.js:10:5');
      expect(formatted).toContain('var x = 1;');
      expect(formatted).toContain('[test-rule]');
    });

    test('should handle different severity levels', () => {
      const errorFinding = {
        ruleId: 'error-rule',
        ruleName: 'Error Rule',
        description: 'An error',
        filePath: '/test.js',
        lineNumber: 1,
        columnNumber: 1,
        matchedText: 'error',
        severity: 'error',
        fixable: false
      };

      const warningFinding = { ...errorFinding, severity: 'warning', ruleName: 'Warning Rule' };
      const infoFinding = { ...errorFinding, severity: 'info', ruleName: 'Info Rule' };

      const errorFormatted = formatter.formatFinding(errorFinding);
      const warningFormatted = formatter.formatFinding(warningFinding);
      const infoFormatted = formatter.formatFinding(infoFinding);

      expect(errorFormatted).toContain('Error Rule');
      expect(warningFormatted).toContain('Warning Rule');
      expect(infoFormatted).toContain('Info Rule');
    });

    test('should truncate long matched text', () => {
      const finding = {
        ruleId: 'long-rule',
        ruleName: 'Long Rule',
        description: 'A rule with long matched text',
        filePath: '/test.js',
        lineNumber: 1,
        columnNumber: 1,
        matchedText: 'This is a very long piece of matched text that should be truncated because it exceeds the maximum length',
        severity: 'info',
        fixable: false
      };

      const formatted = formatter.formatFinding(finding);
      
      expect(formatted).toContain('...');
      expect(formatted.length).toBeLessThan(200); // Should be reasonably short
    });

    test('should show verbose information when enabled', () => {
      const verboseFormatter = new Formatter({ verbose: true });
      const finding = {
        ruleId: 'verbose-rule',
        ruleName: 'Verbose Rule',
        description: 'A detailed description',
        filePath: '/test.js',
        lineNumber: 1,
        columnNumber: 1,
        matchedText: 'test',
        severity: 'info',
        fixable: true
      };

      const formatted = verboseFormatter.formatFinding(finding);
      
      expect(formatted).toContain('Description:');
      expect(formatted).toContain('A detailed description');
      expect(formatted).toContain('Matched:');
      expect(formatted).toContain('✓ Fixable');
    });
  });

  describe('formatFindings', () => {
    test('should format multiple findings grouped by file', () => {
      const findings = [
        {
          ruleId: 'rule1',
          ruleName: 'Rule 1',
          description: 'First rule',
          filePath: '/project/file1.js',
          lineNumber: 1,
          columnNumber: 1,
          matchedText: 'test1',
          severity: 'error',
          fixable: true
        },
        {
          ruleId: 'rule2',
          ruleName: 'Rule 2',
          description: 'Second rule',
          filePath: '/project/file1.js',
          lineNumber: 5,
          columnNumber: 3,
          matchedText: 'test2',
          severity: 'warning',
          fixable: false
        },
        {
          ruleId: 'rule3',
          ruleName: 'Rule 3',
          description: 'Third rule',
          filePath: '/project/file2.js',
          lineNumber: 2,
          columnNumber: 1,
          matchedText: 'test3',
          severity: 'info',
          fixable: true
        }
      ];

      const formatted = formatter.formatFindings(findings, '/project');
      
      expect(formatted).toContain('Found 3 issues in 2 files');
      expect(formatted).toContain('file1.js');
      expect(formatted).toContain('file2.js');
      expect(formatted).toContain('Rule 1');
      expect(formatted).toContain('Rule 2');
      expect(formatted).toContain('Rule 3');
    });

    test('should handle empty findings array', () => {
      const formatted = formatter.formatFindings([]);
      
      expect(formatted).toContain('No issues found');
    });

    test('should sort findings by line number within each file', () => {
      const findings = [
        {
          ruleId: 'rule1',
          ruleName: 'Rule 1',
          description: 'First rule',
          filePath: '/test.js',
          lineNumber: 10,
          columnNumber: 1,
          matchedText: 'test1',
          severity: 'error',
          fixable: true
        },
        {
          ruleId: 'rule2',
          ruleName: 'Rule 2',
          description: 'Second rule',
          filePath: '/test.js',
          lineNumber: 5,
          columnNumber: 1,
          matchedText: 'test2',
          severity: 'warning',
          fixable: false
        }
      ];

      const formatted = formatter.formatFindings(findings);
      
      // Rule 2 (line 5) should appear before Rule 1 (line 10)
      const rule2Index = formatted.indexOf('Rule 2');
      const rule1Index = formatted.indexOf('Rule 1');
      expect(rule2Index).toBeLessThan(rule1Index);
    });
  });

  describe('formatSummary', () => {
    test('should format basic statistics', () => {
      const stats = {
        filesScanned: 10,
        issuesFound: 5,
        errorCount: 2,
        warningCount: 2,
        infoCount: 1,
        fixableCount: 3,
        scanTime: 1500
      };

      const formatted = formatter.formatSummary(stats);
      
      expect(formatted).toContain('Summary:');
      expect(formatted).toContain('Files scanned: 10');
      expect(formatted).toContain('Total issues: 5');
      expect(formatted).toContain('Errors: 2');
      expect(formatted).toContain('Warnings: 2');
      expect(formatted).toContain('Info: 1');
      expect(formatted).toContain('Fixable issues: 3');
      expect(formatted).toContain('1.5s');
    });

    test('should handle zero issues', () => {
      const stats = {
        filesScanned: 5,
        issuesFound: 0,
        scanTime: 500
      };

      const formatted = formatter.formatSummary(stats);
      
      expect(formatted).toContain('No issues found');
      expect(formatted).toContain('Files scanned: 5');
    });

    test('should include fix statistics when provided', () => {
      const stats = {
        filesScanned: 10,
        issuesFound: 5,
        fixableCount: 3,
        filesFixed: 2,
        patternsReplaced: 4,
        scanTime: 1000
      };

      const formatted = formatter.formatSummary(stats);
      
      expect(formatted).toContain('Files fixed: 2');
      expect(formatted).toContain('Patterns replaced: 4');
    });
  });

  describe('message formatting methods', () => {
    test('should format error messages', () => {
      const error = new Error('Test error message');
      const formatted = formatter.formatError(error);
      
      expect(formatted).toContain('Error: Test error message');
    });

    test('should format warning messages', () => {
      const formatted = formatter.formatWarning('Test warning');
      
      expect(formatted).toContain('Warning: Test warning');
    });

    test('should format info messages', () => {
      const formatted = formatter.formatInfo('Test info');
      
      expect(formatted).toContain('Test info');
    });

    test('should format success messages', () => {
      const formatted = formatter.formatSuccess('Test success');
      
      expect(formatted).toContain('Test success');
    });
  });

  describe('formatProgress', () => {
    test('should format progress with percentage and bar', () => {
      const formatted = formatter.formatProgress('Scanning files', 25, 100);
      
      expect(formatted).toContain('Scanning files');
      expect(formatted).toContain('25%');
      expect(formatted).toContain('(25/100)');
    });

    test('should handle zero total', () => {
      const formatted = formatter.formatProgress('Processing', 0, 0);
      
      expect(formatted).toContain('Processing');
      expect(formatted).toContain('0%');
    });
  });

  describe('utility methods', () => {
    test('should format duration correctly', () => {
      expect(formatter.formatDuration(500)).toBe('500ms');
      expect(formatter.formatDuration(1500)).toBe('1.5s');
      expect(formatter.formatDuration(65000)).toBe('1m 5.0s');
    });

    test('should format file size correctly', () => {
      expect(formatter.formatFileSize(1024)).toBe('1.0KB');
      expect(formatter.formatFileSize(1048576)).toBe('1.0MB');
      expect(formatter.formatFileSize(500)).toBe('500.0B');
    });

    test('should group findings by file', () => {
      const findings = [
        { filePath: '/file1.js', ruleId: 'rule1' },
        { filePath: '/file2.js', ruleId: 'rule2' },
        { filePath: '/file1.js', ruleId: 'rule3' }
      ];

      const grouped = formatter.groupFindingsByFile(findings);
      
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['/file1.js']).toHaveLength(2);
      expect(grouped['/file2.js']).toHaveLength(1);
    });

    test('should create progress bar', () => {
      const progressBar = formatter.createProgressBar(5, 10, 10);
      
      expect(progressBar).toHaveLength(10); // Should be exactly 10 characters (ignoring ANSI codes)
    });
  });

  describe('formatTable', () => {
    test('should format tabular data', () => {
      const data = [
        { name: 'file1.js', issues: 3, severity: 'error' },
        { name: 'file2.js', issues: 1, severity: 'warning' }
      ];
      
      const columns = [
        { header: 'File', key: 'name' },
        { header: 'Issues', key: 'issues' },
        { header: 'Severity', key: 'severity' }
      ];

      const formatted = formatter.formatTable(data, columns);
      
      expect(formatted).toContain('File');
      expect(formatted).toContain('Issues');
      expect(formatted).toContain('Severity');
      expect(formatted).toContain('file1.js');
      expect(formatted).toContain('file2.js');
    });

    test('should handle empty data', () => {
      const formatted = formatter.formatTable([], []);
      
      expect(formatted).toContain('No data to display');
    });
  });

  describe('color configuration', () => {
    test('should disable colors when configured', () => {
      const noColorFormatter = new Formatter({ colorEnabled: false });
      
      // This is a basic test - in a real scenario you'd check that ANSI codes are not present
      expect(noColorFormatter.options.colorEnabled).toBe(false);
    });

    test('should enable colors by default', () => {
      expect(formatter.options.colorEnabled).toBe(true);
    });
  });
});