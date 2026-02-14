const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    setupFiles: ['./tests/setup.js'],
    testTimeout: 10000,
  },
});
