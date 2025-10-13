// data-grouping-engine.js - Hierarchical data processing engine
(() => {
  'use strict';
  
  /**
   * Group data by a specific column value
   * @param {Array} data - Array of row objects
   * @param {String} columnName - Column to group by
   * @returns {Array} Array of groups with key and rows
   */
  function groupDataByColumn(data, columnName) {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    if (!columnName) {
      return [{ key: null, rows: data }];
    }
    
    const groups = [];
    const groupMap = new Map();
    
    for (const row of data) {
      const key = row[columnName];
      
      if (!groupMap.has(key)) {
        const group = { key, rows: [] };
        groupMap.set(key, group);
        groups.push(group);
      }
      
      groupMap.get(key).rows.push(row);
    }
    
    return groups;
  }
  
  /**
   * Detect hierarchy in data based on multiple grouping columns
   * @param {Array} data - Array of row objects
   * @param {Array} groupingColumns - Array of column names for nested grouping
   * @returns {Object} Hierarchical structure with nested groups
   */
  function detectHierarchy(data, groupingColumns) {
    if (!Array.isArray(data) || data.length === 0) {
      return { groups: [] };
    }
    
    if (!Array.isArray(groupingColumns) || groupingColumns.length === 0) {
      return { groups: [{ key: null, rows: data }] };
    }
    
    // Build hierarchy recursively
    function buildLevel(rows, columns, depth = 0) {
      if (columns.length === 0 || depth >= 3) {
        // Max depth reached or no more columns
        return rows;
      }
      
      const [currentColumn, ...remainingColumns] = columns;
      const groups = groupDataByColumn(rows, currentColumn);
      
      if (remainingColumns.length > 0) {
        // Process next level
        for (const group of groups) {
          const subGroups = buildLevel(group.rows, remainingColumns, depth + 1);
          if (Array.isArray(subGroups) && subGroups.length > 0 && subGroups[0].key !== undefined) {
            group.subGroups = subGroups;
            // Keep first row for parent-level data
            group.parentRow = group.rows[0];
          }
        }
      }
      
      return groups;
    }
    
    const hierarchy = {
      groups: buildLevel(data, groupingColumns, 0),
      groupingColumns,
      totalRows: data.length
    };
    
    return hierarchy;
  }
  
  /**
   * Flatten hierarchical data back to row sequence with group markers
   * @param {Object} hierarchy - Hierarchical structure from detectHierarchy
   * @returns {Array} Flattened execution sequence with group markers
   */
  function flattenHierarchy(hierarchy) {
    const sequence = [];
    
    function processGroup(group, level = 0, columnName = null) {
      // Add group start marker
      sequence.push({
        type: '__group_start__',
        level,
        key: group.key,
        columnName,
        rowCount: group.rows.length
      });
      
      if (group.subGroups) {
        // Has sub-groups - process each sub-group
        const subColumnName = hierarchy.groupingColumns[level + 1];
        for (const subGroup of group.subGroups) {
          processGroup(subGroup, level + 1, subColumnName);
        }
      } else {
        // Leaf level - add all rows
        for (const row of group.rows) {
          sequence.push({
            type: '__row__',
            level,
            row,
            groupKey: group.key
          });
        }
      }
      
      // Add group end marker
      sequence.push({
        type: '__group_end__',
        level,
        key: group.key
      });
    }
    
    if (hierarchy.groups) {
      const topColumnName = hierarchy.groupingColumns[0];
      for (const group of hierarchy.groups) {
        processGroup(group, 0, topColumnName);
      }
    }
    
    return sequence;
  }
  
  /**
   * Analyze dataset to suggest grouping columns
   * @param {Array} data - Array of row objects
   * @returns {Array} Suggested grouping columns based on repetition patterns
   */
  function suggestGroupingColumns(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    
    const columns = Object.keys(data[0]);
    const suggestions = [];
    
    for (const column of columns) {
      const uniqueValues = new Set(data.map(row => row[column]));
      const repetitionFactor = data.length / uniqueValues.size;
      
      // Suggest if column has repeating values (more than 1 row per unique value on average)
      if (repetitionFactor > 1 && uniqueValues.size < data.length) {
        suggestions.push({
          column,
          uniqueCount: uniqueValues.size,
          totalRows: data.length,
          repetitionFactor,
          confidence: Math.min(1, (repetitionFactor - 1) / 5) // 0 to 1 scale
        });
      }
    }
    
    // Sort by confidence (higher = better grouping candidate)
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Generate execution preview for grouped data
   * @param {Object} hierarchy - Hierarchical structure
   * @returns {Object} Preview summary
   */
  function generateExecutionPreview(hierarchy) {
    const preview = {
      totalGroups: 0,
      levels: [],
      summary: ''
    };
    
    function countGroups(groups, level = 0) {
      if (!Array.isArray(groups) || groups.length === 0) return;
      
      if (!preview.levels[level]) {
        preview.levels[level] = {
          level,
          columnName: hierarchy.groupingColumns[level],
          groupCount: 0,
          totalRows: 0
        };
      }
      
      preview.levels[level].groupCount += groups.length;
      preview.totalGroups += groups.length;
      
      for (const group of groups) {
        preview.levels[level].totalRows += group.rows.length;
        
        if (group.subGroups) {
          countGroups(group.subGroups, level + 1);
        }
      }
    }
    
    countGroups(hierarchy.groups);
    
    // Generate human-readable summary
    const parts = [];
    for (const level of preview.levels) {
      parts.push(`${level.groupCount} ${level.columnName || 'group'}(s)`);
    }
    
    if (parts.length > 0) {
      preview.summary = `Will process: ${parts.join(' → ')} (${hierarchy.totalRows} total rows)`;
    } else {
      preview.summary = `Will process ${hierarchy.totalRows} row(s)`;
    }
    
    return preview;
  }
  
  /**
   * Validate loop group structure in steps
   * @param {Array} steps - Array of step objects
   * @returns {Object} Validation result with errors/warnings
   */
  function validateLoopGroups(steps) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      structure: []
    };
    
    const stack = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      if (step.type === 'loop_group') {
        if (step.action === 'start') {
          if (!step.groupBy) {
            result.errors.push({
              index: i,
              message: 'Loop group start missing "groupBy" column'
            });
            result.valid = false;
          }
          
          stack.push({ index: i, groupBy: step.groupBy, level: stack.length });
          
        } else if (step.action === 'end') {
          if (stack.length === 0) {
            result.errors.push({
              index: i,
              message: 'Loop group end without matching start'
            });
            result.valid = false;
          } else {
            const start = stack.pop();
            result.structure.push({
              start: start.index,
              end: i,
              groupBy: start.groupBy,
              level: start.level,
              stepCount: i - start.index - 1
            });
          }
        }
      }
    }
    
    // Check for unclosed groups
    if (stack.length > 0) {
      for (const unclosed of stack) {
        result.errors.push({
          index: unclosed.index,
          message: 'Loop group start without matching end'
        });
      }
      result.valid = false;
    }
    
    // Check for maximum nesting depth
    const maxDepth = Math.max(0, ...result.structure.map(s => s.level));
    if (maxDepth > 2) {
      result.warnings.push({
        message: `Deep nesting detected (${maxDepth + 1} levels). Consider simplifying.`
      });
    }
    
    return result;
  }
  
  // Export to window for use by other scripts
  if (typeof window !== 'undefined') {
    window.__mvpDataGrouping = {
      groupDataByColumn,
      detectHierarchy,
      flattenHierarchy,
      suggestGroupingColumns,
      generateExecutionPreview,
      validateLoopGroups
    };
  }
  
  // Export for use in service worker (if available)
  if (typeof self !== 'undefined' && self.constructor.name === 'ServiceWorkerGlobalScope') {
    self.__mvpDataGrouping = {
      groupDataByColumn,
      detectHierarchy,
      flattenHierarchy,
      suggestGroupingColumns,
      generateExecutionPreview,
      validateLoopGroups
    };
  }
  
  console.log('[Data Grouping Engine] Loaded');
})();

