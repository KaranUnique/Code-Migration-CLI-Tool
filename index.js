#!/usr/bin/env node

const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const path = require('path');
const fs = require('fs-extra');

const Scanner = require('./lib/scanner');
const RuleEngine = require('./lib/ruleEngine');
const Formatter = require('./lib/formatter');
const Fixer = require('./lib/fixer');
const ErrorHandler = require('./lib/errorHandler');

/**
 * Main CLI application class
 */
class CodeMigrationCLI {
  constructor() {
    this.scanner = null;
    this.ruleEngine = null;
    this.formatter = null;
    this.fixer = null;
    this.errorHandler = null;
    this.startTime = null;
  }

  /**
   * Initialize CLI components
   * @param {Object} options - CLI options
   */
  async initialize(options) {
    try {
      // Initialize formatter first for error reporting
      this.formatter = new Formatter({
        colorEnabled: !options.noColor,
        verbose: options.verbose
      });

      // Initialize error handler
      this.errorHandler = new ErrorHandler(this.formatter);

      // Initialize scanner with error handler
      this.scanner = new Scanner({
        maxFileSize: this.parseFileSize(options.maxFileSize),
        ignorePatterns: options.ignore || [],
        supportedExtensions: options.extensions || [],
        errorHandler: this.errorHandler
      });

      // Initialize rule engine with error handler
      this.ruleEngine = new RuleEngine(options.rules, {
        errorHandler: this.errorHandler,
        regexTimeout: options.regexTimeout || 5000
      });
      await this.ruleEngine.loadRules();

      // Initialize fixer if needed
      if (options.fix || options.dryRun) {
        this.fixer = new Fixer({
          backupDir: options.backupDir,
          dryRun: options.dryRun
        });
      }

      console.log(this.formatter.formatInfo(`Initialized with ${this.ruleEngine.getAllRules().length} rules`));
    } catch (error) {
      console.error(this.formatter.formatError(error));
      process.exit(1);
    }
  }

  /**
   * Main scan operation with enhanced workflow orchestration
   * @param {string} targetPath - Directory to scan
   * @param {Object} options - CLI options
   */
  async scan(targetPath, options) {
    this.startTime = Date.now();
    
    try {
      // Phase 1: Discovery and validation
      console.log(this.formatter.formatInfo(`🔍 Starting code migration scan...`));
      console.log(this.formatter.formatInfo(`Target directory: ${targetPath}`));
      
      const discoveryResult = await this.discoverFiles(targetPath, options);
      if (discoveryResult.files.length === 0) {
        console.log(this.formatter.formatWarning('No files found to scan'));
        return { filesScanned: 0, issuesFound: 0, phase: 'discovery' };
      }

      // Phase 2: Analysis
      console.log(this.formatter.formatInfo(`📋 Analyzing ${discoveryResult.files.length} files...`));
      const analysisResult = await this.analyzeFiles(discoveryResult.files, targetPath, options);

      // Phase 3: Reporting
      console.log(this.formatter.formatInfo(`📊 Generating report...`));
      this.displayAnalysisResults(analysisResult, targetPath, options);

      // Phase 4: Fixing (if requested)
      let fixResults = null;
      if (options.fix || options.dryRun) {
        console.log(this.formatter.formatInfo(`🔧 ${options.dryRun ? 'Simulating' : 'Applying'} fixes...`));
        fixResults = await this.applyFixes(analysisResult.findings, options);
      }

      // Phase 5: Final summary
      const scanTime = Date.now() - this.startTime;
      const statistics = this.calculateStatistics(
        analysisResult.findings, 
        analysisResult.filesProcessed, 
        scanTime, 
        fixResults
      );
      
      // Add error summary to statistics
      const errorSummary = this.errorHandler.getErrorSummary();
      statistics.errorSummary = errorSummary;
      
      console.log(this.formatter.formatSummary(statistics));
      
      // Display error summary if there were errors
      if (errorSummary.hasErrors) {
        console.log(this.formatter.formatInfo('\n🚨 Error Summary:'));
        Object.entries(errorSummary.byType).forEach(([type, count]) => {
          if (count > 0) {
            console.log(`  ${type}: ${count} error${count === 1 ? '' : 's'}`);
          }
        });
        
        if (errorSummary.hasCriticalErrors) {
          console.log(this.formatter.formatWarning(
            'Critical errors detected. Some rules or files may have been skipped.'
          ));
        }
      }
      
      // Set exit code based on findings and errors
      if (statistics.errorCount > 0 || errorSummary.hasCriticalErrors) {
        process.exitCode = 1;
      } else if (statistics.warningCount > 0 || errorSummary.hasErrors) {
        process.exitCode = 0; // Warnings and non-critical errors don't cause failure
      }

      return statistics;

    } catch (error) {
      await this.handleCriticalError(error, options);
      throw error;
    }
  }

  /**
   * Phase 1: Discover and validate files
   * @param {string} targetPath - Directory to scan
   * @param {Object} options - CLI options
   * @returns {Promise<Object>} Discovery results
   */
  async discoverFiles(targetPath, options) {
    try {
      const startTime = Date.now();
      
      // Validate target directory
      if (!(await fs.pathExists(targetPath))) {
        throw new Error(`Target directory does not exist: ${targetPath}`);
      }

      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        throw new Error(`Target path is not a directory: ${targetPath}`);
      }

      // Discover files with progress reporting
      const files = await this.scanner.scanDirectory(targetPath, {
        extensions: options.extensions
      });

      const discoveryTime = Date.now() - startTime;
      
      console.log(this.formatter.formatSuccess(
        `Found ${files.length} files in ${this.formatter.formatDuration(discoveryTime)}`
      ));

      if (options.verbose) {
        const extensionCounts = this.groupFilesByExtension(files);
        console.log(this.formatter.formatInfo('File breakdown:'));
        Object.entries(extensionCounts).forEach(([ext, count]) => {
          console.log(`  ${ext}: ${count} file${count === 1 ? '' : 's'}`);
        });
      }

      return {
        files,
        discoveryTime,
        targetPath: path.resolve(targetPath)
      };

    } catch (error) {
      throw new Error(`File discovery failed: ${error.message}`);
    }
  }

  /**
   * Phase 2: Analyze files for issues
   * @param {Array} files - Files to analyze
   * @param {string} targetPath - Base directory path
   * @param {Object} options - CLI options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeFiles(files, targetPath, options) {
    const allFindings = [];
    const errors = [];
    let filesProcessed = 0;
    let totalBytes = 0;
    
    const startTime = Date.now();
    const progressInterval = Math.max(1, Math.floor(files.length / 20)); // Update progress every 5%

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      
      try {
        // Show progress for large scans
        if (options.verbose || (i + 1) % progressInterval === 0 || i === files.length - 1) {
          const relativePath = path.relative(targetPath, filePath);
          const progressMsg = options.verbose 
            ? `Scanning: ${relativePath}`
            : 'Scanning files';
          
          console.log(this.formatter.formatProgress(progressMsg, i + 1, files.length));
        }

        // Read and analyze file
        const content = await this.scanner.readFile(filePath);
        const fileExtension = this.scanner.getFileExtension(filePath);
        const findings = await this.ruleEngine.applyRules(content, filePath, fileExtension);
        
        allFindings.push(...findings);
        filesProcessed++;
        totalBytes += content.length;

        // Memory management for large scans
        if (filesProcessed % 100 === 0) {
          // Force garbage collection hint
          if (global.gc) {
            global.gc();
          }
        }

      } catch (error) {
        const errorInfo = {
          filePath,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        errors.push(errorInfo);
        
        if (options.verbose) {
          console.warn(this.formatter.formatWarning(`Failed to scan ${filePath}: ${error.message}`));
        }
      }
    }

    const analysisTime = Date.now() - startTime;

    return {
      findings: allFindings,
      filesProcessed,
      errors,
      analysisTime,
      totalBytes,
      averageFileSize: filesProcessed > 0 ? Math.round(totalBytes / filesProcessed) : 0
    };
  }

  /**
   * Phase 3: Display analysis results
   * @param {Object} analysisResult - Analysis results
   * @param {string} targetPath - Base directory path
   * @param {Object} options - CLI options
   */
  displayAnalysisResults(analysisResult, targetPath, options) {
    const { findings, errors, analysisTime, filesProcessed } = analysisResult;

    // Show scan completion
    console.log(this.formatter.formatSuccess(
      `Analyzed ${filesProcessed} files in ${this.formatter.formatDuration(analysisTime)}`
    ));

    // Show errors if any
    if (errors.length > 0) {
      console.log(this.formatter.formatWarning(`${errors.length} files could not be scanned:`));
      errors.slice(0, 5).forEach(error => { // Show first 5 errors
        const relativePath = path.relative(targetPath, error.filePath);
        console.log(`  ${relativePath}: ${error.error}`);
      });
      
      if (errors.length > 5) {
        console.log(`  ... and ${errors.length - 5} more errors`);
      }
    }

    // Display findings
    if (findings.length > 0) {
      console.log(this.formatter.formatFindings(findings, targetPath));
      
      // Show rule breakdown if verbose
      if (options.verbose) {
        const ruleBreakdown = this.groupFindingsByRule(findings);
        console.log(this.formatter.formatInfo('\nRule breakdown:'));
        Object.entries(ruleBreakdown)
          .sort(([,a], [,b]) => b.length - a.length)
          .slice(0, 10) // Top 10 rules
          .forEach(([ruleId, ruleFindings]) => {
            console.log(`  ${ruleId}: ${ruleFindings.length} issue${ruleFindings.length === 1 ? '' : 's'}`);
          });
      }
    } else {
      console.log(this.formatter.formatSuccess('🎉 No issues found!'));
    }
  }

  /**
   * Apply fixes to found issues
   * @param {Array} findings - Array of findings
   * @param {Object} options - CLI options
   */
  async applyFixes(findings, options) {
    const fixableFindings = findings.filter(f => f.fixable);
    
    if (fixableFindings.length === 0) {
      console.log(this.formatter.formatInfo('No fixable issues found'));
      return null;
    }

    if (options.dryRun) {
      console.log(this.formatter.formatInfo(`Dry run: Would fix ${fixableFindings.length} issues`));
    } else {
      console.log(this.formatter.formatInfo(`Fixing ${fixableFindings.length} issues...`));
      
      // Confirm before applying fixes (unless --yes flag is used)
      if (!options.yes && !await this.confirmFixes(fixableFindings)) {
        console.log(this.formatter.formatInfo('Fix operation cancelled'));
        return null;
      }
    }

    try {
      const fixResults = await this.fixer.applyFixes(fixableFindings, {
        backupBeforeFix: !options.noBackup,
        continueOnError: true
      });

      if (options.dryRun) {
        console.log(this.formatter.formatSuccess(`Dry run completed: ${fixResults.patternsReplaced} patterns would be replaced`));
      } else {
        console.log(this.formatter.formatSuccess(`Fixed ${fixResults.filesFixed} files, replaced ${fixResults.patternsReplaced} patterns`));
        
        if (fixResults.backupsCreated.length > 0) {
          console.log(this.formatter.formatInfo(`Created ${fixResults.backupsCreated.length} backup files`));
        }
      }

      if (fixResults.errors.length > 0) {
        console.log(this.formatter.formatWarning(`${fixResults.errors.length} files could not be fixed:`));
        fixResults.errors.forEach(error => {
          console.log(`  ${this.formatter.formatError(new Error(`${error.filePath}: ${error.error}`))}`);
        });
      }

      return fixResults;

    } catch (error) {
      console.error(this.formatter.formatError(error));
      
      // Attempt rollback if fixes were partially applied
      if (this.fixer && this.fixer.getFixedFiles().length > 0) {
        console.log(this.formatter.formatWarning('Attempting to rollback changes...'));
        try {
          await this.fixer.rollbackChanges();
          console.log(this.formatter.formatSuccess('Successfully rolled back changes'));
        } catch (rollbackError) {
          console.error(this.formatter.formatError(rollbackError));
        }
      }
      
      throw error;
    }
  }

  /**
   * Confirm fixes with user
   * @param {Array} fixableFindings - Fixable findings
   * @returns {Promise<boolean>} User confirmation
   */
  async confirmFixes(fixableFindings) {
    // Group by file for display
    const fileGroups = {};
    fixableFindings.forEach(finding => {
      if (!fileGroups[finding.filePath]) {
        fileGroups[finding.filePath] = [];
      }
      fileGroups[finding.filePath].push(finding);
    });

    console.log(this.formatter.formatInfo(`About to fix ${fixableFindings.length} issues in ${Object.keys(fileGroups).length} files:`));
    
    // Show summary of what will be fixed
    Object.entries(fileGroups).forEach(([filePath, findings]) => {
      const relativePath = path.basename(filePath);
      console.log(`  ${relativePath}: ${findings.length} issue${findings.length === 1 ? '' : 's'}`);
    });

    // In a real CLI, you'd use a proper prompt library like inquirer
    // For this implementation, we'll assume --yes flag or return true
    return true;
  }

  /**
   * Calculate scan statistics
   * @param {Array} findings - All findings
   * @param {number} filesScanned - Number of files scanned
   * @param {number} scanTime - Scan duration in milliseconds
   * @param {Object} fixResults - Fix results if fixes were applied
   * @returns {Object} Statistics object
   */
  calculateStatistics(findings, filesScanned, scanTime, fixResults = null) {
    const stats = {
      filesScanned,
      issuesFound: findings.length,
      errorCount: findings.filter(f => f.severity === 'error').length,
      warningCount: findings.filter(f => f.severity === 'warning').length,
      infoCount: findings.filter(f => f.severity === 'info').length,
      fixableCount: findings.filter(f => f.fixable).length,
      scanTime
    };

    if (fixResults) {
      stats.filesFixed = fixResults.filesFixed;
      stats.patternsReplaced = fixResults.patternsReplaced;
    }

    return stats;
  }

  /**
   * Parse file size string to bytes
   * @param {string} sizeStr - Size string like "1MB", "500KB"
   * @returns {number} Size in bytes
   */
  parseFileSize(sizeStr) {
    if (!sizeStr) return 1024 * 1024; // Default 1MB

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
    if (!match) return 1024 * 1024;

    const size = parseFloat(match[1]);
    const unit = (match[2] || 'B').toUpperCase();

    const multipliers = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024
    };

    return Math.floor(size * (multipliers[unit] || 1));
  }

  /**
   * Handle critical errors with cleanup and recovery
   * @param {Error} error - The error that occurred
   * @param {Object} options - CLI options
   */
  async handleCriticalError(error, options) {
    console.error(this.formatter.formatError(error));
    
    // Attempt cleanup if fixer was used
    if (this.fixer && this.fixer.getFixedFiles().length > 0) {
      console.log(this.formatter.formatWarning('Attempting to rollback any changes made...'));
      try {
        const rollbackResult = await this.fixer.rollbackChanges();
        if (rollbackResult.filesRestored > 0) {
          console.log(this.formatter.formatSuccess(`Rolled back ${rollbackResult.filesRestored} files`));
        }
      } catch (rollbackError) {
        console.error(this.formatter.formatError(new Error(`Rollback failed: ${rollbackError.message}`)));
      }
    }

    // Log error details in verbose mode
    if (options.verbose && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    // Suggest recovery actions
    console.log(this.formatter.formatInfo('\nSuggested actions:'));
    console.log('  • Check that the target directory exists and is readable');
    console.log('  • Verify that the rules file is valid JSON');
    console.log('  • Try running with --verbose for more details');
    console.log('  • Check file permissions in the target directory');
  }

  /**
   * Group files by extension for reporting
   * @param {Array} files - Array of file paths
   * @returns {Object} Files grouped by extension
   */
  groupFilesByExtension(files) {
    const groups = {};
    files.forEach(filePath => {
      const ext = this.scanner.getFileExtension(filePath) || 'no-extension';
      groups[ext] = (groups[ext] || 0) + 1;
    });
    return groups;
  }

  /**
   * Group findings by rule for analysis
   * @param {Array} findings - Array of findings
   * @returns {Object} Findings grouped by rule ID
   */
  groupFindingsByRule(findings) {
    const groups = {};
    findings.forEach(finding => {
      if (!groups[finding.ruleId]) {
        groups[finding.ruleId] = [];
      }
      groups[finding.ruleId].push(finding);
    });
    return groups;
  }
}

/**
 * Configure CLI arguments using yargs
 */
function configureYargs() {
  return yargs(hideBin(process.argv))
    .scriptName('code-migrate')
    .usage('Usage: $0 <directory> [options]')
    .command(
      '$0 <directory>',
      'Scan directory for deprecated API usages and syntax patterns',
      (yargs) => {
        yargs.positional('directory', {
          describe: 'Directory to scan for code issues',
          type: 'string',
          normalize: true
        });
      },
      async (argv) => {
        const cli = new CodeMigrationCLI();
        await cli.initialize(argv);
        await cli.scan(argv.directory, argv);
      }
    )
    .option('rules', {
      alias: 'r',
      describe: 'Path to rules configuration file',
      type: 'string',
      default: 'rules.json'
    })
    .option('fix', {
      alias: 'f',
      describe: 'Automatically fix issues where possible',
      type: 'boolean',
      default: false
    })
    .option('dry-run', {
      alias: 'd',
      describe: 'Show what would be fixed without making changes',
      type: 'boolean',
      default: false
    })
    .option('verbose', {
      alias: 'v',
      describe: 'Show detailed output',
      type: 'boolean',
      default: false
    })
    .option('no-color', {
      describe: 'Disable colored output',
      type: 'boolean',
      default: false
    })
    .option('extensions', {
      alias: 'e',
      describe: 'File extensions to scan (comma-separated)',
      type: 'string',
      coerce: (arg) => arg ? arg.split(',').map(ext => ext.trim()) : undefined
    })
    .option('ignore', {
      alias: 'i',
      describe: 'Patterns to ignore (can be used multiple times)',
      type: 'array',
      default: []
    })
    .option('max-file-size', {
      describe: 'Maximum file size to process (e.g., 1MB, 500KB)',
      type: 'string',
      default: '1MB'
    })
    .option('backup-dir', {
      describe: 'Directory for backup files',
      type: 'string',
      default: '.code-migration-backups'
    })
    .option('no-backup', {
      describe: 'Skip creating backup files when fixing',
      type: 'boolean',
      default: false
    })
    .option('yes', {
      alias: 'y',
      describe: 'Automatically confirm all prompts',
      type: 'boolean',
      default: false
    })
    .option('regex-timeout', {
      describe: 'Timeout for regex operations in milliseconds',
      type: 'number',
      default: 5000
    })
    .example('$0 ./src', 'Scan the src directory for issues')
    .example('$0 ./src --fix', 'Scan and automatically fix issues')
    .example('$0 ./src --dry-run', 'Show what would be fixed without making changes')
    .example('$0 ./src --extensions js,ts', 'Only scan JavaScript and TypeScript files')
    .example('$0 ./src --ignore "*.min.js" --ignore "dist/**"', 'Ignore minified files and dist directory')
    .help('h')
    .alias('h', 'help')
    .version()
    .alias('version', 'V')
    .wrap(Math.min(120, yargs.terminalWidth()))
    .strict()
    .fail((msg, err, yargs) => {
      if (err) {
        console.error('Error:', err.message);
      } else {
        console.error('Error:', msg);
        console.error('\n' + yargs.help());
      }
      process.exit(1);
    });
}

/**
 * Main entry point
 */
async function main() {
  try {
    const argv = configureYargs();
    await argv.parse();
  } catch (error) {
    console.error('Unexpected error:', error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { CodeMigrationCLI, configureYargs };