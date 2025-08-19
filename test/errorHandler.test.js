const fs = require('fs-extra');
const path = require('path');
const ErrorHandler = require('../lib/errorHandler');
const Formatter = require('../lib/formatter');

describe('ErrorHandler', () => {
  let tempDir;
  let errorHandler;
  let formatter;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
    formatter = new Formatter({ colorEnabled: false });
    errorHandler = new ErrorHandler(formatter);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Permission Error Handling', () => {
    test('should handle permission errors gracefully', async () => {
      const testFile = path.join(tempDir, 'restricted.js');
      await fs.writeFile(testFile, 'var x = 1;');
      
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      
      const result = errorHandler.handlePermissionError(testFile, error);
      
      expect(result.type).toBe('permission');
      expect(result.recoverable).toBe(true);
      expect(result.skipFile).toBe(true);
      expect(result.message).toContain('Permission denied');
      expect(errorHandler.errorCounts.permission).toBe(1);
    });

    test('should suppress repeated permission errors', () => {
      const testFile = path.join(tempDir, 'restricted.js');
      const error = new Error('Permission denied');
      error.code = 'EACCES';
      
      // Mock console.warn to track calls
      const originalWarn = console.warn;
      const warnCalls = [];
      console.warn = (msg) => warnCalls.push(msg);
      
      // Generate multiple permission errors
      for (let i = 0; i < 6; i++) {
        errorHandler.handlePermissionError(`${testFile}${i}`, error);
      }
      
      // Should warn for first 3, then show suppression message, then be silent
      expect(warnCalls.length).toBe(4); // 3 individual + 1 suppression message
      expect(warnCalls[3]).toContain('Multiple permission errors');
      
      console.warn = originalWarn;
    });
  });

  describe('File Size Error Handling', () => {
    test('should handle file size limit errors', () => {
      const testFile = path.join(tempDir, 'large.js');
      const fileSize = 5 * 1024 * 1024; // 5MB
      const maxSize = 1024 * 1024; // 1MB
      
      const result = errorHandler.handleFileSizeError(testFile, fileSize, maxSize);
      
      expect(result.type).toBe('fileSize');
      expect(result.recoverable).toBe(true);
      expect(result.skipFile).toBe(true);
      expect(result.message).toContain('File too large');
      expect(result.suggestion).toContain('Increase --max-file-size');
    });
  });

  describe('Encoding Error Handling', () => {
    test('should handle encoding errors', () => {
      const testFile = path.join(tempDir, 'binary.bin');
      const error = new Error('Invalid UTF-8');
      
      const result = errorHandler.handleEncodingError(testFile, error);
      
      expect(result.type).toBe('encoding');
      expect(result.recoverable).toBe(true);
      expect(result.skipFile).toBe(true);
      expect(result.message).toContain('Encoding error');
    });
  });

  describe('Regex Timeout Handling', () => {
    test('should handle regex timeout errors', () => {
      const ruleId = 'complex-rule';
      const testFile = path.join(tempDir, 'test.js');
      
      const result = errorHandler.handleRegexTimeoutError(ruleId, testFile);
      
      expect(result.type).toBe('timeout');
      expect(result.ruleId).toBe(ruleId);
      expect(result.recoverable).toBe(true);
      expect(result.skipRule).toBe(true);
      expect(result.message).toContain('Regex timeout');
    });
  });

  describe('Memory Pressure Handling', () => {
    test('should handle memory pressure situations', () => {
      const operation = 'file scanning';
      const memoryUsage = 1024 * 1024 * 1024; // 1GB
      
      const result = errorHandler.handleMemoryPressure(operation, memoryUsage);
      
      expect(result.type).toBe('memory');
      expect(result.operation).toBe(operation);
      expect(result.recoverable).toBe(true);
      expect(result.pauseProcessing).toBe(true);
      expect(result.message).toContain('High memory usage');
    });

    test('should check memory usage and warn appropriately', () => {
      const originalWarn = console.warn;
      const warnings = [];
      console.warn = (msg) => warnings.push(msg);
      
      // Mock process.memoryUsage to return high usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = () => ({
        heapUsed: 600 * 1024 * 1024, // 600MB
        heapTotal: 800 * 1024 * 1024, // 800MB
        external: 0,
        arrayBuffers: 0
      });
      
      const memoryStatus = errorHandler.checkMemoryUsage();
      
      expect(memoryStatus.warning).toBe(true);
      expect(memoryStatus.critical).toBe(false);
      expect(warnings.length).toBeGreaterThan(0);
      
      // Restore original functions
      console.warn = originalWarn;
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Invalid Regex Handling', () => {
    test('should handle invalid regex patterns', () => {
      const ruleId = 'bad-rule';
      const pattern = '[invalid-regex';
      const error = new Error('Invalid regular expression');
      
      const result = errorHandler.handleInvalidRegexError(ruleId, pattern, error);
      
      expect(result.type).toBe('regex');
      expect(result.ruleId).toBe(ruleId);
      expect(result.pattern).toBe(pattern);
      expect(result.recoverable).toBe(false);
      expect(result.skipRule).toBe(true);
    });
  });

  describe('Filesystem Error Handling', () => {
    test('should handle various filesystem errors', () => {
      const operations = [
        { code: 'ENOENT', message: 'File not found' },
        { code: 'EACCES', message: 'Permission denied' },
        { code: 'ENOSPC', message: 'No space left' },
        { code: 'EMFILE', message: 'Too many files' }
      ];
      
      operations.forEach(({ code, message }) => {
        const error = new Error(message);
        error.code = code;
        
        const result = errorHandler.handleFilesystemError('test operation', '/test/path', error);
        
        expect(result.type).toBe('filesystem');
        expect(result.operation).toBe('test operation');
        expect(result.suggestion).toBeTruthy();
        expect(result.retryable).toBe(true);
      });
    });

    test('should provide appropriate suggestions for filesystem errors', () => {
      const testCases = [
        { code: 'ENOENT', expectedSuggestion: 'does not exist' },
        { code: 'EACCES', expectedSuggestion: 'Permission denied' },
        { code: 'ENOSPC', expectedSuggestion: 'No space left' },
        { code: 'UNKNOWN', expectedSuggestion: 'Check file system' }
      ];
      
      testCases.forEach(({ code, expectedSuggestion }) => {
        const suggestion = errorHandler.getFilesystemErrorSuggestion({ code });
        expect(suggestion).toContain(expectedSuggestion);
      });
    });
  });

  describe('File Validation', () => {
    test('should validate files successfully', async () => {
      const testFile = path.join(tempDir, 'valid.js');
      await fs.writeFile(testFile, 'var x = 1;');
      
      const validation = await errorHandler.validateFile(testFile, {
        maxFileSize: 1024 * 1024
      });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.fileInfo).toBeTruthy();
      expect(validation.fileInfo.isFile).toBe(true);
    });

    test('should detect non-existent files', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.js');
      
      const validation = await errorHandler.validateFile(nonExistentFile);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('filesystem');
    });

    test('should detect oversized files', async () => {
      const testFile = path.join(tempDir, 'large.js');
      await fs.writeFile(testFile, 'x'.repeat(2000)); // 2KB file
      
      const validation = await errorHandler.validateFile(testFile, {
        maxFileSize: 1000 // 1KB limit
      });
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('fileSize');
    });

    test('should detect directories', async () => {
      const testDir = path.join(tempDir, 'testdir');
      await fs.ensureDir(testDir);
      
      const validation = await errorHandler.validateFile(testDir);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
    });
  });

  describe('Timeout Wrapper', () => {
    test('should execute operation within timeout', async () => {
      const operation = () => Promise.resolve('success');
      
      const result = await errorHandler.withTimeout(operation, 1000, 'test');
      
      expect(result).toBe('success');
    });

    test('should timeout long-running operations', async () => {
      const operation = () => new Promise(resolve => setTimeout(resolve, 2000));
      
      await expect(
        errorHandler.withTimeout(operation, 100, 'test')
      ).rejects.toThrow('Operation timed out');
    });

    test('should handle operation errors', async () => {
      const operation = () => Promise.reject(new Error('Operation failed'));
      
      await expect(
        errorHandler.withTimeout(operation, 1000, 'test')
      ).rejects.toThrow('Operation failed');
    });
  });

  describe('Binary File Detection', () => {
    test('should detect text files as non-binary', async () => {
      const textFile = path.join(tempDir, 'text.js');
      await fs.writeFile(textFile, 'console.log("Hello World");');
      
      const isBinary = await errorHandler.isBinaryFile(textFile);
      
      expect(isBinary).toBe(false);
    });

    test('should detect binary files', async () => {
      const binaryFile = path.join(tempDir, 'binary.bin');
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await fs.writeFile(binaryFile, binaryData);
      
      const isBinary = await errorHandler.isBinaryFile(binaryFile);
      
      expect(isBinary).toBe(true);
    });

    test('should handle empty files', async () => {
      const emptyFile = path.join(tempDir, 'empty.txt');
      await fs.writeFile(emptyFile, '');
      
      const isBinary = await errorHandler.isBinaryFile(emptyFile);
      
      expect(isBinary).toBe(false);
    });
  });

  describe('Error Summary and Reset', () => {
    test('should provide error summary', () => {
      // Generate some errors
      errorHandler.handlePermissionError('/test1', new Error('test'));
      errorHandler.handleFileSizeError('/test2', 1000, 500);
      errorHandler.handleEncodingError('/test3', new Error('test'));
      
      const summary = errorHandler.getErrorSummary();
      
      expect(summary.total).toBe(3);
      expect(summary.byType.permission).toBe(1);
      expect(summary.byType.fileSize).toBe(1);
      expect(summary.byType.encoding).toBe(1);
      expect(summary.hasErrors).toBe(true);
      expect(summary.hasCriticalErrors).toBe(false);
    });

    test('should reset error counters', () => {
      // Generate some errors
      errorHandler.handlePermissionError('/test', new Error('test'));
      errorHandler.handleFileSizeError('/test', 1000, 500);
      
      expect(errorHandler.getErrorSummary().total).toBe(2);
      
      errorHandler.reset();
      
      expect(errorHandler.getErrorSummary().total).toBe(0);
      expect(errorHandler.getErrorSummary().hasErrors).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    test('should format file sizes correctly', () => {
      expect(errorHandler.formatFileSize(1024)).toBe('1.0KB');
      expect(errorHandler.formatFileSize(1048576)).toBe('1.0MB');
      expect(errorHandler.formatFileSize(500)).toBe('500.0B');
    });

    test('should determine error recoverability', () => {
      expect(errorHandler.isFilesystemErrorRecoverable({ code: 'ENOENT' })).toBe(true);
      expect(errorHandler.isFilesystemErrorRecoverable({ code: 'EACCES' })).toBe(true);
      expect(errorHandler.isFilesystemErrorRecoverable({ code: 'ENOSPC' })).toBe(false);
    });
  });
});