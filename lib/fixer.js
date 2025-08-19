const fs = require('fs-extra');
const path = require('path');

/**
 * Fixer class handles backup creation and automatic pattern replacement
 */
class Fixer {
  constructor(options = {}) {
    this.options = {
      backupDir: options.backupDir || '.code-migration-backups',
      createTimestampedBackups: options.createTimestampedBackups !== false,
      dryRun: options.dryRun || false,
      maxBackupAge: options.maxBackupAge || 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      ...options
    };
    
    this.backupRegistry = new Map(); // Track created backups for rollback
    this.fixedFiles = new Set(); // Track files that have been modified
  }

  /**
   * Create backup of a file before making changes
   * @param {string} filePath - Path to file to backup
   * @returns {Promise<string>} Path to backup file
   */
  async createBackup(filePath) {
    try {
      // Check if file exists and is readable
      await fs.access(filePath, fs.constants.R_OK);
      
      // Get file stats for validation
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Cannot backup non-file: ${filePath}`);
      }

      // Create backup directory if it doesn't exist
      const backupDir = path.resolve(this.options.backupDir);
      await fs.ensureDir(backupDir);

      // Generate backup filename with timestamp
      const originalName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = this.options.createTimestampedBackups 
        ? `${originalName}.${timestamp}.backup`
        : `${originalName}.backup`;
      
      const backupPath = path.join(backupDir, backupName);

      // Check available disk space (basic check)
      await this.checkDiskSpace(filePath, backupDir);

      // Copy file to backup location
      await fs.copy(filePath, backupPath, {
        preserveTimestamps: true,
        overwrite: false // Don't overwrite existing backups
      });

      // Register backup for potential rollback
      this.backupRegistry.set(filePath, backupPath);

      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Apply fixes to files based on findings
   * @param {Array} findings - Array of findings with fix information
   * @param {Object} options - Fix options
   * @returns {Promise<Object>} Fix results summary
   */
  async applyFixes(findings, options = {}) {
    const {
      confirmBeforeFix = false,
      backupBeforeFix = true,
      continueOnError = true
    } = options;

    const results = {
      filesProcessed: 0,
      filesFixed: 0,
      patternsReplaced: 0,
      errors: [],
      backupsCreated: [],
      fixedFiles: []
    };

    try {
      // Filter fixable findings
      const fixableFindings = findings.filter(finding => finding.fixable && finding.replacement !== null);
      
      if (fixableFindings.length === 0) {
        return results;
      }

      // Group findings by file for efficient processing
      const findingsByFile = this.groupFindingsByFile(fixableFindings);
      
      // Process each file
      for (const [filePath, fileFindings] of Object.entries(findingsByFile)) {
        try {
          results.filesProcessed++;
          
          // Create backup if requested
          let backupPath = null;
          if (backupBeforeFix && !this.options.dryRun) {
            backupPath = await this.createBackup(filePath);
            results.backupsCreated.push(backupPath);
          }

          // Apply fixes to the file
          const fixResult = await this.fixFile(filePath, fileFindings, options);
          
          if (fixResult.patternsReplaced > 0) {
            results.filesFixed++;
            results.patternsReplaced += fixResult.patternsReplaced;
            results.fixedFiles.push(filePath);
            this.fixedFiles.add(filePath);
          }

        } catch (error) {
          const errorInfo = {
            filePath,
            error: error.message,
            timestamp: new Date().toISOString()
          };
          results.errors.push(errorInfo);

          if (!continueOnError) {
            throw new Error(`Fix operation failed for ${filePath}: ${error.message}`);
          }
        }
      }

      return results;
    } catch (error) {
      // If there's a critical error, attempt to rollback
      if (results.backupsCreated.length > 0) {
        await this.rollbackChanges();
      }
      throw error;
    }
  }

  /**
   * Fix patterns in a single file
   * @param {string} filePath - Path to file to fix
   * @param {Array} findings - Findings for this file
   * @param {Object} options - Fix options
   * @returns {Promise<Object>} Fix result for this file
   */
  async fixFile(filePath, findings, options = {}) {
    try {
      // Read current file content
      const originalContent = await fs.readFile(filePath, 'utf8');
      let modifiedContent = originalContent;
      let patternsReplaced = 0;

      // Sort findings by position (descending) to avoid offset issues
      const sortedFindings = findings.sort((a, b) => {
        if (a.lineNumber !== b.lineNumber) {
          return b.lineNumber - a.lineNumber;
        }
        return b.columnNumber - a.columnNumber;
      });

      // Apply each fix
      for (const finding of sortedFindings) {
        const beforeContent = modifiedContent;
        modifiedContent = this.applyPatternReplacement(modifiedContent, finding);
        
        if (modifiedContent !== beforeContent) {
          patternsReplaced++;
        }
      }

      // Write modified content back to file (unless dry run)
      if (!this.options.dryRun && modifiedContent !== originalContent) {
        // Preserve original file permissions and timestamps
        const stats = await fs.stat(filePath);
        await fs.writeFile(filePath, modifiedContent, 'utf8');
        await fs.chmod(filePath, stats.mode);
      }

      return {
        filePath,
        patternsReplaced,
        originalSize: originalContent.length,
        modifiedSize: modifiedContent.length,
        dryRun: this.options.dryRun
      };
    } catch (error) {
      throw new Error(`Failed to fix file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Apply a single pattern replacement
   * @param {string} content - File content
   * @param {Object} finding - Finding with replacement information
   * @returns {string} Modified content
   */
  applyPatternReplacement(content, finding) {
    try {
      // Use the original pattern if available, otherwise fall back to simple string replacement
      if (finding.pattern) {
        const pattern = new RegExp(finding.pattern, 'g');
        const modifiedContent = content.replace(pattern, finding.replacement);
        return modifiedContent;
      } else {
        // Simple string replacement as fallback
        return content.replace(finding.matchedText, finding.replacement);
      }
    } catch (error) {
      // If regex replacement fails, try simple string replacement
      return content.replace(finding.matchedText, finding.replacement);
    }
  }

  /**
   * Restore files from backup
   * @param {string|Array} filePaths - File path(s) to restore
   * @returns {Promise<Object>} Restore results
   */
  async restoreFromBackup(filePaths) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const results = {
      filesRestored: 0,
      errors: []
    };

    for (const filePath of paths) {
      try {
        const backupPath = this.backupRegistry.get(filePath);
        
        if (!backupPath) {
          throw new Error(`No backup found for ${filePath}`);
        }

        if (!(await fs.pathExists(backupPath))) {
          throw new Error(`Backup file not found: ${backupPath}`);
        }

        // Restore file from backup
        await fs.copy(backupPath, filePath, { overwrite: true });
        results.filesRestored++;
        
        // Remove from fixed files set
        this.fixedFiles.delete(filePath);
        
      } catch (error) {
        results.errors.push({
          filePath,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Rollback all changes made in this session
   * @returns {Promise<Object>} Rollback results
   */
  async rollbackChanges() {
    const filesToRestore = Array.from(this.backupRegistry.keys());
    const results = await this.restoreFromBackup(filesToRestore);
    
    // Clear the registry after rollback
    this.backupRegistry.clear();
    this.fixedFiles.clear();
    
    return results;
  }

  /**
   * Clean up old backup files
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanupOldBackups() {
    const results = {
      filesDeleted: 0,
      errors: []
    };

    try {
      const backupDir = path.resolve(this.options.backupDir);
      
      if (!(await fs.pathExists(backupDir))) {
        return results;
      }

      const files = await fs.readdir(backupDir);
      const now = Date.now();

      for (const file of files) {
        try {
          if (!file.endsWith('.backup')) {
            continue;
          }

          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          const age = now - stats.mtime.getTime();

          if (age > this.options.maxBackupAge) {
            await fs.remove(filePath);
            results.filesDeleted++;
          }
        } catch (error) {
          results.errors.push({
            file,
            error: error.message
          });
        }
      }
    } catch (error) {
      results.errors.push({
        operation: 'cleanup',
        error: error.message
      });
    }

    return results;
  }

  /**
   * Get list of files that have been fixed in this session
   * @returns {Array} Array of fixed file paths
   */
  getFixedFiles() {
    return Array.from(this.fixedFiles);
  }

  /**
   * Get backup information for a file
   * @param {string} filePath - File path to check
   * @returns {Object|null} Backup information or null if no backup exists
   */
  getBackupInfo(filePath) {
    const backupPath = this.backupRegistry.get(filePath);
    
    if (!backupPath) {
      return null;
    }

    return {
      originalFile: filePath,
      backupFile: backupPath,
      hasBackup: true
    };
  }

  /**
   * Check if there's enough disk space for backup operation
   * @param {string} filePath - Original file path
   * @param {string} backupDir - Backup directory path
   * @returns {Promise<void>}
   */
  async checkDiskSpace(filePath, backupDir) {
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      
      // Simple check: ensure backup directory is writable
      // In a production environment, you might want to check actual available space
      await fs.access(backupDir, fs.constants.W_OK);
      
      // For very large files, you might want to implement additional checks
      if (fileSize > 100 * 1024 * 1024) { // 100MB
        console.warn(`Large file detected (${this.formatFileSize(fileSize)}): ${filePath}`);
      }
    } catch (error) {
      throw new Error(`Insufficient disk space or permissions for backup: ${error.message}`);
    }
  }

  /**
   * Group findings by file path
   * @param {Array} findings - Array of findings
   * @returns {Object} Findings grouped by file path
   */
  groupFindingsByFile(findings) {
    const grouped = {};
    
    for (const finding of findings) {
      if (!grouped[finding.filePath]) {
        grouped[finding.filePath] = [];
      }
      grouped[finding.filePath].push(finding);
    }
    
    return grouped;
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
   * Validate that a finding can be fixed
   * @param {Object} finding - Finding to validate
   * @returns {boolean} True if finding can be fixed
   */
  canFix(finding) {
    return finding.fixable && 
           finding.replacement !== null && 
           finding.replacement !== undefined &&
           (finding.matchedText || finding.pattern);
  }
}

module.exports = Fixer;