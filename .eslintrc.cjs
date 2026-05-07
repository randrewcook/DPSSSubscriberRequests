module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
    jest: true
  },
  extends: ['eslint:recommended', 'plugin:node/recommended', 'plugin:security/recommended'],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    'node/no-unpublished-require': 'off',
    'security/detect-object-injection': 'off'
  },
  ignorePatterns: ['node_modules/', 'coverage/']
};
