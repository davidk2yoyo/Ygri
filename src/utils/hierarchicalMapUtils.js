import { supabase } from "../supabaseClient";

/**
 * Fetch all data needed for hierarchical map view
 * Includes quotations, quotation items, and suppliers
 */
export async function fetchHierarchicalMapData() {
  try {
    console.log("Fetching hierarchical map data...");

    const [
      clientsResult,
      tracksResult,
      trackStagesResult,
      quotationsResult,
      quotationItemsResult,
      suppliersResult,
      catalogItemsResult
    ] = await Promise.all([
      // Clients
      supabase
        .from("clients")
        .select("*"),

      // Tracks (Projects)
      supabase
        .from("tracks")
        .select("*"),

      // Track Stages
      supabase
        .from("track_stages")
        .select("*"),

      // Quotations
      supabase
        .from("quotations")
        .select("*"),

      // Quotation Items
      supabase
        .from("quotation_items")
        .select("*"),

      // Suppliers
      supabase
        .from("suppliers")
        .select("*"),

      // Catalog Items (optional, for reference)
      supabase
        .from("catalog_items")
        .select("*")
    ]);

    // Check for errors
    if (clientsResult.error) throw clientsResult.error;
    if (tracksResult.error) throw tracksResult.error;
    if (trackStagesResult.error) throw trackStagesResult.error;
    if (quotationsResult.error) throw quotationsResult.error;
    if (quotationItemsResult.error) throw quotationItemsResult.error;
    if (suppliersResult.error) throw suppliersResult.error;
    if (catalogItemsResult.error) throw catalogItemsResult.error;

    const data = {
      clients: clientsResult.data || [],
      tracks: tracksResult.data || [],
      trackStages: trackStagesResult.data || [],
      quotations: quotationsResult.data || [],
      quotationItems: quotationItemsResult.data || [],
      suppliers: suppliersResult.data || [],
      catalogItems: catalogItemsResult.data || []
    };

    console.log("Hierarchical data loaded:", {
      clients: data.clients.length,
      tracks: data.tracks.length,
      trackStages: data.trackStages.length,
      quotations: data.quotations.length,
      quotationItems: data.quotationItems.length,
      suppliers: data.suppliers.length,
      catalogItems: data.catalogItems.length
    });

    return data;
  } catch (error) {
    console.error("Error fetching hierarchical map data:", error);
    throw error;
  }
}

/**
 * Build hierarchical structure for CLIENT VIEW
 * Client → Projects → Quotations → Items → Suppliers
 */
export function buildClientHierarchy(data) {
  const { clients, tracks, trackStages, quotations, quotationItems, suppliers } = data;

  // Create lookup maps for performance
  const tracksByClient = {};
  const stagesByTrack = {};
  const quotationsByTrack = {};
  const itemsByQuotation = {};
  const suppliersMap = {};

  // Build supplier map
  suppliers.forEach(s => {
    suppliersMap[s.id] = s;
  });

  // Group tracks by client
  tracks.forEach(track => {
    if (!tracksByClient[track.client_id]) {
      tracksByClient[track.client_id] = [];
    }
    tracksByClient[track.client_id].push(track);
  });

  // Group stages by track
  trackStages.forEach(stage => {
    if (!stagesByTrack[stage.track_id]) {
      stagesByTrack[stage.track_id] = [];
    }
    stagesByTrack[stage.track_id].push(stage);
  });

  // Group quotations by track
  quotations.forEach(quotation => {
    if (!quotationsByTrack[quotation.track_id]) {
      quotationsByTrack[quotation.track_id] = [];
    }
    quotationsByTrack[quotation.track_id].push(quotation);
  });

  // Group items by quotation
  quotationItems.forEach(item => {
    if (!itemsByQuotation[item.quotation_id]) {
      itemsByQuotation[item.quotation_id] = [];
    }
    itemsByQuotation[item.quotation_id].push(item);
  });

  // Build hierarchy
  const hierarchy = clients.map(client => ({
    ...client,
    type: 'client',
    projects: (tracksByClient[client.id] || []).map(track => ({
      ...track,
      type: 'project',
      stages: stagesByTrack[track.id] || [],
      currentStage: (stagesByTrack[track.id] || []).find(s => s.status === 'in_progress'),
      quotations: (quotationsByTrack[track.id] || []).map(quotation => ({
        ...quotation,
        type: 'quotation',
        items: (itemsByQuotation[quotation.id] || []).map(item => ({
          ...item,
          type: quotation.type === 'product' ? 'product' : 'service',
          supplier: item.supplier_id ? suppliersMap[item.supplier_id] : null
        }))
      }))
    }))
  }));

  return hierarchy;
}

/**
 * Build hierarchical structure for SUPPLIER VIEW
 * Supplier → Items → Quotations → Projects → Clients
 */
export function buildSupplierHierarchy(data) {
  const { clients, tracks, trackStages, quotations, quotationItems, suppliers } = data;

  // Create lookup maps
  const clientsMap = {};
  const tracksMap = {};
  const quotationsMap = {};
  const stagesByTrack = {};
  const itemsBySupplier = {};

  // Build maps
  clients.forEach(c => {
    clientsMap[c.id] = c;
  });

  tracks.forEach(t => {
    tracksMap[t.id] = t;
  });

  quotations.forEach(q => {
    quotationsMap[q.id] = q;
  });

  trackStages.forEach(stage => {
    if (!stagesByTrack[stage.track_id]) {
      stagesByTrack[stage.track_id] = [];
    }
    stagesByTrack[stage.track_id].push(stage);
  });

  // Group items by supplier
  quotationItems.forEach(item => {
    if (item.supplier_id) {
      if (!itemsBySupplier[item.supplier_id]) {
        itemsBySupplier[item.supplier_id] = [];
      }
      itemsBySupplier[item.supplier_id].push(item);
    }
  });

  // Build hierarchy
  const hierarchy = suppliers.map(supplier => {
    const items = (itemsBySupplier[supplier.id] || []).map(item => {
      const quotation = quotationsMap[item.quotation_id];
      const track = quotation ? tracksMap[quotation.track_id] : null;
      const client = track ? clientsMap[track.client_id] : null;
      const stages = track ? (stagesByTrack[track.id] || []) : [];

      return {
        ...item,
        type: 'product',
        quotation: quotation ? {
          ...quotation,
          type: 'quotation',
          project: track ? {
            ...track,
            type: 'project',
            stages: stages,
            currentStage: stages.find(s => s.status === 'in_progress'),
            client: client ? {
              ...client,
              type: 'client'
            } : null
          } : null
        } : null
      };
    });

    return {
      ...supplier,
      type: 'supplier',
      products: items
    };
  });

  return hierarchy;
}

/**
 * Node type colors
 */
export const NODE_COLORS = {
  client: "#3B82F6",     // blue
  project: "#10B981",    // green
  quotation: "#F59E0B",  // amber
  product: "#8B5CF6",    // purple
  service: "#06B6D4",    // cyan
  supplier: "#F97316"    // orange
};

/**
 * Get status color
 */
export function getStatusColor(status) {
  const colors = {
    active: "#10B981",
    in_progress: "#3B82F6",
    completed: "#6B7280",
    cancelled: "#EF4444",
    blocked: "#DC2626",
    not_started: "#9CA3AF",
    done: "#059669"
  };
  return colors[status] || "#6B7280";
}
