// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
  {
    files: ['src/app/domain/**/*.ts'],
    rules: {
      // DOMAIN-04: domain/graph/frequency/envelope/patch/DSP logic stays framework-independent.
      // A framework symbol needed here belongs behind an injected boundary under src/app/core/
      // instead. Value and type-only imports are both violations (allowTypeImports: false).
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*', '@angular/*/**'],
              message:
                'DOMAIN-04: domain logic (graph, frequency, envelope, patch, DSP) must stay ' +
                'framework-independent of Angular. Put the Angular dependency behind an ' +
                'injected boundary under src/app/core/ instead of importing it here.',
              allowTypeImports: false,
            },
          ],
        },
      ],
    },
  },
]);
