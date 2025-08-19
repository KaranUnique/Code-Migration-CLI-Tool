const fs = require('fs-extra');
const path = require('path');
const RuleEngine = require('../lib/ruleEngine');

describe('RuleEngine', () => {
  let tempDir;
  let ruleEngine;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
    ruleEngine = new RuleEngine();
  });

  afterEach(async () => {
    // Clean up temporary files
    await fs.remove(tempDir);
  });

  describe('loadRules', () => {
    test('should load valid rules file successfully', async () => {
      const validRules = {
        rules: [
          {
            id: 'test-rule',
            name: 'Test Rule',
            description: 'A test rule',
            pattern: 'test',
            replacement: 'TEST',
            fileTypes: ['js'],
            severity: 'warning'
          }
        ]
      };

      const rulesPath = path.join(tempDir, 'rules.json');
      await fs.writeFile(rulesPath, JSON.stringify(validRules));
      
      ruleEngine = new RuleEngine(rulesPath);
      await ruleEngine.loadRules();

      expect(ruleEngine.getAllRules()).toHaveLength(1);
      expect(ruleEngine.getRuleById('test-rule')).toBeTruthy();
    });

    test('should throw error for missing rules file', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.json');
      ruleEngine = new RuleEngine(nonExistentPath);

      await expect(ruleEngine.loadRules()).rejects.toThrow('Rules file not found');
    });

    test('should throw error for invalid JSON', async () => {
      const rulesPath = path.join(tempDir, 'invalid.json');
      await fs.writeFile(rulesPath, 'invalid json content');
      
      ruleEngine = new RuleEngine(rulesPath);
      await expect(ruleEngine.loadRules()).rejects.toThrow('Invalid JSON');
    });

    test('should throw error for missing rules array', async () => {
      const invalidRules = { notRules: [] };
      const rulesPath = path.join(tempDir, 'rules.json');
      await fs.writeFile(rulesPath, JSON.stringify(invalidRules));
      
      ruleEngine = new RuleEngine(rulesPath);
      await expect(ruleEngine.loadRules()).rejects.toThrow('missing or invalid "rules" array');
    });
  });

  describe('validateRule', () => {
    test('should validate correct rule', () => {
      const validRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        pattern: 'test',
        replacement: 'TEST',
        fileTypes: ['js'],
        severity: 'warning'
      };

      expect(() => ruleEngine.validateRule(validRule)).not.toThrow();
    });

    test('should throw error for missing required fields', () => {
      const incompleteRule = {
        id: 'test-rule',
        name: 'Test Rule'
        // missing other required fields
      };

      expect(() => ruleEngine.validateRule(incompleteRule)).toThrow('missing required field');
    });

    test('should throw error for invalid severity', () => {
      const invalidRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        pattern: 'test',
        replacement: 'TEST',
        fileTypes: ['js'],
        severity: 'invalid-severity'
      };

      expect(() => ruleEngine.validateRule(invalidRule)).toThrow('severity" must be one of');
    });

    test('should allow null replacement', () => {
      const ruleWithNullReplacement = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        pattern: 'test',
        replacement: null,
        fileTypes: ['js'],
        severity: 'info'
      };

      expect(() => ruleEngine.validateRule(ruleWithNullReplacement)).not.toThrow();
    });
  });

  describe('applyRules', () => {
    beforeEach(async () => {
      const testRules = {
        rules: [
          {
            id: 'var-to-const',
            name: 'Replace var with const',
            description: 'Replace var declarations',
            pattern: '\\bvar\\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=',
            replacement: 'const $1 =',
            fileTypes: ['js'],
            severity: 'warning'
          },
          {
            id: 'console-log',
            name: 'Console log detection',
            description: 'Find console.log statements',
            pattern: 'console\\.log\\s*\\(',
            replacement: null,
            fileTypes: ['js'],
            severity: 'info'
          }
        ]
      };

      const rulesPath = path.join(tempDir, 'rules.json');
      await fs.writeFile(rulesPath, JSON.stringify(testRules));
      
      ruleEngine = new RuleEngine(rulesPath);
      await ruleEngine.loadRules();
    });

    test('should find patterns in JavaScript code', async () => {
      const jsCode = `var name = 'test';
console.log('hello');
var count = 0;`;

      const findings = await ruleEngine.applyRules(jsCode, 'test.js', 'js');
      
      expect(findings).toHaveLength(3); // 2 var declarations + 1 console.log
      expect(findings[0].ruleId).toBe('var-to-const');
      expect(findings[0].lineNumber).toBe(1);
      expect(findings[1].ruleId).toBe('console-log');
      expect(findings[2].ruleId).toBe('var-to-const');
    });

    test('should not apply rules to non-matching file types', async () => {
      const pythonCode = 'var name = "test"';
      const findings = await ruleEngine.applyRules(pythonCode, 'test.py', 'py');
      
      expect(findings).toHaveLength(0);
    });

    test('should calculate correct line and column numbers', async () => {
      const multiLineCode = `function test() {
  var x = 1;
  return x;
}`;

      const findings = await ruleEngine.applyRules(multiLineCode, 'test.js', 'js');
      
      expect(findings).toHaveLength(1);
      expect(findings[0].lineNumber).toBe(2);
      expect(findings[0].columnNumber).toBeGreaterThan(0);
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      const testRules = {
        rules: [
          {
            id: 'js-rule',
            name: 'JS Rule',
            description: 'JavaScript rule',
            pattern: 'test',
            replacement: 'TEST',
            fileTypes: ['js'],
            severity: 'warning'
          },
          {
            id: 'py-rule',
            name: 'Python Rule',
            description: 'Python rule',
            pattern: 'test',
            replacement: 'TEST',
            fileTypes: ['py'],
            severity: 'error'
          }
        ]
      };

      const rulesPath = path.join(tempDir, 'rules.json');
      await fs.writeFile(rulesPath, JSON.stringify(testRules));
      
      ruleEngine = new RuleEngine(rulesPath);
      await ruleEngine.loadRules();
    });

    test('should get rules for specific file type', () => {
      const jsRules = ruleEngine.getRulesForFileType('js');
      const pyRules = ruleEngine.getRulesForFileType('py');
      
      expect(jsRules).toHaveLength(1);
      expect(jsRules[0].id).toBe('js-rule');
      expect(pyRules).toHaveLength(1);
      expect(pyRules[0].id).toBe('py-rule');
    });

    test('should get all rules', () => {
      const allRules = ruleEngine.getAllRules();
      expect(allRules).toHaveLength(2);
    });
  });
});