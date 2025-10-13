# Dataset Header Buttons Feature

## Overview

This feature adds interactive buttons for dataset headers/keys that allow users to easily paste first row values into browser input fields during recording. The buttons support both click-to-paste and drag-and-drop functionality.

## Features

### 🎯 **Click-to-Paste Functionality**
- Click any dataset button to paste the corresponding first row value into the currently focused input field
- Automatic fallback to clipboard if no input field is focused
- Visual feedback with success/error messages

### 🖱️ **Drag-and-Drop Functionality**
- Drag dataset buttons onto any input field to paste values
- Visual highlighting of input fields during drag operations
- Support for all input types: text, email, textarea, contenteditable, etc.

### 📊 **Dynamic Button Generation**
- Buttons are automatically created from dataset headers/keys
- Shows both the key name and first row value
- Responsive design with hover effects and visual feedback

## How It Works

### 1. **Dataset Loading**
When you load a dataset (JSON array or CSV), the system:
- Extracts the first row values
- Creates buttons for each key-value pair
- Displays them below the JSON input area

### 2. **Button Creation**
Each button contains:
- **Key**: The column/field name (e.g., "email", "name")
- **Value**: The first row value for that key
- **Icon**: Visual indicator (📋)
- **Drag handle**: Enables drag-and-drop

### 3. **Input Field Detection**
The content script automatically detects:
- `<input>` elements (all types)
- `<textarea>` elements
- `[contenteditable]` elements
- Only visible and interactive fields

### 4. **Value Insertion**
When pasting values, the system:
- Replaces selected text or inserts at cursor position
- Triggers appropriate input events
- Maintains cursor position after insertion

## Usage Examples

### Example 1: Basic JSON Dataset
```json
[
  {"email":"john@example.com","name":"John Doe","company":"Acme Corp"},
  {"email":"jane@test.com","name":"Jane Smith","company":"Tech Inc"}
]
```

**Result**: Three buttons will be created:
- `📋 email` (john@example.com)
- `📋 name` (John Doe)  
- `📋 company` (Acme Corp)

### Example 2: CSV Import
```csv
email,name,phone,message
john@example.com,John Doe,555-0123,Hello world
jane@test.com,Jane Smith,555-0456,Test message
```

**Result**: Four buttons will be created with the first row values.

## Technical Implementation

### Files Modified/Created

1. **panel.html**
   - Added dataset buttons section
   - Added CSS styles for buttons and drag feedback

2. **panel.js**
   - `updateDatasetButtons()` - Creates buttons from dataset
   - `handleDatasetButtonClick()` - Handles click-to-paste
   - `handleDragStart/End()` - Manages drag operations

3. **dataset-helper.js** (New)
   - Content script for browser tab interaction
   - Input field detection and highlighting
   - Value insertion logic

4. **manifest.json**
   - Added content script configuration
   - Added web accessible resources

5. **sw.js**
   - Added message handling for dataset operations

### Message Flow

```
Panel → Content Script → Browser Tab
  ↓
1. User clicks/drags button
2. Panel sends message to content script
3. Content script finds focused input field
4. Content script inserts value
5. Content script sends success response
6. Panel shows feedback message
```

## Browser Compatibility

- ✅ Chrome (Manifest V3)
- ✅ Edge (Chromium-based)
- ✅ Other Chromium browsers
- ⚠️ Firefox (requires Manifest V2 conversion)

## Input Field Support

### Supported Elements
- `<input type="text">`
- `<input type="email">`
- `<input type="password">`
- `<input type="search">`
- `<input type="url">`
- `<input type="tel">`
- `<input type="number">`
- `<textarea>`
- `[contenteditable="true"]`
- `[contenteditable=""]`

### Special Features
- **Selection handling**: Replaces selected text
- **Cursor positioning**: Places cursor after inserted text
- **Event triggering**: Fires input/change events
- **Visual feedback**: Highlights fields during drag

## Testing

Use the provided `test-dataset-buttons.html` file to test the functionality:

1. Open the test page in Chrome
2. Load the Chrome extension
3. Import sample data or paste JSON
4. Test both click and drag methods
5. Verify values are inserted correctly

## Troubleshooting

### Buttons Not Appearing
- Check if dataset is properly loaded
- Verify JSON format is valid array
- Check browser console for errors

### Click Not Working
- Ensure an input field is focused
- Check if content script is loaded
- Verify extension permissions

### Drag Not Working
- Check if input fields are visible
- Verify drag events are not blocked
- Check for JavaScript errors

### Values Not Inserting
- Check input field compatibility
- Verify content script permissions
- Check for cross-origin restrictions

## Future Enhancements

- [ ] Multi-row button support
- [ ] Custom button styling options
- [ ] Keyboard shortcuts for buttons
- [ ] Button grouping by data type
- [ ] Search/filter buttons
- [ ] Button reordering
- [ ] Custom value formatting

## Security Considerations

- Content script runs in page context
- No sensitive data stored in buttons
- Values only inserted on user action
- Proper input validation and sanitization
- Cross-origin restrictions respected
