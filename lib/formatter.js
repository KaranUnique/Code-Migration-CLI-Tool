const chalk = require('chalk');
const path = require('path');

/**
 * Formatter class handles colored terminal output for scan results and reports
 */
class Formatter {
  constructor(options = {}) {
    this.options = {
      colorEnabled: options.colorEnabled !== false, // Enable colors by default
      verbose: options.verbose || false,
      maxLineLength: options.maxLineLength || 120,
      ...options
    };

    // Configure chalk based on color support
    if (!this.options.colorEnabled) {
      chalk.level = 0; // Disable colors
    }

    // Define color schemes for different severity levels
    this.severityColors = {
      error: chalk.red,
      warning: chalk.yellow,
      info: chalk.blue
    };

    this.severityIcons = {
      error: '✖',
      warning: '⚠',
      info: 'ℹ'
    };
  }

  /**
   * Format a single finding with colors and proper layout
   * @param {Object} finding - Finding object from rule engine
   * @param {string} basePath - Base path for relative file paths
   * @returns {string} Formatted finding string
   */
  formatFinding(finding, basePath = '') {
    const colorFn = this.severityColors[finding.severity] || chalk.white;
    const icon = this.severityIcons[finding.severity] || '•';
    
    // Get relative path for cleaner display
    const relativePath = basePath ? path.relative(basePath, finding.filePath) : finding.filePath;
    
    // Format file location
    const location = chalk.dim(`${relativePath}:${finding.lineNumber}:${finding.columnNumber}`);
    
    // Format rule information
    const ruleInfo = chalk.dim(`[${finding.ruleId}]`);
    
    // Format the main message
    const message = `${colorFn(icon)} ${finding.ruleName}`;
    
    // Format matched text (truncate if too long)
    let matchedText = finding.matchedText.replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    if (matchedText.length > 50) {
      matchedText = matchedText.substring(0, 47) + '...';
    }
    const matchInfo = chalk.gray(`"${matchedText}"`);
    
    // Build the formatted line
    let formattedLine = `  ${message} ${location}`;
    
    if (this.options.verbose) {
      formattedLine += `\n    ${chalk.dim('Description:')} ${finding.description}`;
      formattedLine += `\n    ${chalk.dim('Matched:')} ${matchInfo}`;
      if (finding.fixable) {
        formattedLine += `\n    ${chalk.green('✓ Fixable')}`;
      }
      formattedLine += ` ${ruleInfo}`;
    } else {
      formattedLine += ` ${matchInfo} ${ruleInfo}`;
    }

    return formattedLine;
  }

  /**
   * Format multiple findings grouped by file
   * @param {Array} findings - Array of finding objects
   * @param {string} basePath - Base path for relative file paths
   * @returns {string} Formatted findings string
   */
  formatFindings(findings, basePath = '') {
    if (!findings || findings.length === 0) {
      return chalk.green('✓ No issues found!');
    }

    // Group findings by file
    const findingsByFile = this.groupFindingsByFile(findings);
    
    let output = '';
    const fileCount = Object.keys(findingsByFile).length;
    
    // Add header
    output += chalk.bold(`\nFound ${findings.length} issue${findings.length === 1 ? '' : 's'} in ${fileCount} file${fileCount === 1 ? '' : 's'}:\n\n`);
    
    // Format each file's findings
    for (const [filePath, fileFindings] of Object.entries(findingsByFile)) {
      const relativePath = basePath ? path.relative(basePath, filePath) : filePath;
      
      // File header
      output += chalk.bold.underline(relativePath) + '\n';
      
      // Sort findings by line number
      fileFindings.sort((a, b) => a.lineNumber - b.lineNumber);
      
      // Format each finding
      for (const finding of fileFindings) {
        output += this.formatFinding(finding, basePath) + '\n';
      }
      
      output += '\n';
    }

    return output;
  }

  /**
   * Format summary statistics
   * @param {Object} statistics - Statistics object
   * @returns {string} Formatted summary string
   */
  formatSummary(statistics) {
    const {
      filesScanned = 0,
      issuesFound = 0,
      errorCount = 0,
      warningCount = 0,
      infoCount = 0,
      fixableCount = 0,
      scanTime = 0,
      filesFixed = 0,
      patternsReplaced = 0
    } = statistics;

    let summary = chalk.bold('\n📊 Summary:\n');
    summary += chalk.dim('─'.repeat(50)) + '\n';
    
    // Scan statistics
    summary += `${chalk.blue('Files scanned:')} ${filesScanned}\n`;
    summary += `${chalk.blue('Scan time:')} ${this.formatDuration(scanTime)}\n`;
    
    // Issue breakdown
    if (issuesFound > 0) {
      summary += `${chalk.red('Total issues:')} ${issuesFound}\n`;
      
      if (errorCount > 0) {
        summary += `  ${chalk.red('✖ Errors:')} ${errorCount}\n`;
      }
      if (warningCount > 0) {
        summary += `  ${chalk.yellow('⚠ Warnings:')} ${warningCount}\n`;
      }
      if (infoCount > 0) {
        summary += `  ${chalk.blue('ℹ Info:')} ${infoCount}\n`;
      }
      
      if (fixableCount > 0) {
        summary += `${chalk.green('Fixable issues:')} ${fixableCount}\n`;
      }
    } else {
      summary += `${chalk.green('✓ No issues found!')}\n`;
    }
    
    // Fix statistics (if fixes were applied)
    if (filesFixed > 0) {
      summary += chalk.dim('─'.repeat(50)) + '\n';
      summary += `${chalk.green('Files fixed:')} ${filesFixed}\n`;
      summary += `${chalk.green('Patterns replaced:')} ${patternsReplaced}\n`;
    }
    
    return summary;
  }

  /**
   * Format error messages
   * @param {Error} error - Error object
   * @returns {string} Formatted error string
   */
  formatError(error) {
    return chalk.red(`✖ Error: ${error.message}`);
  }

  /**
   * Format warning messages
   * @param {string} message - Warning message
   * @returns {string} Formatted warning string
   */
  formatWarning(message) {
    return chalk.yellow(`⚠ Warning: ${message}`);
  }

  /**
   * Format info messages
   * @param {string} message - Info message
   * @returns {string} Formatted info string
   */
  formatInfo(message) {
    return chalk.blue(`ℹ ${message}`);
  }

  /**
   * Format success messages
   * @param {string} message - Success message
   * @returns {string} Formatted success string
   */
  formatSuccess(message) {
    return chalk.green(`✓ ${message}`);
  }

  /**
   * Format progress messages
   * @param {string} message - Progress message
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @returns {string} Formatted progress string
   */
  formatProgress(message, current, total) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    const progressBar = this.createProgressBar(current, total, 20);
    
    return `${chalk.blue('⏳')} ${message} ${progressBar} ${percentage}% (${current}/${total})`;
  }

  /**
   * Create a simple progress bar
   * @param {number} current - Current progress
   * @param {number} total - Total items
   * @param {number} width - Progress bar width
   * @returns {string} Progress bar string
   */
  createProgressBar(current, total, width = 20) {
    if (total === 0) return '█'.repeat(width);
    
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    
    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
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
   * Format duration in human-readable format
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(milliseconds) {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    } else if (milliseconds < 60000) {
      return `${(milliseconds / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
      return `${minutes}m ${seconds}s`;
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
   * Create a table-like output for structured data
   * @param {Array} data - Array of objects to display
   * @param {Array} columns - Column definitions
   * @returns {string} Formatted table string
   */
  formatTable(data, columns) {
    if (!data || data.length === 0) {
      return chalk.dim('No data to display');
    }

    // Calculate column widths
    const widths = columns.map(col => {
      const headerWidth = col.header.length;
      const dataWidth = Math.max(...data.map(row => String(row[col.key] || '').length));
      return Math.max(headerWidth, dataWidth);
    });

    let table = '';
    
    // Header
    const headerRow = columns.map((col, i) => 
      chalk.bold(col.header.padEnd(widths[i]))
    ).join(' │ ');
    table += headerRow + '\n';
    
    // Separator
    const separator = widths.map(width => '─'.repeat(width)).join('─┼─');
    table += chalk.dim(separator) + '\n';
    
    // Data rows
    for (const row of data) {
      const dataRow = columns.map((col, i) => {
        const value = String(row[col.key] || '');
        const colorFn = col.color || (x => x);
        return colorFn(value.padEnd(widths[i]));
      }).join(' │ ');
      table += dataRow + '\n';
    }
    
    return table;
  }

  /**
   * Format help text with proper styling
   * @param {string} title - Help section title
   * @param {Array} items - Help items
   * @returns {string} Formatted help string
   */
  formatHelp(title, items) {
    let help = chalk.bold.blue(title) + '\n';
    
    for (const item of items) {
      if (typeof item === 'string') {
        help += `  ${item}\n`;
      } else {
        const command = chalk.green(item.command || '');
        const description = chalk.dim(item.description || '');
        help += `  ${command.padEnd(30)} ${description}\n`;
      }
    }
    
    return help;
  }
}

module.exports = Formatter;