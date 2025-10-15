// Preloaded Flows Data
// This file contains predefined flows with their steps and CSV templates

const PRELOADED_FLOWS = {
  'pathway-creator': {
    id: 'pathway-creator',
    name: 'Create pathways',
    description: 'Automatically create pathways based on CSV data. download template and reupload to proceed.',
    category: 'Forms',
    version: '1.0',
    steps: [
      {
        type: 'navigate_url',
        url: '{url}',
        column: 'url',
        timestamp: Date.now(),
        id: 'nav-1'
      },
      {
        type: 'input',
        target: { css: 'input[name="name"], input[placeholder*="name"], input[id*="name"]' },
        originalTextSample: '{name}',
        placeholderKey: 'name',
        timestamp: Date.now(),
        id: 'input-1'
      },
      {
        type: 'input',
        target: { css: 'input[name="email"], input[type="email"], input[placeholder*="email"]' },
        originalTextSample: '{email}',
        placeholderKey: 'email',
        timestamp: Date.now(),
        id: 'input-2'
      },
      {
        type: 'input',
        target: { css: 'input[name="phone"], input[placeholder*="phone"], input[type="tel"]' },
        originalTextSample: '{phone}',
        placeholderKey: 'phone',
        timestamp: Date.now(),
        id: 'input-3'
      },
      {
        type: 'click',
        target: { css: 'button[type="submit"], input[type="submit"], .submit-btn' },
        timestamp: Date.now(),
        id: 'click-1'
      }
    ],
    csvTemplate: [
      {
        Title: "Test 1",
        Description: "Test",
        Collaborator: "naresh.jangir@capgemini.com",
        Thumbnail: "",
        Skills: "Skill 2",
        Link: ""
      },
      {
        Title: "Test 2",
        Description: "Test",
        Collaborator: "naresh.jangir@capgemini.com",
        Thumbnail: "", 
        Skills: "Skill 2",
        Link: ""
      }
    ],
    instructions: 'Replace the sample data with your actual form URLs and contact information. Each row represents one form submission.'
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PRELOADED_FLOWS;
} else if (typeof window !== 'undefined') {
  window.PRELOADED_FLOWS = PRELOADED_FLOWS;
}

