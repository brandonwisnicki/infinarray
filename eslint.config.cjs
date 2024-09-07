const shopifyEslintPlugin = require('@shopify/eslint-plugin');

module.exports = [
  {
    ignores: ['dist/*', 'test/data/*'],
  },
  ...shopifyEslintPlugin.configs.esnext,
  ...shopifyEslintPlugin.configs.typescript,
  ...shopifyEslintPlugin.configs.node,

  {
    rules: {
      '@typescript-eslint/prefer-for-of': 'off',
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
        },
      ],
      'import/order': [
        'error',
        {
          alphabetize: {
            order:
              'asc' /* sort in ascending order. Options: ['ignore', 'asc', 'desc'] */,
            caseInsensitive: true /* ignore case. Options: [true, false] */,
          },
        },
      ],
      // This doesn't work too nicely with monorepo
      'import/no-extraneous-dependencies': ['off'],
    },
  },
  ...shopifyEslintPlugin.configs.prettier,
];
