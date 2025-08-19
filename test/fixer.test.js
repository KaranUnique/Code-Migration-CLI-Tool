const fs = require('fs-extra');
const path = require('path');
const Fixer = require('../lib/fixer');

describe('Fixer', () => {
  let tempDir;
  let fixer;
  let backupDir;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
    backupDir = path.join(tempDir, '.backups');
    fixer = new Fixer({ backupDir });
  });

  afterEach(async () => {
    // Clean up temporary files
    await fs.remove(tempDir);
  });

  describe('createBackup', () => {
    test('should create backup file successfully', async () => {
      const testFile = path.join(tempDir, 'test.js');
      const testContent = 'var x = 1;\nconsole.log(x);';
      await fs.writeFile(testFile, testContent);

      const backupPath = await fixer.createBackup(testFile);
      
      expect(await fs.pathExists(backupPath)).toBe(true);
      expect(backupPath).toContain('.backups');
      expect(backupPath).toContain('test.js');
      expect(backupPath).toContain('.backup');
      
      const backupContent = await fs.readFile(backupPath, 'utf8');
      expect(backupContent).toBe(testContent);
    });

    test('should create backup directory if it does not exist', async () => {
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'test content');

      await fixer.createBackup(testFile);
      
      expect(await fs.pathExists(backupDir)).toBe(true);
    });

    test('should throw error for non-existent file', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.js');
      
      await expect(fixer.createBackup(nonExistentFile)).rejects.toThrow('Failed to create backup');
    });

    test('should register backup in registry', async () => {
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'test content');

      await fixer.createBackup(testFile);
      
      const backupInfo = fixer.getBackupInfo(testFile);
      expect(backupInfo).toBeTruthy();
      expect(backupInfo.hasBackup).toBe(true);
    });

    test('should create timestamped backups when enabled', async () => {
      const timestampedFixer = new Fixer({ 
        backupDir, 
        createTimestampedBackups: true 
      });
      
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'test content');

      const backupPath = await timestampedFixer.createBackup(testFile);
      
      expect(backupPath).toMatch(/test\.js\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });
  });

  describe('applyFixes', () => {
    test('should apply fixes to multiple files', async () => {
      // Create test files
      const file1 = path.join(tempDir, 'file1.js');
      const file2 = path.join(tempDir, 'file2.js');
      await fs.writeFile(file1, 'var x = 1;\nvar y = 2;');
      await fs.writeFile(file2, 'var z = 3;');

      // Create findings with fixes
      const findings = [
        {
          ruleId: 'var-to-const',
          filePath: file1,
          lineNumber: 1,
          columnNumber: 1,
          matchedText: 'var x',
          replacement: 'const x',
          fixable: true
        },
        {
          ruleId: 'var-to-const',
          filePath: file1,
          lineNumber: 2,
          columnNumber: 1,
          matchedText: 'var y',
          replacement: 'const y',
          fixable: true
        },
        {
          ruleId: 'var-to-const',
          filePath: file2,
          lineNumber: 1,
          columnNumber: 1,
          matchedText: 'var z',
          replacement: 'const z',
          fixable: true
        }
      ];

      const results = await fixer.applyFixes(findings);
      
      expect(results.filesProcessed).toBe(2);
      expect(results.filesFixed).toBe(2);
      expect(results.patternsReplaced).toBe(3);
      expect(results.backupsCreated).toHaveLength(2);
      
      // Check that files were actually modified
      const file1Content = await fs.readFile(file1, 'utf8');
      const file2Content = await fs.readFile(file2, 'utf8');
      expect(file1Content).toContain('const x');
      expect(file1Content).toContain('const y');
      expect(file2Content).toContain('const z');
    });

    test('should skip non-fixable findings', async () => {
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'console.log("test");');

      const findings = [
        {
          ruleId: 'console-log',
          filePath: testFile,
          lineNumber: 1,
          columnNumber: 1,
          matchedText: 'console.log',
          replacement: null, // Not fixable
          fixable: false
        }
      ];

      const results = await fixer.applyFixes(findings);
      
      expect(results.filesProcessed).toBe(0);
      expect(results.filesFixed).toBe(0);
      expect(results.patternsReplaced).toBe(0);
    });

    test('should handle errors gracefully when continueOnError is true', async () => {
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'test content');
      
      // Make file read-only to cause an error
      await fs.chmod(testFile, 0o444);

      const findings = [
        {
          ruleId: 'test-rule',
          filePath: testFile,
          lineNumber: 1,
          columnNumber: 1,
          matchedText: 'test',
          replacement: 'TEST',
          fixable: true
        }
      ];

      const results = await fixer.applyFixes(findings, { continueOnError: true });
      
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].filePath).toBe(testFile);
    });

    test('should work in dry run mode', async () => {
      const dryRunFixer = new Fixer({ backupDir, dryRun: true });
      const testFile = path.join(tempDir, 'test.js');
      const originalContent = 'var x = 1;';
      await fs.writeFile(testFile, originalContent);

      const findings = [
        {
          ruleId: 'var-to-const',
          filePath: testFile,
          lineNumber: 1,
          columnNumber: 1,
          matchedText: 'var x',
          replacement: 'const x',
          fixable: true
        }
      ];

      const results = await dryRunFixer.applyFixes(findings);
      
      expect(results.filesProcessed).toBe(1);
      expect(results.patternsReplaced).toBe(1);
      
      // File should not be modified in dry run
      const fileContent = await fs.readFile(testFile, 'utf8');
      expect(fileContent).toBe(originalContent);
    });
  });

  describe('fixFile', () => {
    test('should fix patterns in a single file', async () => {
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'var x = 1;\nvar y = 2;');

      const findings = [
        {
          ruleId: 'var-to-const',
          lineNumber: 1,
          columnNumber: 1,
          matchedText: 'var x',
          replacement: 'const x',
          fixable: true
        },
        {
          ruleId: 'var-to-const',
          lineNumber: 2,
          columnNumber: 1,
          matchedText: 'var y',
          replacement: 'const y',
          fixable: true
        }
      ];

      const result = await fixer.fixFile(testFile, findings);
      
      expect(result.patternsReplaced).toBe(2);
      expect(result.filePath).toBe(testFile);
      
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('const x = 1;\nconst y = 2;');
    });

    test('should preserve file permissions', async () => {
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'var x = 1;');
      await fs.chmod(testFile, 0o755);

      const findings = [
        {
          ruleId: 'var-to-const',
          lineNumber: 1,
          columnNumber: 1,
          matchedText: 'var x',
          replacement: 'const x',
          fixable: true
        }
      ];

      await fixer.fixFile(testFile, findings);
      
      const stats = await fs.stat(testFile);
      expect(stats.mode & 0o777).toBe(0o755);
    });
  });

  describe('restoreFromBackup', () => {
    test('should restore file from backup', async () => {
      const testFile = path.join(tempDir, 'test.js');
      const originalContent = 'var x = 1;';
      const modifiedContent = 'const x = 1;';
      
      await fs.writeFile(testFile, originalContent);
      await fixer.createBackup(testFile);
      await fs.writeFile(testFile, modifiedContent);

      const results = await fixer.restoreFromBackup(testFile);
      
      expect(results.filesRestored).toBe(1);
      expect(results.errors).toHaveLength(0);
      
      const restoredContent = await fs.readFile(testFile, 'utf8');
      expect(restoredContent).toBe(originalContent);
    });

    test('should handle multiple files', async () => {
      const file1 = path.join(tempDir, 'file1.js');
      const file2 = path.join(tempDir, 'file2.js');
      
      await fs.writeFile(file1, 'original1');
      await fs.writeFile(file2, 'original2');
      
      await fixer.createBackup(file1);
      await fixer.createBackup(file2);
      
      await fs.writeFile(file1, 'modified1');
      await fs.writeFile(file2, 'modified2');

      const results = await fixer.restoreFromBackup([file1, file2]);
      
      expect(results.filesRestored).toBe(2);
      
      expect(await fs.readFile(file1, 'utf8')).toBe('original1');
      expect(await fs.readFile(file2, 'utf8')).toBe('original2');
    });

    test('should handle missing backup gracefully', async () => {
      const testFile = path.join(tempDir, 'test.js');
      
      const results = await fixer.restoreFromBackup(testFile);
      
      expect(results.filesRestored).toBe(0);
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0].error).toContain('No backup found');
    });
  });

  describe('rollbackChanges', () => {
    test('should rollback all changes', async () => {
      const file1 = path.join(tempDir, 'file1.js');
      const file2 = path.join(tempDir, 'file2.js');
      
      await fs.writeFile(file1, 'original1');
      await fs.writeFile(file2, 'original2');
      
      await fixer.createBackup(file1);
      await fixer.createBackup(file2);
      
      await fs.writeFile(file1, 'modified1');
      await fs.writeFile(file2, 'modified2');

      const results = await fixer.rollbackChanges();
      
      expect(results.filesRestored).toBe(2);
      expect(await fs.readFile(file1, 'utf8')).toBe('original1');
      expect(await fs.readFile(file2, 'utf8')).toBe('original2');
    });
  });

  describe('cleanupOldBackups', () => {
    test('should remove old backup files', async () => {
      // Create old backup file
      const oldBackup = path.join(backupDir, 'old.js.backup');
      await fs.ensureDir(backupDir);
      await fs.writeFile(oldBackup, 'old backup');
      
      // Set old timestamp
      const oldTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      await fs.utimes(oldBackup, oldTime, oldTime);

      const results = await fixer.cleanupOldBackups();
      
      expect(results.filesDeleted).toBe(1);
      expect(await fs.pathExists(oldBackup)).toBe(false);
    });

    test('should keep recent backup files', async () => {
      const recentBackup = path.join(backupDir, 'recent.js.backup');
      await fs.ensureDir(backupDir);
      await fs.writeFile(recentBackup, 'recent backup');

      const results = await fixer.cleanupOldBackups();
      
      expect(results.filesDeleted).toBe(0);
      expect(await fs.pathExists(recentBackup)).toBe(true);
    });
  });

  describe('utility methods', () => {
    test('should get fixed files list', async () => {
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'var x = 1;');

      const findings = [
        {
          ruleId: 'var-to-const',
          filePath: testFile,
          lineNumber: 1,
          columnNumber: 1,
          matchedText: 'var x',
          replacement: 'const x',
          fixable: true
        }
      ];

      await fixer.applyFixes(findings);
      
      const fixedFiles = fixer.getFixedFiles();
      expect(fixedFiles).toContain(testFile);
    });

    test('should validate fixable findings', () => {
      const fixableFinding = {
        fixable: true,
        replacement: 'const x',
        matchedText: 'var x'
      };
      
      const nonFixableFinding = {
        fixable: false,
        replacement: null,
        matchedText: 'console.log'
      };

      expect(fixer.canFix(fixableFinding)).toBe(true);
      expect(fixer.canFix(nonFixableFinding)).toBe(false);
    });

    test('should format file sizes', () => {
      expect(fixer.formatFileSize(1024)).toBe('1.0KB');
      expect(fixer.formatFileSize(1048576)).toBe('1.0MB');
      expect(fixer.formatFileSize(500)).toBe('500.0B');
    });

    test('should group findings by file', () => {
      const findings = [
        { filePath: '/file1.js', ruleId: 'rule1' },
        { filePath: '/file2.js', ruleId: 'rule2' },
        { filePath: '/file1.js', ruleId: 'rule3' }
      ];

      const grouped = fixer.groupFindingsByFile(findings);
      
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['/file1.js']).toHaveLength(2);
      expect(grouped['/file2.js']).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    test('should handle permission errors', async () => {
      const testFile = path.join(tempDir, 'readonly.js');
      await fs.writeFile(testFile, 'var x = 1;');
      await fs.chmod(testFile, 0o444); // Read-only

      await expect(fixer.createBackup(testFile)).rejects.toThrow();
    });

    test('should handle disk space issues', async () => {
      // This is a basic test - in practice, you'd mock fs operations
      const testFile = path.join(tempDir, 'test.js');
      await fs.writeFile(testFile, 'test content');

      // The checkDiskSpace method should not throw for normal files
      await expect(fixer.checkDiskSpace(testFile, backupDir)).resolves.not.toThrow();
    });
  });
});