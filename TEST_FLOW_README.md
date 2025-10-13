# Test Flow Feature - RPA Chrome Extension

## Overview

The Test Flow feature allows you to perform a dry run of your recorded steps with element highlighting and step-by-step validation. This helps you verify that your recorded steps will work correctly before running them with actual data.

## Features

### 🧪 Test Flow Button
- Appears after recording stops (only when steps are available)
- Located in the main control row next to other action buttons
- Initiates the test flow process

### 📋 Step-by-Step Validation
- Shows current step number and total steps
- Displays step description and action type
- Progress bar shows completion percentage

### 🔍 Element Highlighting
- Automatically finds elements using recorded selectors
- Highlights elements with red outline and background
- Scrolls element into view for better visibility
- Shows element details (tag, ID, classes, text content)

### ✏️ Selector Management
- Change selector for any step during testing
- Choose from multiple generated selectors
- Enter custom CSS selectors
- Selector preferences are saved for future use

### ✅ Step Actions
- **Yes, Continue**: Confirm the element is correct and proceed
- **Skip This Step**: Skip the current step and move to next
- **Stop Test**: End the test flow process

## How to Use

### 1. Record Your Flow
1. Click "Start Recording"
2. Perform your actions on the webpage
3. Click "Stop" when finished

### 2. Test Your Flow
1. Click the "🧪 Test Flow" button
2. The test flow modal will open
3. For each step:
   - Review the step description
   - Click "🔍 Highlight Element" to see the target element
   - If the element is correct, click "✅ Yes, Continue"
   - If the element is wrong, click "✏️ Change Selector"
   - If you want to skip this step, click "⏭️ Skip This Step"

### 3. Change Selectors
When you click "✏️ Change Selector":
1. A dialog will show available selectors
2. Choose from the list or enter a custom selector
3. The new selector will be tested immediately
4. If valid, it will be saved as your preference

### 4. Complete the Test
- The test will automatically move through all steps
- You can stop at any time using "🛑 Stop Test"
- At the end, you'll see a summary of confirmed/skipped steps

## Technical Details

### Element Finding Strategy
The test flow uses the same element finding logic as the main player:
1. User-selected selector preference (if available)
2. Original recorded selector
3. Generated fallback selectors based on element signature
4. Multiple attribute combinations
5. SAP UI5 specific selectors

### Selector Types Generated
- **Primary**: Original recorded selector
- **ID**: Element ID selectors with fallbacks
- **Data Test ID**: Most reliable for testing
- **Name**: Form element name attributes
- **Aria Label**: Accessibility labels
- **Placeholder**: Input placeholder text
- **Classes**: CSS class-based selectors
- **Combinations**: Multiple attribute combinations
- **Custom**: User-defined selectors

### Highlighting System
- Red outline (3px solid) around target element
- Light red background overlay
- Smooth scrolling to bring element into view
- Automatic cleanup when moving to next step

### Data Persistence
- Selector preferences are saved in Chrome storage
- Test results are logged to console
- Step confirmations are tracked in memory

## Troubleshooting

### Element Not Found
- Check if the page has loaded completely
- Try refreshing the page and testing again
- Use "Change Selector" to try alternative selectors
- Check if the element is in a different frame

### Highlighting Not Working
- Ensure the element is visible on the page
- Check if the page has restrictive CSS
- Try scrolling to the element manually

### Selector Issues
- Use browser dev tools to inspect the element
- Try simpler selectors (ID, class, tag)
- Check for dynamic content that changes selectors

## Best Practices

1. **Test After Recording**: Always test your flow immediately after recording
2. **Use Stable Selectors**: Prefer ID and data-testid attributes
3. **Avoid Dynamic Content**: Be cautious with elements that change frequently
4. **Test on Different Pages**: Verify selectors work across different page states
5. **Save Good Selectors**: Use the selector change feature to save reliable selectors

## File Structure

- `panel.html`: Test flow modal UI and styles
- `panel.js`: Test flow logic and state management
- `sw.js`: Service worker message handlers
- `enhanced-player.js`: Element finding and highlighting functions
- `test-test-flow.html`: Test page for development

## Future Enhancements

- Visual selector editor
- Bulk selector testing
- Test flow export/import
- Integration with CI/CD pipelines
- Advanced element validation rules
