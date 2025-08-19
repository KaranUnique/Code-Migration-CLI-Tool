const fs = require('fs-extra');
const path = require('path');
const { CodeMigrationCLI, configureYargs } = require('../index');

describe('CodeMigrationCLI', () => {
  let tempDir;
  let cli;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
    cli = new CodeMigrationCLI();
  });

  afterEach(async () => {
    // Clean up temporary files
    await fs.remove(tempDir);
  });

  describe('initialization', () => {
    test('should initialize with default options', async () => {
      // Create a basic rules file
      const rulesPath = path.join(tempDir, 'rules.json');
      const rules = {
        rules: [
          {
            id: 'test-rule',
            name: 'Test Rule',
            description: 'A test rule',
            pattern: 'test',
            replacement: 'TEST',
            fileTypes: ['js'],
            severity: 'warning'
          }
        ]
      };
      await fs.writeFile(rulesPath, JSON.stringify(rules));

      const options = {
        rules: rulesPath,
        verbose: false,
        noColor: false
      };

      await cli.initialize(options);

      expect(cli.scanner).toBeTruthy();
      expect(cli.ruleEngine).toBeTruthy();
      expect(cli.formatter).toBeTruthy();
    });

    test('should initialize fixer when fix option is enabled', async () => {
      const rulesPath = path.join(tempDir, 'rules.json');
      const rules = { rules: [] };
      await fs.writeFile(rulesPath, JSON.stringify(rules));

      const options = {
        rules: rulesPath,
        fix: true
      };

      await cli.initialize(options);

      expect(cli.fixer).toBeTruthy();
    });

    test('should handle missing rules file gracefully', async () => {
      const options = {
        rules: path.join(tempDir, 'nonexistent.json')
      };

      // Mock process.exit to prevent test from exiting
      const originalExit = process.exit;
      const mockExit = jest.fn();
      process.exit = mockExit;

      // Mock console.error to capture error output
      const originalError = console.error;
      const mockError = jest.fn();
      console.error = mockError;

      await cli.initialize(options);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockError).toHaveBeenCalled();

      // Restore original functions
      process.exit = originalExit;
      console.error = originalError;
    });
  });

  describe('scan operation', () => {
    beforeEach(async () => {
      // Create test rules
      const rulesPath = path.join(tempDir, 'rules.json');
      const rules = {
        rules: [
          {
            id: 'var-to-const',
            name: 'Replace var with const',
            description: 'Replace var declarations',
            pattern: '\\bvar\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=',
            replacement: 'const $1 =',
            fileTypes: ['js'],
            severity: 'warning'
          }
        ]
      };
      await fs.writeFile(rulesPath, JSON.stringify(rules));

      await cli.initialize({ rules: rulesPath });
    });

    test('should scan directory and find issues', async () => {
      // Create test files
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'var x = 1;\nvar y = 2;');

      const options = { extensions: ['js'] };
      const results = await cli.scan(tempDir, options);

      expect(results.filesScanned).toBe(1);
      expect(results.issuesFound).toBe(2);
      expect(results.fixableCount).toBe(2);
    });

    test('should handle empty directory', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      await fs.ensureDir(emptyDir);

      const options = { extensions: ['js'] };
      const results = await cli.scan(emptyDir, options);

      expect(results.filesScanned).toBe(0);
      expect(results.issuesFound).toBe(0);
    });

    test('should filter files by extension', async () => {
      // Create files with different extensions
      await fs.writeFile(path.join(tempDir, 'test.js'), 'var x = 1;');
      await fs.writeFile(path.join(tempDir, 'test.py'), 'var x = 1');
      await fs.writeFile(path.join(tempDir, 'test.txt'), 'var x = 1');

      const options = { extensions: ['js'] };
      const results = await cli.scan(tempDir, options);

      expect(results.filesScanned).toBe(1); // Only .js file should be scanned
    });

    test('should handle scan errors gracefully', async () => {
      // Create a file that will cause read error
      const problematicFile = path.join(tempDir, 'problem.js');
      await fs.writeFile(problematicFile, 'var x = 1;');
      
      // Mock scanner to throw error
      const originalReadFile = cli.scanner.readFile;
      cli.scanner.readFile = jest.fn().mockRejectedValue(new Error('Read error'));

      // Mock console.warn to capture warnings
      const originalWarn = console.warn;
      const mockWarn = jest.fn();
      console.warn = mockWarn;

      const options = { extensions: ['js'] };
      const results = await cli.scan(tempDir, options);

      expect(mockWarn).toHaveBeenCalled();
      expect(results.filesScanned).toBe(0); // File should be skipped

      // Restore original functions
      cli.scanner.readFile = originalReadFile;
      console.warn = originalWarn;
    });
  });

  describe('fix operations', () => {
    beforeEach(async () => {
      // Create test rules with fixable patterns
      const rulesPath = path.join(tempDir, 'rules.json');
      const rules = {
        rules: [
          {
            id: 'var-to-const',
            name: 'Replace var with const',
            description: 'Replace var declarations',
            pattern: '\\bvar\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=',
            replacement: 'const $1 =',
            fileTypes: ['js'],
            severity: 'warning'
          }
        ]
      };
      await fs.writeFile(rulesPath, JSON.stringify(rules));

      await cli.initialize({ 
        rules: rulesPath, 
        fix: true,
        backupDir: path.join(tempDir, '.backups')
      });
    });

    test('should apply fixes to files', async () => {
      const testFile = path.join(tempDir, 'test.js');
      const originalContent = 'var x = 1;\nvar y = 2;';
      await fs.writeFile(testFile, originalContent);

      const options = { 
        extensions: ['js'], 
        fix: true, 
        yes: true // Auto-confirm
      };
      
      const results = await cli.scan(tempDir, options);

      expect(results.filesFixed).toBe(1);
      expect(results.patternsReplaced).toBe(2);

      // Check that file was actually modified
      const modifiedContent = await fs.readFile(testFile, 'utf8');
      expect(modifiedContent).toContain('const x');
      expect(modifiedContent).toContain('const y');
    });

    test('should work in dry run mode', async () => {
      const testFile = path.join(tempDir, 'test.js');
      const originalContent = 'var x = 1;';
      await fs.writeFile(testFile, originalContent);

      // Reinitialize with dry run
      await cli.initialize({ 
        rules: path.join(tempDir, 'rules.json'),
        dryRun: true,
        backupDir: path.join(tempDir, '.backups')
      });

      const options = { 
        extensions: ['js'], 
        dryRun: true 
      };
      
      const results = await cli.scan(tempDir, options);

      expect(results.patternsReplaced).toBe(1);

      // File should not be modified in dry run
      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe(originalContent);
    });

    test('should handle no fixable issues', async () => {
      // Create rules with non-fixable pattern
      const rulesPath = path.join(tempDir, 'rules-no-fix.json');
      const rules = {
        rules: [
          {
            id: 'console-log',
            name: 'Console log detection',
            description: 'Find console.log statements',
            pattern: 'console\\.log',
            replacement: null, // Not fixable
            fileTypes: ['js'],
            severity: 'info'
          }
        ]
      };
      await fs.writeFile(rulesPath, JSON.stringify(rules));

      await cli.initialize({ 
        rules: rulesPath, 
        fix: true 
      });

      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'console.log("test");');

      // Mock console.log to capture output
      const originalLog = console.log;
      const mockLog = jest.fn();
      console.log = mockLog;

      const options = { 
        extensions: ['js'], 
        fix: true 
      };
      
      await cli.scan(tempDir, options);

      expect(mockLog).toHaveBeenCalledWith(
        expect.stringContaining('No fixable issues found')
      );

      // Restore console.log
      console.log = originalLog;
    });
  });

  describe('utility methods', () => {
    test('should parse file sizes correctly', () => {
      expect(cli.parseFileSize('1MB')).toBe(1024 * 1024);
      expect(cli.parseFileSize('500KB')).toBe(500 * 1024);
      expect(cli.parseFileSize('1024B')).toBe(1024);
      expect(cli.parseFileSize('1.5MB')).toBe(1.5 * 1024 * 1024);
      expect(cli.parseFileSize('')).toBe(1024 * 1024); // Default
      expect(cli.parseFileSize('invalid')).toBe(1024 * 1024); // Default
    });

    test('should calculate statistics correctly', () => {
      const findings = [
        { severity: 'error', fixable: true },
        { severity: 'warning', fixable: false },
        { severity: 'info', fixable: true }
      ];

      const stats = cli.calculateStatistics(findings, 5, 1000);

      expect(stats.filesScanned).toBe(5);
      expect(stats.issuesFound).toBe(3);
      expect(stats.errorCount).toBe(1);
      expect(stats.warningCount).toBe(1);
      expect(stats.infoCount).toBe(1);
      expect(stats.fixableCount).toBe(2);
      expect(stats.scanTime).toBe(1000);
    });

    test('should include fix results in statistics', () => {
      const findings = [{ severity: 'error', fixable: true }];
      const fixResults = { filesFixed: 2, patternsReplaced: 5 };

      const stats = cli.calculateStatistics(findings, 3, 500, fixResults);

      expect(stats.filesFixed).toBe(2);
      expect(stats.patternsReplaced).toBe(5);
    });
  });
});

describe('configureYargs', () => {
  test('should configure yargs with all expected options', () => {
    const yargs = configureYargs();
    
    // Test that yargs is properly configured
    expect(yargs).toBeTruthy();
    
    // Test help output contains expected options
    const helpOutput = yargs.getHelp();
    expect(helpOutput).toContain('--rules');
    expect(helpOutput).toContain('--fix');
    expect(helpOutput).toContain('--dry-run');
    expect(helpOutput).toContain('--verbose');
    expect(helpOutput).toContain('--extensions');
    expect(helpOutput).toContain('--ignore');
  });

  test('should parse extensions correctly', () => {
    const yargs = configureYargs();
    
    // Test extensions coercion
    const argv1 = yargs.parse(['test-dir', '--extensions', 'js,ts,py']);
    expect(argv1.extensions).toEqual(['js', 'ts', 'py']);

    const argv2 = yargs.parse(['test-dir', '--extensions', 'js, ts , py']);
    expect(argv2.extensions).toEqual(['js', 'ts', 'py']);
  });

  test('should handle boolean flags correctly', () => {
    const yargs = configureYargs();
    
    const argv = yargs.parse(['test-dir', '--fix', '--verbose', '--no-color']);
    expect(argv.fix).toBe(true);
    expect(argv.verbose).toBe(true);
    expect(argv.noColor).toBe(true);
  });

  test('should set default values', () => {
    const yargs = configureYargs();
    
    const argv = yargs.parse(['test-dir']);
    expect(argv.rules).toBe('rules.json');
    expect(argv.fix).toBe(false);
    expect(argv.dryRun).toBe(false);
    expect(argv.verbose).toBe(false);
    expect(argv.maxFileSize).toBe('1MB');
    expect(argv.backupDir).toBe('.code-migration-backups');
  });
});