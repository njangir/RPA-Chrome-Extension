# Advanced RPA Features Documentation

## Overview

This extension now supports advanced automation scenarios including:
- **URL Navigation from Dataset**: Navigate to different URLs for each data row
- **Dynamic Element Finding**: Find elements by their text content or position
- **Hierarchical Data Loops**: Create nested structures like pathways→sections→items

## New Step Types

### 1. Navigate URL (`navigate_url`)

Navigate to a URL from a dataset column or static URL.

**Use Case**: Open different product pages, user profiles, or forms for each data row.

**How to Insert**:
1. Click "➕ Insert Special Step"
2. Select "Navigate URL"
3. Choose a dataset column containing URLs, OR enter a static URL
4. Click "Insert Step"

**Example**: If your dataset has a "ProductURL" column, the flow will navigate to each product page before processing that row.

### 2. Find By Value (`find_by_value`)

Find and interact with an element containing specific text from your dataset.

**Use Case**: 
- Click a button that says "Edit" or "Delete"
- Select a specific item from a list
- Find and click a product name

**How to Insert**:
1. Click "➕ Insert Special Step"
2. Select "Find By Value"
3. Choose the dataset column containing the text to search for
4. Select action: Click, Hover, or Focus
5. Optionally enable "Exact match" or "Case sensitive"
6. Click "Insert Step"

**Search Strategy**: The system tries multiple strategies:
1. Exact text match
2. Contains match (partial)
3. Word-by-word match
4. Attribute matching (aria-label, title, alt, placeholder)

**Example**: If your dataset has "ItemName" column with values like "Item 1", "Item 2", the flow will find and click each item by name.

### 3. Find By Index (`find_by_index`)

Select the Nth element from a collection of similar elements.

**Use Case**:
- Select the 3rd button in a list
- Click a specific row in a table
- Choose an item by position

**How to Insert**:
1. Click "➕ Insert Special Step"
2. Select "Find By Index"
3. Enter CSS selector that matches multiple elements (e.g., `ul li`, `.item`)
4. Enter index (0-based) or use `{ColumnName}` for dataset-driven index
5. Select action: Click or Hover
6. Click "Insert Step"

**Example**: Selector `ul.products li` with index `2` will click the 3rd item in the products list.

### 4. Loop Groups (`loop_group`)

Create repeating sections of steps based on data grouping.

**Use Case**: Hierarchical data processing like:
- Create pathway → Add multiple sections → Add items to each section
- Create order → Add multiple line items
- Create project → Add multiple tasks → Add subtasks to each task

**How to Insert**:
1. Click "➕ Insert Special Step" where loop should start
2. Select "Loop Start"
3. Choose the column to group by (e.g., "Section Title")
4. Optionally add a descriptive name
5. Click "Insert Step"
6. Add regular steps that should repeat for each group
7. Click "➕ Insert Special Step" where loop should end
8. Select "Loop End"
9. Click "Insert Step"

**Nested Loops**: You can nest up to 3 levels deep for complex hierarchies.

## Example Scenario: Creating Pathways with Sections and Items

### Dataset Structure (sample-scene.csv):
```csv
Pathway,Section Title,Section Description,Content
Pathway 1,Section 1,Description 1,Item 1
Pathway 1,Section 1,Description 1,Item 2
Pathway 1,Section 2,Description 2,Item 3
Pathway 1,Section 2,Description 2,Item 4
Pathway 1,Section 2,Description 2,Item 5
```

### Flow Structure:

```
1. [Click] "Create Pathway" button
2. [Input] Pathway name (use dataset column "Pathway")
3. [Click] "Save Pathway" button
4. [Loop Start] Group by: "Section Title"
   5. [Click] "Add Section" button
   6. [Input] Section title (use dataset column "Section Title")
   7. [Input] Section description (use dataset column "Section Description")
   8. [Click] "Save Section" button
   9. [Loop Start] Group by: "Content"
      10. [Click] "Add Item" button
      11. [Find By Value] Search for text from "Content" column, Action: Click
   12. [Loop End]
13. [Loop End]
```

### Execution Result:
- Creates 1 pathway ("Pathway 1")
- Creates 2 sections ("Section 1" and "Section 2")
- Adds 2 items to Section 1 (Item 1, Item 2)
- Adds 3 items to Section 2 (Item 3, Item 4, Item 5)

**Preview Message**: 
```
Will process: 1 Pathway(s) → 2 Section Title(s) → 5 Content(s) (6 total rows)
```

## Tips and Best Practices

### 1. Testing Your Flow
- Use the "🧪 Test Flow" feature to validate each step
- Test with a small dataset first (2-3 rows)
- Check loop structure using the visual nesting indicators

### 2. Dataset Preparation
- Ensure grouping columns have consistent values
- Use headers that clearly indicate the data purpose
- Group data is arranged in hierarchical order

### 3. Loop Group Design
- Keep loops simple (max 3 levels deep)
- Test inner loops independently first
- Use descriptive names for loop groups

### 4. Error Handling
- The extension will stop if an element isn't found
- Use "Find By Value" with partial matching for better flexibility
- Test selectors using the selector dropdown in Test Flow mode

### 5. Performance
- Large datasets with deep nesting may take time
- Use the execution preview to estimate complexity
- Consider breaking very large datasets into batches

## Visual Indicators

In the accordion view, loop groups are shown with:
- **Purple left border**: Loop start/end markers
- **Indentation**: Steps inside loops are indented
- **Loop info badge**: Shows grouping column name

## Backward Compatibility

All existing flows continue to work exactly as before. New features are:
- Completely optional
- Only activated when you insert special steps
- Don't affect regular recorded steps

## Troubleshooting

### "Element not found" errors
- Check if selector is stable across page reloads
- Use "Find By Value" instead of recorded selector
- Try different selector strategies in Test Flow

### Loop not grouping correctly
- Verify column names match exactly (case-sensitive)
- Check data is sorted by grouping columns
- Ensure loop start/end markers are properly matched

### Navigate URL not working
- Verify URLs in dataset are complete (include https://)
- Check for redirects that might interfere
- Add wait time after navigation if needed

## Support

For issues or questions, check:
1. Console logs (F12 → Console)
2. Run.logs file for execution details
3. Test Flow mode for step validation

## Future Enhancements

Potential additions based on feedback:
- Conditional steps (if/then logic)
- Variable extraction and reuse
- Custom wait conditions
- Data transformations
- API integrations

