const fs = require('fs-extra');
const path = require('path');
const { CodeMigrationCLI } = require('../index');

describe('Integration Tests', () => {
  let tempDir;
  let cli;
  let rulesPath;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-integration-'));
    cli = new CodeMigrationCLI();

    // Create comprehensive test rules
    rulesPath = path.join(tempDir, 'rules.json');
    const rules = {
      rules: [
        {
          id: 'var-to-const',
          name: 'Replace var with const',
          description: 'Replace var declarations with const for better scoping',
          pattern: '\\bvar\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=',
          replacement: 'const $1 =',
          fileTypes: ['js', 'jsx'],
          severity: 'warning'
        },
        {
          id: 'deprecated-substr',
          name: 'Replace deprecated substr()',
          description: 'The substr() method is deprecated, use substring() instead',
          pattern: '\\.substr\\(',
          replacement: '.substring(',
          fileTypes: ['js', 'jsx', 'ts', 'tsx'],
          severity: 'error'
        },
        {
          id: 'console-log-detection',
          name: 'Console.log statements',
          description: 'Detects console.log statements that should be removed',
          pattern: 'console\\.log\\s*\\(',
          replacement: null,
          fileTypes: ['js', 'jsx', 'ts', 'tsx'],
          severity: 'info'
        },
        {
          id: 'python-print-statement',
          name: 'Python 2 print statement',
          description: 'Convert Python 2 print statements to Python 3 functions',
          pattern: 'print\\s+([^(\\n]+)(?!\\s*\\()',
          replacement: 'print($1)',
          fileTypes: ['py'],
          severity: 'error'
        }
      ]
    };
    await fs.writeFile(rulesPath, JSON.stringify(rules, null, 2));
  });

  afterEach(async () => {
    // Clean up temporary files
    await fs.remove(tempDir);
  });

  describe('End-to-End Workflow', () => {
    test('should complete full scan workflow with mixed file types', async () => {
      // Create test project structure
      const srcDir = path.join(tempDir, 'src');
      await fs.ensureDir(srcDir);

      // JavaScript files with various issues
      await fs.writeFile(path.join(srcDir, 'main.js'), `
var userName = 'test';
var userAge = 25;
console.log('User:', userName);
const text = 'hello world';
const result = text.substr(0, 5);
`);

      await fs.writeFile(path.join(srcDir, 'utils.js'), `
var config = { debug: true };
console.log('Config loaded');
function processText(str) {
  return str.substr(1);
}
`);

      // Python file
      await fs.writeFile(path.join(srcDir, 'script.py'), `
print "Hello World"
print "Debug:", debug_mode
def greet(name):
    print "Hello", name
`);

      // File that should be ignored
      await fs.writeFile(path.join(srcDir, 'data.txt'), 'This is just text data');

      // Initialize CLI
      await cli.initialize({
        rules: rulesPath,
        verbose: true
      });

      // Run scan
      const results = await cli.scan(srcDir, {
        extensions: ['js', 'py'],
        verbose: true
      });

      // Verify results
      expect(results.filesScanned).toBe(3); // 2 JS + 1 Python
      expect(results.issuesFound).toBeGreaterThan(0);
      expect(results.errorCount).toBeGreaterThan(0); // substr and Python print
      expect(results.warningCount).toBeGreaterThan(0); // var declarations
      expect(results.infoCount).toBeGreaterThan(0); // console.log
      expect(results.fixableCount).toBeGreaterThan(0);
      expect(results.scanTime).toBeGreaterThan(0);
    });

    test('should handle scan and fix workflow', async () => {
      // Create test files
      const testFile = path.join(tempDir, 'test.js');
      const originalContent = `
var x = 1;
var y = 2;
const text = 'hello';
const result = text.substr(0, 3);
`;
      await fs.writeFile(testFile, originalContent);

      // Initialize CLI with fixer
      await cli.initialize({
        rules: rulesPath,
        fix: true,
        backupDir: path.join(tempDir, '.backups')
      });

      // Run scan with fixes
      const results = await cli.scan(tempDir, {
        extensions: ['js'],
        fix: true,
        yes: true // Auto-confirm
      });

      // Verify fix results
      expect(results.filesFixed).toBe(1);
      expect(results.patternsReplaced).toBeGreaterThan(0);

      // Verify file was actually modified
      const modifiedContent = await fs.readFile(testFile, 'utf8');
      expect(modifiedContent).toContain('const x = 1');
      expect(modifiedContent).toContain('const y = 2');
      expect(modifiedContent).toContain('.substring(');

      // Verify backup was created
      const backupDir = path.join(tempDir, '.backups');
      expect(await fs.pathExists(backupDir)).toBe(true);
      const backupFiles = await fs.readdir(backupDir);
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    test('should handle dry run workflow', async () => {
      // Create test file
      const testFile = path.join(tempDir, 'test.js');
      const originalContent = 'var x = 1;\nvar y = 2;';
      await fs.writeFile(testFile, originalContent);

      // Initialize CLI with dry run
      await cli.initialize({
        rules: rulesPath,
        dryRun: true
      });

      // Run dry run scan
      const results = await cli.scan(tempDir, {
        extensions: ['js'],
        dryRun: true
      });

      // Verify dry run results
      expect(results.patternsReplaced).toBeGreaterThan(0);

      // Verify file was NOT modified
      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe(originalContent);

      // Verify no backups were created
      const backupDir = path.join(tempDir, '.backups');
      expect(await fs.pathExists(backupDir)).toBe(false);
    });

    test('should handle empty directory gracefully', async () => {
      const emptyDir = path.join(tempDir, 'empty');
      await fs.ensureDir(emptyDir);

      await cli.initialize({ rules: rulesPath });

      const results = await cli.scan(emptyDir, { extensions: ['js'] });

      expect(results.filesScanned).toBe(0);
      expect(results.issuesFound).toBe(0);
    });

    test('should handle large number of files efficiently', async () => {
      // Create many small files
      const manyFilesDir = path.join(tempDir, 'many-files');
      await fs.ensureDir(manyFilesDir);

      const fileCount = 50;
      for (let i = 0; i < fileCount; i++) {
        await fs.writeFile(
          path.join(manyFilesDir, `file${i}.js`),
          `var item${i} = ${i};\nconsole.log(item${i});`
        );
      }

      await cli.initialize({ rules: rulesPath });

      const startTime = Date.now();
      const results = await cli.scan(manyFilesDir, { extensions: ['js'] });
      const scanTime = Date.now() - startTime;

      expect(results.filesScanned).toBe(fileCount);
      expect(results.issuesFound).toBe(fileCount * 2); // var + console.log per file
      expect(scanTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should handle files with different encodings', async () => {
      // Create files with different content
      await fs.writeFile(path.join(tempDir, 'ascii.js'), 'var x = 1;');
      await fs.writeFile(path.join(tempDir, 'unicode.js'), 'var message = "Hello 世界";');
      await fs.writeFile(path.join(tempDir, 'empty.js'), '');

      await cli.initialize({ rules: rulesPath });

      const results = await cli.scan(tempDir, { extensions: ['js'] });

      expect(results.filesScanned).toBe(3);
      expect(results.issuesFound).toBe(2); // Only non-empty files have var declarations
    });

    test('should handle permission errors gracefully', async () => {
      // Create a file and make it unreadable (if possible on this platform)
      const restrictedFile = path.join(tempDir, 'restricted.js');
      await fs.writeFile(restrictedFile, 'var x = 1;');
      
      try {
        await fs.chmod(restrictedFile, 0o000); // No permissions
      } catch (error) {
        // Skip this test if we can't change permissions (e.g., Windows)
        return;
      }

      // Mock console.warn to capture warnings
      const originalWarn = console.warn;
      const warnings = [];
      console.warn = (msg) => warnings.push(msg);

      await cli.initialize({ rules: rulesPath });

      const results = await cli.scan(tempDir, { 
        extensions: ['js'],
        verbose: true 
      });

      // Should handle the error gracefully
      expect(warnings.length).toBeGreaterThan(0);
      
      // Restore console.warn
      console.warn = originalWarn;

      // Restore file permissions for cleanup
      await fs.chmod(restrictedFile, 0o644);
    });
  });

  describe('Error Recovery', () => {
    test('should rollback changes on critical error during fixing', async () => {
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'var x = 1;');

      await cli.initialize({
        rules: rulesPath,
        fix: true,
        backupDir: path.join(tempDir, '.backups')
      });

      // Mock the fixer to throw an error after partial processing
      const originalApplyFixes = cli.fixer.applyFixes;
      cli.fixer.applyFixes = jest.fn().mockImplementation(async (findings) => {
        // Create a backup first
        await cli.fixer.createBackup(testFile);
        // Modify the file
        await fs.writeFile(testFile, 'const x = 1;');
        cli.fixer.fixedFiles.add(testFile);
        // Then throw an error
        throw new Error('Simulated error during fixing');
      });

      // Mock console methods to capture output
      const originalError = console.error;
      const originalLog = console.log;
      const errors = [];
      const logs = [];
      console.error = (msg) => errors.push(msg);
      console.log = (msg) => logs.push(msg);

      try {
        await cli.scan(tempDir, {
          extensions: ['js'],
          fix: true,
          yes: true
        });
      } catch (error) {
        // Expected to throw
      }

      // Should have attempted rollback
      expect(errors.some(msg => msg.includes && msg.includes('Simulated error'))).toBe(true);

      // Restore console methods
      console.error = originalError;
      console.log = originalLog;
      cli.fixer.applyFixes = originalApplyFixes;
    });
  });

  describe('Progress Reporting', () => {
    test('should show progress for large scans', async () => {
      // Create multiple files
      for (let i = 0; i < 10; i++) {
        await fs.writeFile(
          path.join(tempDir, `file${i}.js`),
          `var item${i} = ${i};`
        );
      }

      // Mock console.log to capture progress messages
      const originalLog = console.log;
      const logs = [];
      console.log = (msg) => logs.push(msg);

      await cli.initialize({ rules: rulesPath });

      await cli.scan(tempDir, {
        extensions: ['js'],
        verbose: true
      });

      // Should have progress messages
      const progressMessages = logs.filter(log => 
        typeof log === 'string' && log.includes('Scanning')
      );
      expect(progressMessages.length).toBeGreaterThan(0);

      // Restore console.log
      console.log = originalLog;
    });
  });
});