# Quick Reference Guide - Advanced RPA Features

## 🚀 Quick Start

1. Load dataset (CSV or JSON)
2. Record basic steps OR insert special steps
3. Test with "Test Flow" feature
4. Play with full dataset

## 📝 New Step Types

### 🌐 Navigate URL
**When to use**: Open different URLs for each row
```
→ Column: "ProductURL" OR Static: "https://example.com"
```

### 🔍 Find By Value
**When to use**: Click element by its text content
```
→ Column: "ItemName"
→ Action: Click
→ Example: Finds and clicks "Item 1", "Item 2", etc.
```

### 🔢 Find By Index  
**When to use**: Click Nth element in a list
```
→ Selector: "ul li" or ".product-card"
→ Index: 2 (clicks 3rd item)
→ Action: Click
```

### 🔄 Loop Group
**When to use**: Repeat steps for grouped data
```
→ Loop Start: Group by "Section Title"
  [Steps to repeat]
→ Loop End
```

## 🎯 Common Patterns

### Pattern 1: Simple URL Navigation
```
1. Navigate URL (Column: "PageURL")
2. Input (record normally)
3. Click (record normally)
```

### Pattern 2: Dynamic Element Selection
```
1. Click "Add Item"
2. Find By Value (Column: "ItemName", Action: Click)
3. Click "Confirm"
```

### Pattern 3: Hierarchical Data (2 levels)
```
1. Create Parent
2. Loop Start (Group by: "ParentName")
   3. Input parent data
   4. Loop Start (Group by: "ChildName")
      5. Input child data
   6. Loop End
7. Loop End
```

## 💡 Tips

### Dataset Preparation
- Headers must match exactly (case-sensitive)
- Group hierarchically: Parent → Child → Grandchild
- Sort by grouping columns for clarity

### Recording Strategy
1. Record basic navigation/clicks first
2. Insert special steps between regular steps
3. Use "Test Flow" to validate selectors
4. Start with small dataset (2-3 rows)

### Debugging
- Check browser console (F12)
- Use "Test Flow" to verify each step
- Test loop groups with 1-2 unique values first
- Verify column names match dataset exactly

## ⚠️ Common Issues

### "Element not found"
**Solution**: Use Find By Value instead of recorded selector

### "Loop not grouping correctly"
**Solution**: Check column names (case-sensitive), ensure data sorted

### "Navigate URL failed"
**Solution**: Include https:// in URLs, check for redirects

## 📊 Dataset Examples

### Simple List
```csv
Name,Email,Phone
John,john@example.com,555-1234
Jane,jane@example.com,555-5678
```
**No loop groups needed** - processes row by row

### Hierarchical (2 levels)
```csv
Project,Task,Status
Project A,Task 1,Done
Project A,Task 2,Pending
Project B,Task 3,Done
```
**Loop by "Project"** - creates 2 projects, 3 tasks

### Hierarchical (3 levels)
```csv
Course,Module,Lesson
Course 1,Module A,Lesson 1
Course 1,Module A,Lesson 2
Course 1,Module B,Lesson 3
```
**Loop by "Course" → Loop by "Module"** - 1 course, 2 modules, 3 lessons

## 🎨 Visual Indicators

- **Purple border left**: Loop group marker
- **Indented**: Steps inside loop
- **🌐 Icon**: Navigate URL
- **🔍 Icon**: Find By Value
- **🔢 Icon**: Find By Index
- **🔄 Icon**: Loop Group

## ⌨️ Keyboard Shortcuts

None yet - use mouse for step insertion

## 📁 Files Reference

- **test-hierarchical-flow.html**: Test page for complex flows
- **sample-scene.csv**: Example hierarchical dataset
- **ADVANCED_FEATURES.md**: Full documentation
- **IMPLEMENTATION_SUMMARY.md**: Technical details

## 🔗 Workflow

```
Record/Insert → Test Flow → Review → Play All → Verify Results
```

## 🆘 Need Help?

1. Read ADVANCED_FEATURES.md
2. Check IMPLEMENTATION_SUMMARY.md
3. Open browser console (F12)
4. Check run.logs file
5. Test with sample files first

## ✅ Pre-flight Checklist

Before running complex flows:

- [ ] Dataset loaded and verified
- [ ] Column names match exactly
- [ ] Loop groups properly matched (start/end)
- [ ] Tested with small dataset (2-3 rows)
- [ ] Used "Test Flow" to validate selectors
- [ ] Start URL set if needed
- [ ] Browser console open (F12) for monitoring

## 🎓 Learning Path

1. **Beginner**: Use regular recording only
2. **Intermediate**: Add Navigate URL and Find By Value
3. **Advanced**: Use single-level loop groups
4. **Expert**: Use nested loop groups (2-3 levels)

---

**Remember**: Start simple, test often, add complexity gradually!

