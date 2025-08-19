const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');
const ErrorHandler = require('./errorHandler');

/**
 * Scanner class handles file discovery and content reading with cross-platform support
 */
class Scanner {
  constructor(options = {}) {
    this.options = {
      maxFileSize: options.maxFileSize || 1024 * 1024, // 1MB default
      ignorePatterns: options.ignorePatterns || [
        'node_modules/**',
        '.git/**',
        '*.min.js',
        '*.min.css',
        'dist/**',
        'build/**',
        'coverage/**'
      ],
      supportedExtensions: options.supportedExtensions || [
        'js', 'jsx', 'ts', 'tsx', 'py', 'pyw', 'java', 'cpp', 'c', 'h'
      ],
      ...options
    };
    
    // Initialize error handler (will be set by parent if needed)
    this.errorHandler = options.errorHandler || null;
  }

  /**
   * Recursively scan directory for source code files
   * @param {string} targetPath - Directory path to scan
   * @param {Object} options - Scanning options
   * @returns {Promise<Array>} Array of file paths
   */
  async scanDirectory(targetPath, options = {}) {
    try {
      // Normalize path for cross-platform compatibility
      const normalizedPath = path.resolve(targetPath);
      
      // Check if target path exists
      if (!(await fs.pathExists(normalizedPath))) {
        throw new Error(`Target path does not exist: ${targetPath}`);
      }

      // Check if it's a directory
      const stats = await fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        throw new Error(`Target path is not a directory: ${targetPath}`);
      }

      // Build glob patterns for supported file extensions
      const extensions = options.extensions || this.options.supportedExtensions;
      const patterns = extensions.map(ext => `**/*.${ext}`);
      
      // Combine all patterns
      const globPattern = patterns.length === 1 ? patterns[0] : `{${patterns.join(',')}}`;

      // Configure glob options
      const globOptions = {
        cwd: normalizedPath,
        ignore: this.options.ignorePatterns,
        nodir: true, // Only return files, not directories
        dot: false, // Don't include hidden files by default
        absolute: true, // Return absolute paths
        windowsPathsNoEscape: true // Handle Windows paths correctly
      };

      // Find all matching files
      const files = await glob(globPattern, globOptions);
      
      // Filter files by size and accessibility
      const validFiles = [];
      for (const filePath of files) {
        try {
          const fileStats = await fs.stat(filePath);
          
          // Skip files that are too large
          if (fileStats.size > this.options.maxFileSize) {
            console.warn(`Skipping large file (${this.formatFileSize(fileStats.size)}): ${filePath}`);
            continue;
          }

          // Skip binary files
          if (await this.isBinaryFile(filePath)) {
            continue;
          }

          // Check if file is readable
          await fs.access(filePath, fs.constants.R_OK);
          validFiles.push(filePath);
        } catch (error) {
          // Skip files we can't access
          console.warn(`Skipping inaccessible file: ${filePath} (${error.message})`);
        }
      }

      return validFiles;
    } catch (error) {
      throw new Error(`Failed to scan directory: ${error.message}`);
    }
  }

  /**
   * Read file content with proper encoding detection and error handling
   * @param {string} filePath - Path to file to read
   * @returns {Promise<string>} File content as string
   */
  async readFile(filePath) {
    try {
      // Validate file first if error handler is available
      if (this.errorHandler) {
        const validation = await this.errorHandler.validateFile(filePath, {
          maxFileSize: this.options.maxFileSize
        });
        
        if (!validation.valid) {
          const error = validation.errors[0];
          throw new Error(error.message);
        }
      } else {
        // Fallback validation without error handler
        await fs.access(filePath, fs.constants.R_OK);
        const stats = await fs.stat(filePath);
        
        if (stats.size > this.options.maxFileSize) {
          throw new Error(`File too large: ${this.formatFileSize(stats.size)} (max: ${this.formatFileSize(this.options.maxFileSize)})`);
        }
      }

      // Read file content with encoding fallback
      let content;
      try {
        content = await fs.readFile(filePath, 'utf8');
        
        // Validate that content is actually text
        if (this.containsNullBytes(content)) {
          throw new Error('File contains null bytes (likely binary)');
        }
        
      } catch (encodingError) {
        if (this.errorHandler) {
          this.errorHandler.handleEncodingError(filePath, encodingError);
        }
        
        // Try latin1 as fallback for legacy files
        try {
          content = await fs.readFile(filePath, 'latin1');
        } catch (fallbackError) {
          throw new Error(`Failed to read file with any encoding: ${fallbackError.message}`);
        }
      }

      return content;
    } catch (error) {
      // Handle specific error types
      if (this.errorHandler) {
        if (error.code === 'EACCES') {
          this.errorHandler.handlePermissionError(filePath, error);
        } else if (error.code === 'ENOENT') {
          this.errorHandler.handleFilesystemError('read', filePath, error);
        } else if (error.message.includes('File too large')) {
          // Already handled by validation
        } else {
          this.errorHandler.handleUnknownError('file read', error, { filePath });
        }
      }
      
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Check if content contains null bytes (indicating binary content)
   * @param {string} content - File content to check
   * @returns {boolean} True if content contains null bytes
   */
  containsNullBytes(content) {
    return content.indexOf('\0') !== -1;
  }

  /**
   * Get file extension without the dot
   * @param {string} filePath - Path to file
   * @returns {string} File extension (lowercase, without dot)
   */
  getFileExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext.startsWith('.') ? ext.slice(1) : ext;
  }

  /**
   * Get supported file extensions
   * @returns {Array} Array of supported extensions
   */
  getSupportedExtensions() {
    return [...this.options.supportedExtensions];
  }

  /**
   * Check if a file is likely binary by examining its content
   * @param {string} filePath - Path to file to check
   * @returns {Promise<boolean>} True if file appears to be binary
   */
  async isBinaryFile(filePath) {
    try {
      // Read first 512 bytes to check for binary content
      const buffer = Buffer.alloc(512);
      const fd = await fs.open(filePath, 'r');
      const { bytesRead } = await fs.read(fd, buffer, 0, 512, 0);
      await fs.close(fd);

      if (bytesRead === 0) {
        return false; // Empty file is not binary
      }

      // Check for null bytes (common in binary files)
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }

      // Check for high percentage of non-printable characters
      let nonPrintableCount = 0;
      for (let i = 0; i < bytesRead; i++) {
        const byte = buffer[i];
        // Consider bytes outside printable ASCII range (except common whitespace)
        if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
          nonPrintableCount++;
        } else if (byte > 126) {
          nonPrintableCount++;
        }
      }

      // If more than 30% non-printable characters, consider it binary
      return (nonPrintableCount / bytesRead) > 0.3;
    } catch (error) {
      // If we can't read the file, assume it's not binary
      return false;
    }
  }

  /**
   * Format file size in human-readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Get relative path from a base directory
   * @param {string} filePath - Absolute file path
   * @param {string} basePath - Base directory path
   * @returns {string} Relative path
   */
  getRelativePath(filePath, basePath) {
    return path.relative(basePath, filePath);
  }

  /**
   * Check if a file matches ignore patterns
   * @param {string} filePath - File path to check
   * @param {string} basePath - Base directory path
   * @returns {boolean} True if file should be ignored
   */
  shouldIgnoreFile(filePath, basePath) {
    const relativePath = this.getRelativePath(filePath, basePath);
    
    // Convert Windows paths to Unix-style for pattern matching
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    return this.options.ignorePatterns.some(pattern => {
      // Simple glob pattern matching
      const regexPattern = pattern
        .replace(/\*\*/g, '.*') // ** matches any number of directories
        .replace(/\*/g, '[^/]*') // * matches anything except directory separator
        .replace(/\?/g, '.'); // ? matches single character
      
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(normalizedPath);
    });
  }

  /**
   * Get file statistics
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} File statistics
   */
  async getFileStats(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      throw new Error(`Failed to get file stats for ${filePath}: ${error.message}`);
    }
  }
}

module.exports = Scanner;