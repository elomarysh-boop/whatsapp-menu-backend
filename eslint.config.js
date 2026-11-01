export default [
  {
    files: ['**/*.js'],
    ignores: ['node_modules/**', '.wa-auth/**'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['warn', { args: 'none' }],
      'no-console': 'off',
      'no-constant-condition': 'warn'
    }
  }
];
