const fs = require('fs-extra');
const path = require('path');
const Scanner = require('../lib/scanner');

describe('Scanner', () => {
  let tempDir;
  let scanner;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
    scanner = new Scanner();
  });

  afterEach(async () => {
    // Clean up temporary files
    await fs.remove(tempDir);
  });

  describe('scanDirectory', () => {
    test('should find JavaScript files in directory', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'test1.js'), 'console.log("test1");');
      await fs.writeFile(path.join(tempDir, 'test2.js'), 'console.log("test2");');
      await fs.writeFile(path.join(tempDir, 'readme.txt'), 'This is a readme');

      const files = await scanner.scanDirectory(tempDir, { extensions: ['js'] });
      
      expect(files).toHaveLength(2);
      expect(files.some(f => f.endsWith('test1.js'))).toBe(true);
      expect(files.some(f => f.endsWith('test2.js'))).toBe(true);
      expect(files.some(f => f.endsWith('readme.txt'))).toBe(false);
    });

    test('should find files in subdirectories', async () => {
      // Create nested directory structure
      const subDir = path.join(tempDir, 'src');
      await fs.ensureDir(subDir);
      await fs.writeFile(path.join(subDir, 'main.js'), 'function main() {}');
      await fs.writeFile(path.join(tempDir, 'index.js'), 'require("./src/main");');

      const files = await scanner.scanDirectory(tempDir, { extensions: ['js'] });
      
      expect(files).toHaveLength(2);
      expect(files.some(f => f.includes('main.js'))).toBe(true);
      expect(files.some(f => f.includes('index.js'))).toBe(true);
    });

    test('should respect ignore patterns', async () => {
      // Create files that should be ignored
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      await fs.ensureDir(nodeModulesDir);
      await fs.writeFile(path.join(nodeModulesDir, 'package.js'), 'module.exports = {};');
      await fs.writeFile(path.join(tempDir, 'app.js'), 'console.log("app");');

      const files = await scanner.scanDirectory(tempDir, { extensions: ['js'] });
      
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/app\.js$/);
      expect(files.some(f => f.includes('node_modules'))).toBe(false);
    });

    test('should throw error for non-existent directory', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent');
      
      await expect(scanner.scanDirectory(nonExistentPath)).rejects.toThrow('does not exist');
    });

    test('should throw error when target is not a directory', async () => {
      const filePath = path.join(tempDir, 'test.js');
      await fs.writeFile(filePath, 'console.log("test");');
      
      await expect(scanner.scanDirectory(filePath)).rejects.toThrow('not a directory');
    });

    test('should handle multiple file extensions', async () => {
      await fs.writeFile(path.join(tempDir, 'script.js'), 'console.log("js");');
      await fs.writeFile(path.join(tempDir, 'script.py'), 'print("python")');
      await fs.writeFile(path.join(tempDir, 'script.java'), 'System.out.println("java");');

      const files = await scanner.scanDirectory(tempDir, { extensions: ['js', 'py'] });
      
      expect(files).toHaveLength(2);
      expect(files.some(f => f.endsWith('.js'))).toBe(true);
      expect(files.some(f => f.endsWith('.py'))).toBe(true);
      expect(files.some(f => f.endsWith('.java'))).toBe(false);
    });
  });

  describe('readFile', () => {
    test('should read file content correctly', async () => {
      const testContent = 'console.log("Hello, World!");';
      const filePath = path.join(tempDir, 'test.js');
      await fs.writeFile(filePath, testContent);

      const content = await scanner.readFile(filePath);
      
      expect(content).toBe(testContent);
    });

    test('should handle UTF-8 encoded files', async () => {
      const testContent = 'console.log("Hello, 世界!");'; // Contains Unicode characters
      const filePath = path.join(tempDir, 'unicode.js');
      await fs.writeFile(filePath, testContent, 'utf8');

      const content = await scanner.readFile(filePath);
      
      expect(content).toBe(testContent);
    });

    test('should throw error for non-existent file', async () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.js');
      
      await expect(scanner.readFile(nonExistentFile)).rejects.toThrow('Failed to read file');
    });

    test('should handle empty files', async () => {
      const filePath = path.join(tempDir, 'empty.js');
      await fs.writeFile(filePath, '');

      const content = await scanner.readFile(filePath);
      
      expect(content).toBe('');
    });
  });

  describe('getFileExtension', () => {
    test('should extract file extension correctly', () => {
      expect(scanner.getFileExtension('test.js')).toBe('js');
      expect(scanner.getFileExtension('path/to/file.py')).toBe('py');
      expect(scanner.getFileExtension('component.jsx')).toBe('jsx');
      expect(scanner.getFileExtension('file.min.js')).toBe('js');
    });

    test('should handle files without extension', () => {
      expect(scanner.getFileExtension('README')).toBe('');
      expect(scanner.getFileExtension('path/to/Makefile')).toBe('');
    });

    test('should handle uppercase extensions', () => {
      expect(scanner.getFileExtension('FILE.JS')).toBe('js');
      expect(scanner.getFileExtension('script.PY')).toBe('py');
    });
  });

  describe('isBinaryFile', () => {
    test('should detect text files as non-binary', async () => {
      const textFile = path.join(tempDir, 'text.js');
      await fs.writeFile(textFile, 'console.log("Hello World");');

      const isBinary = await scanner.isBinaryFile(textFile);
      
      expect(isBinary).toBe(false);
    });

    test('should detect binary files', async () => {
      const binaryFile = path.join(tempDir, 'binary.bin');
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);
      await fs.writeFile(binaryFile, binaryData);

      const isBinary = await scanner.isBinaryFile(binaryFile);
      
      expect(isBinary).toBe(true);
    });

    test('should handle empty files', async () => {
      const emptyFile = path.join(tempDir, 'empty.txt');
      await fs.writeFile(emptyFile, '');

      const isBinary = await scanner.isBinaryFile(emptyFile);
      
      expect(isBinary).toBe(false);
    });
  });

  describe('utility methods', () => {
    test('should format file sizes correctly', () => {
      expect(scanner.formatFileSize(1024)).toBe('1.0KB');
      expect(scanner.formatFileSize(1048576)).toBe('1.0MB');
      expect(scanner.formatFileSize(500)).toBe('500.0B');
      expect(scanner.formatFileSize(1536)).toBe('1.5KB');
    });

    test('should get relative paths correctly', () => {
      const basePath = '/home/user/project';
      const filePath = '/home/user/project/src/main.js';
      
      const relativePath = scanner.getRelativePath(filePath, basePath);
      
      expect(relativePath).toBe(path.join('src', 'main.js'));
    });

    test('should check ignore patterns correctly', () => {
      const basePath = '/project';
      
      expect(scanner.shouldIgnoreFile('/project/node_modules/package.js', basePath)).toBe(true);
      expect(scanner.shouldIgnoreFile('/project/src/main.js', basePath)).toBe(false);
      expect(scanner.shouldIgnoreFile('/project/dist/bundle.js', basePath)).toBe(true);
      expect(scanner.shouldIgnoreFile('/project/app.min.js', basePath)).toBe(true);
    });

    test('should get supported extensions', () => {
      const extensions = scanner.getSupportedExtensions();
      
      expect(extensions).toContain('js');
      expect(extensions).toContain('py');
      expect(extensions).toContain('java');
      expect(Array.isArray(extensions)).toBe(true);
    });
  });

  describe('file size limits', () => {
    test('should skip files that are too large', async () => {
      const smallScanner = new Scanner({ maxFileSize: 10 }); // 10 bytes limit
      
      const largeFile = path.join(tempDir, 'large.js');
      await fs.writeFile(largeFile, 'console.log("This file is larger than 10 bytes");');

      await expect(smallScanner.readFile(largeFile)).rejects.toThrow('File too large');
    });

    test('should include file size information in error', async () => {
      const smallScanner = new Scanner({ maxFileSize: 5 });
      
      const file = path.join(tempDir, 'test.js');
      await fs.writeFile(file, 'console.log("test");');

      try {
        await smallScanner.readFile(file);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('File too large');
        expect(error.message).toContain('B'); // Should contain size unit
      }
    });
  });
});