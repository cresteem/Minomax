const Sequencer = require("@jest/test-sequencer").default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    const orderedTest = tests.sort((a, b) => {
      // Sort tests alphabetically based on their titles
      const titleA = a.path;
      const titleB = b.path;
      if (titleA < titleB) {
        return -1;
      }
      if (titleA > titleB) {
        return 1;
      }

      return 0;
    });
    return orderedTest;
  }
}

module.exports = CustomSequencer;
