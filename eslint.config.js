const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['test/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        fetch: 'readonly',
      },
    },
    rules: {
      'arrow-body-style': ['error', 'as-needed'],
      'comma-dangle': ['error', 'always-multiline'],
      eqeqeq: 'error',
    },
  },
];
