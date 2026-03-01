# Map View Database Structure Analysis

## ✅ All Required Tables Exist

### Tables Confirmed:
- ✓ `clients` - Client companies
- ✓ `tracks` - Projects/Tracks
- ✓ `quotations` - Quotations for each track
- ✓ `quotation_items` - Line items in quotations
- ✓ `suppliers` - Supplier companies
- ✓ `track_stages` - Stages/workflow for each track
- ✓ `supplier_documents` - Documents for suppliers
- ✓ `catalog_items` - Reusable product catalog

### Views Confirmed:
- ✓ `v_tracks_overview` - Contains: track_id, track_name, workflow_kind, client_name, track_status, current_stage_name, created_at, progress_pct, next_due_date, is_overdue

## ✅ Relationships Confirmed

### Working Relationships:
```
clients.id ← tracks.client_id
tracks.id ← track_stages.track_id
quotations.id ← quotation_items.quotation_id
suppliers.id ← quotation_items.supplier_id
suppliers.id ← supplier_documents.supplier_id
```

### Relationship Exists but Not in Supabase Cache:
```
tracks.id ← quotations.track_id
```
**Solution**: Manual join in application code using `.eq('track_id', track.id)`

## 📊 Data Hierarchy for Map Visualization

### CLIENT-CENTRIC VIEW
```
Client
  └─ Projects (Tracks)
       ├─ Current Stage + Status (from track_stages)
       ├─ Tasks (from track_stages or tasks table)
       └─ Quotations
            ├─ Type: Product/Service
            ├─ Currency, Terms, Notes
            └─ Quotation Items
                 ├─ Description, Price, Quantity
                 └─ Supplier (if product type)
                      └─ Supplier Details
```

### SUPPLIER-CENTRIC VIEW
```
Supplier
  ├─ Documents (supplier_documents)
  └─ Products Supplied (quotation_items)
       └─ Parent Quotation
            ├─ Quote Number, Amount, Status
            └─ Parent Project (Track)
                 ├─ Project Name, Status
                 ├─ Current Stage
                 └─ Client
                      └─ Client Company Name
```

## 🎯 Implementation Plan

### Data Queries Needed:

#### For Client View:
```javascript
// 1. Get all clients
const clients = await supabase.from('clients').select('*');

// 2. For each client, get tracks
const tracks = await supabase
  .from('tracks')
  .select('*, track_stages(*)')
  .eq('client_id', clientId);

// 3. For each track, get quotations (manual join)
const quotations = await supabase
  .from('quotations')
  .select('*, quotation_items(*, supplier:suppliers(*))')
  .eq('track_id', trackId);
```

#### For Supplier View:
```javascript
// 1. Get all suppliers
const suppliers = await supabase
  .from('suppliers')
  .select('*, supplier_documents(*)');

// 2. For each supplier, get quotation items
const items = await supabase
  .from('quotation_items')
  .select('*, quotation:quotations(*)')
  .eq('supplier_id', supplierId);

// 3. For each quotation, get track and client
const track = await supabase
  .from('tracks')
  .select('*, client:clients(*), track_stages(*)')
  .eq('id', quotation.track_id)
  .single();
```

### Node Types for Map Visualization:
1. **Client Node** - Blue, large circle
2. **Project/Track Node** - Green, medium circle (shows current stage badge)
3. **Quotation Node** - Yellow, medium circle (shows type: product/service)
4. **Product/Service Node** - Purple, small circle (quotation items)
5. **Supplier Node** - Orange, medium circle

### Additional Features:
- Click node to see details in sidebar
- Color code by status (active, completed, cancelled, overdue)
- Show stage indicators on project nodes
- Show task count badges
- Collapsible/expandable nodes
- Filter by status, date, client, supplier
- Toggle between Client View and Supplier View

## ✅ Ready for Implementation

All database structures are in place. The Map View can be implemented immediately with manual joins for the tracks→quotations relationship.
