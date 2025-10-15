# Preloaded Flows Feature

## Overview

The Preloaded Flows feature provides ready-to-use automation templates with predefined steps and CSV data templates. Users can quickly start with common automation patterns without having to record steps from scratch.

## Features

### 🎯 **5 Pre-built Flow Templates**
- **Form Filler**: Automatically fill web forms with contact information
- **E-commerce Checkout**: Complete online store checkout processes
- **Data Extraction**: Scrape and extract data from web pages
- **Social Media Posting**: Automate social media content posting
- **Survey Completion**: Fill out online surveys and forms

### 📁 **CSV Template System**
- Each flow comes with a sample CSV template
- Download templates to fill with your data
- Import populated CSV files back into the extension
- Automatic validation of CSV structure against templates

### 🔄 **Reusable Flow Management**
- Load preloaded flows into the current session
- Combine with existing Save/Load flows functionality
- Modify and customize loaded flows as needed
- Export customized flows using the existing flow system

## How to Use

### 1. **Select a Preloaded Flow**
- Open the "Preloaded Flows" section in the extension panel
- Browse available flow templates
- Click on a flow card to select it
- View detailed information about steps and requirements

### 2. **Download CSV Template**
- With a flow selected, click "📁 Download Template"
- Open the downloaded CSV file in Excel, Google Sheets, or any text editor
- Replace sample data with your actual data
- Save the file as CSV

### 3. **Import Your Data**
- Click "📤 Import CSV" to load your populated data
- The extension validates the CSV structure
- Data is loaded into the dataset section for use with the flow

### 4. **Load and Run the Flow**
- Click "📥 Load Flow" to load the predefined steps
- The steps appear in the "Recorded Steps" section
- Use "Play All" to execute the automation with your data

## Flow Templates

### Form Filler
**Purpose**: Automatically fill web forms with contact information
**CSV Columns**: `url`, `name`, `email`, `phone`
**Use Cases**: Contact forms, registrations, lead generation

### E-commerce Checkout
**Purpose**: Complete online store checkout processes
**CSV Columns**: `product_url`, `email`, `first_name`, `last_name`, `address`, `city`, `zip_code`
**Use Cases**: Online shopping automation, bulk purchases

### Data Extraction
**Purpose**: Extract structured data from web pages
**CSV Columns**: `url`, `search_term`, `item_index`, `title`, `price`, `description`
**Use Cases**: Product scraping, competitor analysis, data collection

### Social Media Posting
**Purpose**: Automate social media content posting
**CSV Columns**: `platform_url`, `post_text`, `hashtags`
**Use Cases**: Content marketing, social media management

### Survey Completion
**Purpose**: Fill out online surveys and forms
**CSV Columns**: `survey_url`, `name`, `email`, `rating_1`, `rating_2`, `comment`
**Use Cases**: Market research, feedback collection

## Technical Details

### File Structure
```
preloaded-flows.js    # Flow definitions and templates
panel.html           # UI components
panel.js            # Flow management logic
```

### Data Format
Each preloaded flow contains:
- **Metadata**: name, description, category, version
- **Steps**: Array of automation steps with placeholders
- **CSV Template**: Sample data structure
- **Instructions**: Usage guidance

### Step Types Supported
- `navigate_url`: Navigate to URLs from dataset
- `input`: Fill form fields with data
- `click`: Click buttons and links
- `find_by_value`: Find elements by text content
- `find_by_index`: Select items by position
- `loop_group`: Repeat steps for grouped data
- `copy`: Extract text from elements

### Error Handling
- CSV structure validation
- Missing column detection
- File format verification
- Step loading error recovery
- User-friendly error messages

## Customization

### Adding New Flows
1. Edit `preloaded-flows.js`
2. Add new flow object to `PRELOADED_FLOWS`
3. Define steps, CSV template, and metadata
4. Test the flow with sample data

### Modifying Existing Flows
1. Load a preloaded flow
2. Edit steps in the "Recorded Steps" section
3. Save as a custom flow using existing functionality
4. Share with team members

### CSV Template Customization
- Modify column names to match your data
- Add or remove columns as needed
- Update step placeholders to use new column names
- Test with sample data before production use

## Best Practices

### Data Preparation
- Ensure CSV data matches template structure exactly
- Use consistent formatting for dates, numbers, and text
- Test with small datasets before large-scale automation
- Keep sensitive data secure and encrypted

### Flow Testing
- Test flows on staging environments first
- Verify selectors work on target websites
- Check for dynamic content that might break automation
- Monitor execution for errors and edge cases

### Performance Considerations
- Use appropriate delays between steps
- Implement error handling for network issues
- Consider rate limiting for external services
- Monitor resource usage during bulk operations

## Troubleshooting

### Common Issues

**CSV Import Fails**
- Check file format (must be .csv)
- Verify column names match template exactly
- Ensure no special characters in data
- Check file encoding (UTF-8 recommended)

**Flow Steps Don't Work**
- Verify website hasn't changed
- Check if selectors need updating
- Test individual steps manually
- Review browser console for errors

**Data Not Filling Correctly**
- Check placeholder names in steps
- Verify CSV column names match placeholders
- Ensure data format matches expected input
- Test with simple data first

### Getting Help
- Check the browser console for error messages
- Verify all required columns are present in CSV
- Test flows with sample data before production
- Review step details in the accordion view

## Future Enhancements

- More flow templates for different industries
- Visual flow editor for creating custom flows
- Flow sharing and collaboration features
- Integration with external data sources
- Advanced error handling and retry logic
- Flow performance analytics and optimization

---

*This feature enhances the RPA Chrome Extension by providing ready-to-use automation templates, making it easier for users to get started with automation without technical expertise.*

