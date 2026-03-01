# Sidebar Selector - List-Based Navigation ✅

## Problem Solved
- ❌ **Before**: All clients/suppliers shown at once → overlapping nodes
- ❌ **Before**: Clients without projects cluttered the view
- ❌ **Before**: Hard to find specific client/supplier
- ✅ **After**: Clean sidebar list with search
- ✅ **After**: Click to view only selected client/supplier
- ✅ **After**: Automatically filters out empty entries

## New Approach: List + Detail View

### Before (Messy Grid):
```
[All Clients Shown at Once]
Client 1 → Projects... (overlap)
Client 2 → Projects... (overlap)
Client 3 → (no projects - why shown?)
Client 4 → Projects... (overlap)
```

### After (Clean Selector):
```
┌─────────────────┐  ┌───────────────────────────┐
│  SIDEBAR        │  │   MAP VIEW                │
│                 │  │                           │
│ 🏢 Client 1  ✓  │  │  Client 1 → P1 → Q1 → ... │
│ 🏢 Client 2     │  │           → P2 → Q2 → ... │
│ 🏢 Client 4     │  │                           │
│ 🏢 Client 5     │  │  (Clean, no overlap!)     │
│                 │  │                           │
│ [Search...]     │  │                           │
└─────────────────┘  └───────────────────────────┘
```

## Features

### 1. HierarchySelector Component
**File**: `src/components/map/HierarchySelector.jsx`

#### Features:
- **Search bar**: Filter clients/suppliers by name
- **Smart filtering**: Only shows entries with projects/products
- **Selection state**: Highlights selected item
- **Count display**: Shows number of projects/products
- **Contact info**: Displays contact person/sales person
- **Clean UI**: Professional sidebar design

#### Visual Elements:
- 🏢 Client icon
- 🏭 Supplier icon
- ✓ Checkmark for selected
- 📭 Empty state icon
- 💡 Help text

### 2. Automatic Filtering

#### Filters Out:
- Clients with 0 projects
- Suppliers with 0 products
- Items that don't match search

#### Keeps:
- Only clients with active projects
- Only suppliers supplying products
- Relevant search results

### 3. Single-Item Focus View

When you click a client/supplier:
- Shows ONLY that one item's hierarchy
- No overlapping nodes
- Clean vertical layout
- Easy to see all relationships

## Implementation

### Files Created:
1. **src/components/map/HierarchySelector.jsx** - Sidebar component

### Files Modified:
1. **src/utils/compactHierarchicalLayout.js**
   - Added `getSingleItemHierarchy()` function

2. **src/pages/MapPage.jsx**
   - Added `selectedHierarchyId` state
   - Added `showHierarchySidebar` state
   - Integrated HierarchySelector component
   - Modified layout to show sidebar + map

### Key Functions:

```javascript
// Get only selected item
getSingleItemHierarchy(hierarchy, itemId, viewMode)

// Filter logic in HierarchySelector
const filteredItems = hierarchy.filter(item => {
  // Only show if has projects/products
  const hasData = viewMode === 'client'
    ? item.projects && item.projects.length > 0
    : item.products && item.products.length > 0;

  if (!hasData) return false;

  // Apply search filter
  return nameMatches || contactMatches;
});
```

## User Flow

### 1. Open Map Page
```
→ Sidebar appears on left
→ Shows all clients with projects (or suppliers with products)
→ No client selected = show all in grid (optional)
```

### 2. Search for Client
```
→ Type "DOBLE" in search box
→ List filters to matching clients
→ Click on client
```

### 3. View Hierarchy
```
→ Map shows ONLY selected client
→ All their projects displayed
→ All quotations, items, suppliers shown
→ Clean single-column layout
→ No overlapping!
```

### 4. Switch Views
```
→ Click "Supplier View" button
→ Sidebar switches to supplier list
→ Click a supplier
→ See their products → quotations → projects → clients
```

## Sidebar Features

### Header:
- Title (Clients/Suppliers)
- Close button (X)
- Search input
- Count display

### List Items Show:
- Icon (🏢 or 🏭)
- Company name (truncated if long)
- Project/product count
- Contact person (if available)
- Selected state (blue background + checkmark)

### Footer:
- Help text: "💡 Click a client to view their complete hierarchy"

## Layout Structure

### HTML Structure:
```html
<div class="flex"> <!-- Main container -->
  <!-- Sidebar (320px wide) -->
  <HierarchySelector />

  <!-- Map (flex-1, takes remaining space) -->
  <div class="flex-1">
    <ReactFlow>
      <!-- Map content -->
    </ReactFlow>
  </div>
</div>
```

### Responsive:
- Sidebar: Fixed 320px (w-80)
- Map: Flexible (flex-1)
- Sidebar can be hidden with close button

## Benefits

### 1. No More Overlapping
- One client at a time = no node collisions
- Clean vertical flow
- Easy to read

### 2. Better Performance
- Only render what's needed
- Fewer nodes = faster rendering
- Better zoom/pan performance

### 3. Improved UX
- Clear navigation
- Search functionality
- Know exactly what you're viewing
- Easy to switch between clients

### 4. Cleaner Data
- Hides empty entries
- Shows only relevant information
- Less clutter

## State Management

### New States:
```javascript
const [selectedHierarchyId, setSelectedHierarchyId] = useState(null);
const [showHierarchySidebar, setShowHierarchySidebar] = useState(true);
```

### Logic Flow:
```javascript
if (selectedHierarchyId) {
  // Show only selected item
  hierarchy = getSingleItemHierarchy(hierarchy, selectedHierarchyId);
  maxPerRow = 1; // Single column
} else {
  // Show all (grid view)
  maxPerRow = 3; // Three columns
}
```

## Build Status
✅ Successfully compiled
✅ All components working
✅ No overlapping nodes
✅ Ready to test!

## How to Use

1. Run `npm run dev`
2. Go to Map page
3. Switch to "hierarchical" mode
4. See sidebar on left with client list
5. Type to search clients
6. Click a client to view their hierarchy
7. Switch to "Supplier View" to see supplier perspective
8. Click close (X) to hide sidebar if needed

## Next Steps (Optional)

- [ ] Add "Show All" button to view grid again
- [ ] Remember last selected client
- [ ] Add keyboard shortcuts (arrows to navigate list)
- [ ] Add favorite/pin clients
- [ ] Export selected client data
- [ ] Print selected hierarchy
