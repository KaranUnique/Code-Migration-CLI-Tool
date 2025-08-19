const fs = require('fs-extra');
const path = require('path');

/**
 * Comprehensive error handling and edge case management
 */
class ErrorHandler {
  constructor(formatter) {
    this.formatter = formatter;
    this.errorCounts = {
      permission: 0,
      fileSize: 0,
      encoding: 0,
      timeout: 0,
      memory: 0,
      regex: 0,
      filesystem: 0,
      unknown: 0
    };
  }

  /**
   * Handle file permission errors
   * @param {string} filePath - Path to the problematic file
   * @param {Error} error - The permission error
   * @returns {Object} Error handling result
   */
  handlePermissionError(filePath, error) {
    this.errorCounts.permission++;
    
    const result = {
      type: 'permission',
      filePath,
      message: `Permission denied: ${path.basename(filePath)}`,
      suggestion: 'Check file permissions and ensure read access',
      recoverable: true,
      skipFile: true
    };

    if (this.errorCounts.permission <= 3) {
      console.warn(this.formatter.formatWarning(
        `${result.message} - ${result.suggestion}`
      ));
    } else if (this.errorCounts.permission === 4) {
      console.warn(this.formatter.formatWarning(
        'Multiple permission errors detected. Further permission errors will be logged silently.'
      ));
    }

    return result;
  }

  /**
   * Handle file size limit errors
   * @param {string} filePath - Path to the large file
   * @param {number} fileSize - Size of the file in bytes
   * @param {number} maxSize - Maximum allowed size
   * @returns {Object} Error handling result
   */
  handleFileSizeError(filePath, fileSize, maxSize) {
    this.errorCounts.fileSize++;
    
    const result = {
      type: 'fileSize',
      filePath,
      message: `File too large: ${path.basename(filePath)} (${this.formatFileSize(fileSize)})`,
      suggestion: `Increase --max-file-size limit (current: ${this.formatFileSize(maxSize)})`,
      recoverable: true,
      skipFile: true
    };

    console.warn(this.formatter.formatWarning(
      `${result.message} - ${result.suggestion}`
    ));

    return result;
  }

  /**
   * Handle file encoding errors
   * @param {string} filePath - Path to the file with encoding issues
   * @param {Error} error - The encoding error
   * @returns {Object} Error handling result
   */
  handleEncodingError(filePath, error) {
    this.errorCounts.encoding++;
    
    const result = {
      type: 'encoding',
      filePath,
      message: `Encoding error: ${path.basename(filePath)}`,
      suggestion: 'File may be binary or use unsupported encoding',
      recoverable: true,
      skipFile: true
    };

    if (this.errorCounts.encoding <= 5) {
      console.warn(this.formatter.formatWarning(
        `${result.message} - ${result.suggestion}`
      ));
    }

    return result;
  }

  /**
   * Handle regex timeout errors
   * @param {string} ruleId - ID of the rule that timed out
   * @param {string} filePath - Path to the file being processed
   * @returns {Object} Error handling result
   */
  handleRegexTimeoutError(ruleId, filePath) {
    this.errorCounts.timeout++;
    
    const result = {
      type: 'timeout',
      ruleId,
      filePath,
      message: `Regex timeout in rule "${ruleId}" for ${path.basename(filePath)}`,
      suggestion: 'Rule pattern may be too complex or cause catastrophic backtracking',
      recoverable: true,
      skipRule: true
    };

    console.warn(this.formatter.formatWarning(
      `${result.message} - ${result.suggestion}`
    ));

    return result;
  }

  /**
   * Handle memory pressure situations
   * @param {string} operation - Operation that caused memory pressure
   * @param {number} memoryUsage - Current memory usage in bytes
   * @returns {Object} Error handling result
   */
  handleMemoryPressure(operation, memoryUsage) {
    this.errorCounts.memory++;
    
    const result = {
      type: 'memory',
      operation,
      message: `High memory usage detected during ${operation}`,
      suggestion: 'Consider processing smaller batches or increasing available memory',
      recoverable: true,
      pauseProcessing: true
    };

    console.warn(this.formatter.formatWarning(
      `${result.message} (${this.formatFileSize(memoryUsage)}) - ${result.suggestion}`
    ));

    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }

    return result;
  }

  /**
   * Handle invalid regex patterns
   * @param {string} ruleId - ID of the rule with invalid pattern
   * @param {string} pattern - The invalid pattern
   * @param {Error} error - The regex error
   * @returns {Object} Error handling result
   */
  handleInvalidRegexError(ruleId, pattern, error) {
    this.errorCounts.regex++;
    
    const result = {
      type: 'regex',
      ruleId,
      pattern,
      message: `Invalid regex pattern in rule "${ruleId}": ${error.message}`,
      suggestion: 'Check rule configuration and fix the regex pattern',
      recoverable: false,
      skipRule: true
    };

    console.error(this.formatter.formatError(new Error(
      `${result.message} - ${result.suggestion}`
    )));

    return result;
  }

  /**
   * Handle filesystem errors (disk full, network issues, etc.)
   * @param {string} operation - Operation that failed
   * @param {string} path - Path involved in the operation
   * @param {Error} error - The filesystem error
   * @returns {Object} Error handling result
   */
  handleFilesystemError(operation, path, error) {
    this.errorCounts.filesystem++;
    
    const result = {
      type: 'filesystem',
      operation,
      path,
      message: `Filesystem error during ${operation}: ${error.message}`,
      suggestion: this.getFilesystemErrorSuggestion(error),
      recoverable: this.isFilesystemErrorRecoverable(error),
      retryable: true
    };

    if (result.recoverable) {
      console.warn(this.formatter.formatWarning(
        `${result.message} - ${result.suggestion}`
      ));
    } else {
      console.error(this.formatter.formatError(new Error(
        `${result.message} - ${result.suggestion}`
      )));
    }

    return result;
  }

  /**
   * Handle unknown/unexpected errors
   * @param {string} operation - Operation that failed
   * @param {Error} error - The unexpected error
   * @param {Object} context - Additional context information
   * @returns {Object} Error handling result
   */
  handleUnknownError(operation, error, context = {}) {
    this.errorCounts.unknown++;
    
    const result = {
      type: 'unknown',
      operation,
      error: error.message,
      stack: error.stack,
      context,
      message: `Unexpected error during ${operation}: ${error.message}`,
      suggestion: 'This may be a bug. Consider reporting it with --verbose output',
      recoverable: false,
      critical: true
    };

    console.error(this.formatter.formatError(new Error(
      `${result.message} - ${result.suggestion}`
    )));

    return result;
  }

  /**
   * Check if memory usage is approaching limits
   * @returns {Object} Memory status information
   */
  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const totalMB = Math.round(usage.heapUsed / 1024 / 1024);
    const maxMB = Math.round(usage.heapTotal / 1024 / 1024);
    
    const memoryPressure = {
      current: usage.heapUsed,
      total: usage.heapTotal,
      percentage: (usage.heapUsed / usage.heapTotal) * 100,
      warning: totalMB > 500, // Warn if using more than 500MB
      critical: totalMB > 1000 // Critical if using more than 1GB
    };

    if (memoryPressure.critical) {
      this.handleMemoryPressure('memory check', usage.heapUsed);
    } else if (memoryPressure.warning) {
      console.warn(this.formatter.formatWarning(
        `High memory usage: ${totalMB}MB / ${maxMB}MB`
      ));
    }

    return memoryPressure;
  }

  /**
   * Validate file before processing
   * @param {string} filePath - Path to file to validate
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validateFile(filePath, options = {}) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      fileInfo: null
    };

    try {
      // Check if file exists
      if (!(await fs.pathExists(filePath))) {
        validation.valid = false;
        validation.errors.push(this.handleFilesystemError('file check', filePath, 
          new Error('File does not exist')));
        return validation;
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      validation.fileInfo = {
        size: stats.size,
        modified: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        permissions: stats.mode
      };

      // Check if it's actually a file
      if (!stats.isFile()) {
        validation.valid = false;
        validation.errors.push(this.handleFilesystemError('file check', filePath,
          new Error('Path is not a regular file')));
        return validation;
      }

      // Check file size
      if (options.maxFileSize && stats.size > options.maxFileSize) {
        validation.valid = false;
        validation.errors.push(this.handleFileSizeError(filePath, stats.size, options.maxFileSize));
        return validation;
      }

      // Check file permissions
      try {
        await fs.access(filePath, fs.constants.R_OK);
      } catch (error) {
        validation.valid = false;
        validation.errors.push(this.handlePermissionError(filePath, error));
        return validation;
      }

      // Check if file is binary (basic check)
      if (await this.isBinaryFile(filePath)) {
        validation.warnings.push({
          type: 'binary',
          message: 'File appears to be binary',
          suggestion: 'Binary files are typically skipped'
        });
      }

    } catch (error) {
      validation.valid = false;
      validation.errors.push(this.handleUnknownError('file validation', error, { filePath }));
    }

    return validation;
  }

  /**
   * Create timeout wrapper for regex operations
   * @param {Function} operation - Operation to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} context - Context for error reporting
   * @returns {Promise} Promise that resolves or rejects with timeout
   */
  withTimeout(operation, timeoutMs = 5000, context = 'operation') {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms: ${context}`));
      }, timeoutMs);

      Promise.resolve(operation())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Get error summary for reporting
   * @returns {Object} Error summary statistics
   */
  getErrorSummary() {
    const total = Object.values(this.errorCounts).reduce((sum, count) => sum + count, 0);
    
    return {
      total,
      byType: { ...this.errorCounts },
      hasErrors: total > 0,
      hasCriticalErrors: this.errorCounts.unknown > 0 || this.errorCounts.regex > 0
    };
  }

  /**
   * Reset error counters
   */
  reset() {
    Object.keys(this.errorCounts).forEach(key => {
      this.errorCounts[key] = 0;
    });
  }

  /**
   * Get filesystem error suggestion based on error code
   * @param {Error} error - Filesystem error
   * @returns {string} Suggestion for fixing the error
   */
  getFilesystemErrorSuggestion(error) {
    const code = error.code;
    
    const suggestions = {
      'ENOENT': 'File or directory does not exist',
      'EACCES': 'Permission denied - check file/directory permissions',
      'ENOSPC': 'No space left on device - free up disk space',
      'EMFILE': 'Too many open files - close some files or increase limits',
      'ENOTDIR': 'Path component is not a directory',
      'EISDIR': 'Path is a directory, not a file',
      'EBUSY': 'File is busy or locked by another process',
      'EROFS': 'Read-only file system - cannot write to this location'
    };

    return suggestions[code] || 'Check file system and permissions';
  }

  /**
   * Check if filesystem error is recoverable
   * @param {Error} error - Filesystem error
   * @returns {boolean} True if error is recoverable
   */
  isFilesystemErrorRecoverable(error) {
    const recoverableCodes = ['ENOENT', 'EACCES', 'ENOTDIR', 'EISDIR'];
    return recoverableCodes.includes(error.code);
  }

  /**
   * Basic binary file detection
   * @param {string} filePath - Path to file to check
   * @returns {Promise<boolean>} True if file appears to be binary
   */
  async isBinaryFile(filePath) {
    try {
      const buffer = Buffer.alloc(512);
      const fd = await fs.open(filePath, 'r');
      const { bytesRead } = await fs.read(fd, buffer, 0, 512, 0);
      await fs.close(fd);

      if (bytesRead === 0) return false;

      // Check for null bytes
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) return true;
      }

      return false;
    } catch (error) {
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
}

module.exports = ErrorHandler;