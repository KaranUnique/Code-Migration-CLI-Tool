const fs = require('fs-extra');
const path = require('path');
const ErrorHandler = require('./errorHandler');

/**
 * RuleEngine class handles loading, validating, and applying rules for pattern detection
 */
class RuleEngine {
  constructor(rulesPath = 'rules.json', options = {}) {
    this.rulesPath = rulesPath;
    this.rules = [];
    this.compiledRules = new Map();
    this.errorHandler = options.errorHandler || null;
    this.regexTimeout = options.regexTimeout || 5000; // 5 second timeout
  }

  /**
   * Load and validate rules from the configuration file
   * @returns {Promise<void>}
   */
  async loadRules() {
    try {
      // Check if rules file exists
      if (!(await fs.pathExists(this.rulesPath))) {
        throw new Error(`Rules file not found: ${this.rulesPath}`);
      }

      // Read and parse rules file
      const rulesContent = await fs.readFile(this.rulesPath, 'utf8');
      const rulesConfig = JSON.parse(rulesContent);

      // Validate rules structure
      if (!rulesConfig.rules || !Array.isArray(rulesConfig.rules)) {
        throw new Error('Invalid rules file: missing or invalid "rules" array');
      }

      // Validate and compile each rule
      this.rules = [];
      this.compiledRules.clear();

      for (const rule of rulesConfig.rules) {
        const validatedRule = this.validateRule(rule);
        this.rules.push(validatedRule);
        
        // Compile regex pattern for better performance
        try {
          const compiledPattern = new RegExp(validatedRule.pattern, 'gm');
          this.compiledRules.set(validatedRule.id, compiledPattern);
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.handleInvalidRegexError(validatedRule.id, validatedRule.pattern, error);
            continue; // Skip this rule
          }
          throw new Error(`Invalid regex pattern in rule "${validatedRule.id}": ${error.message}`);
        }
      }

      console.log(`Loaded ${this.rules.length} rules successfully`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Rules file not found: ${this.rulesPath}. Please create a rules.json file.`);
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in rules file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate a single rule object
   * @param {Object} rule - Rule object to validate
   * @returns {Object} Validated rule object
   */
  validateRule(rule) {
    const requiredFields = ['id', 'name', 'description', 'pattern', 'fileTypes', 'severity'];
    
    // Check required fields
    for (const field of requiredFields) {
      if (!rule[field]) {
        throw new Error(`Rule validation failed: missing required field "${field}"`);
      }
    }

    // Validate field types
    if (typeof rule.id !== 'string') {
      throw new Error(`Rule validation failed: "id" must be a string`);
    }
    
    if (typeof rule.name !== 'string') {
      throw new Error(`Rule validation failed: "name" must be a string`);
    }
    
    if (typeof rule.pattern !== 'string') {
      throw new Error(`Rule validation failed: "pattern" must be a string`);
    }
    
    if (!Array.isArray(rule.fileTypes)) {
      throw new Error(`Rule validation failed: "fileTypes" must be an array`);
    }
    
    if (!['error', 'warning', 'info'].includes(rule.severity)) {
      throw new Error(`Rule validation failed: "severity" must be one of: error, warning, info`);
    }

    // Validate replacement field (can be null or string)
    if (rule.replacement !== null && typeof rule.replacement !== 'string') {
      throw new Error(`Rule validation failed: "replacement" must be a string or null`);
    }

    return rule;
  }

  /**
   * Apply rules to file content and return findings
   * @param {string} content - File content to analyze
   * @param {string} filePath - Path to the file being analyzed
   * @param {string} fileExtension - File extension (without dot)
   * @returns {Promise<Array>} Array of findings
   */
  async applyRules(content, filePath, fileExtension) {
    const findings = [];
    const lines = content.split('\n');

    for (const rule of this.rules) {
      // Check if rule applies to this file type
      if (!rule.fileTypes.includes(fileExtension)) {
        continue;
      }

      const compiledPattern = this.compiledRules.get(rule.id);
      if (!compiledPattern) {
        continue;
      }

      // Reset regex state
      compiledPattern.lastIndex = 0;
      
      try {
        // Apply regex with timeout protection
        const ruleFindings = await this.applyRuleWithTimeout(
          compiledPattern, 
          content, 
          rule, 
          filePath
        );
        findings.push(...ruleFindings);
        
      } catch (error) {
        if (this.errorHandler) {
          if (error.message.includes('timed out')) {
            this.errorHandler.handleRegexTimeoutError(rule.id, filePath);
          } else {
            this.errorHandler.handleUnknownError('rule application', error, { 
              ruleId: rule.id, 
              filePath 
            });
          }
        }
        // Continue with other rules even if one fails
        continue;
      }
    }

    return findings;
  }

  /**
   * Get a rule by its ID
   * @param {string} ruleId - Rule ID to find
   * @returns {Object|null} Rule object or null if not found
   */
  getRuleById(ruleId) {
    return this.rules.find(rule => rule.id === ruleId) || null;
  }

  /**
   * Get all loaded rules
   * @returns {Array} Array of all rules
   */
  getAllRules() {
    return [...this.rules];
  }

  /**
   * Apply a single rule with timeout protection
   * @param {RegExp} compiledPattern - Compiled regex pattern
   * @param {string} content - File content
   * @param {Object} rule - Rule object
   * @param {string} filePath - File path for error reporting
   * @returns {Promise<Array>} Array of findings
   */
  async applyRuleWithTimeout(compiledPattern, content, rule, filePath) {
    const findings = [];
    
    const applyRule = () => {
      return new Promise((resolve, reject) => {
        try {
          let match;
          let iterations = 0;
          const maxIterations = 10000; // Prevent infinite loops
          
          while ((match = compiledPattern.exec(content)) !== null) {
            iterations++;
            
            // Safety check for too many iterations
            if (iterations > maxIterations) {
              reject(new Error(`Too many regex matches (${maxIterations}+) - possible infinite loop`));
              return;
            }
            
            // Calculate line and column numbers
            const beforeMatch = content.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length;
            const columnNumber = beforeMatch.length - beforeMatch.lastIndexOf('\n');

            const finding = {
              ruleId: rule.id,
              ruleName: rule.name,
              description: rule.description,
              filePath: filePath,
              lineNumber: lineNumber,
              columnNumber: columnNumber,
              matchedText: match[0],
              severity: rule.severity,
              fixable: rule.replacement !== null,
              replacement: rule.replacement,
              pattern: rule.pattern
            };

            findings.push(finding);

            // Prevent infinite loops with zero-width matches
            if (match[0].length === 0) {
              compiledPattern.lastIndex++;
            }
          }
          
          resolve(findings);
        } catch (error) {
          reject(error);
        }
      });
    };

    // Apply with timeout if error handler is available
    if (this.errorHandler) {
      return await this.errorHandler.withTimeout(
        applyRule, 
        this.regexTimeout, 
        `rule ${rule.id} on ${path.basename(filePath)}`
      );
    } else {
      return await applyRule();
    }
  }

  /**
   * Get rules that apply to a specific file type
   * @param {string} fileExtension - File extension to filter by
   * @returns {Array} Array of applicable rules
   */
  getRulesForFileType(fileExtension) {
    return this.rules.filter(rule => rule.fileTypes.includes(fileExtension));
  }
}

module.exports = RuleEngine;