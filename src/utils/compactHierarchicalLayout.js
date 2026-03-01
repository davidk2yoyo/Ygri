/**
 * Compact hierarchical layout with grid-based client positioning
 * and filtering support
 */

/**
 * Get single item from hierarchy by ID (for focused view)
 */
export function getSingleItemHierarchy(hierarchy, itemId, viewMode = 'client') {
  if (!itemId) return hierarchy;

  const item = hierarchy.find(h => h.id === itemId);
  return item ? [item] : [];
}

/**
 * Filter hierarchy based on search query
 */
export function filterHierarchy(hierarchy, searchQuery, viewMode = 'client') {
  if (!searchQuery || !searchQuery.trim()) {
    return hierarchy;
  }

  const query = searchQuery.toLowerCase().trim();

  if (viewMode === 'client') {
    // Filter clients and their nested data
    return hierarchy
      .map(client => {
        // Check if client matches
        const clientMatches = client.company_name?.toLowerCase().includes(query) ||
                             client.contact_person?.toLowerCase().includes(query);

        // Filter projects
        const filteredProjects = (client.projects || [])
          .map(project => {
            const projectMatches = project.name?.toLowerCase().includes(query);

            // Filter quotations
            const filteredQuotations = (project.quotations || [])
              .filter(quotation =>
                quotation.quote_number?.toLowerCase().includes(query) ||
                quotation.notes?.toLowerCase().includes(query)
              );

            // Keep project if it or its quotations match
            if (projectMatches || filteredQuotations.length > 0) {
              return {
                ...project,
                quotations: filteredQuotations.length > 0 ? filteredQuotations : project.quotations
              };
            }
            return null;
          })
          .filter(Boolean);

        // Keep client if it or its projects match
        if (clientMatches || filteredProjects.length > 0) {
          return {
            ...client,
            projects: filteredProjects.length > 0 ? filteredProjects : client.projects
          };
        }
        return null;
      })
      .filter(Boolean);
  } else {
    // Filter suppliers
    return hierarchy
      .filter(supplier =>
        supplier.name?.toLowerCase().includes(query) ||
        supplier.email?.toLowerCase().includes(query) ||
        supplier.sales_person?.toLowerCase().includes(query)
      );
  }
}

/**
 * Create compact Client View layout with grid
 */
export function createCompactClientLayout(hierarchy, options = {}) {
  const {
    nodeSpacing = 100,      // Increased from 50 to 100
    levelSpacing = 300,     // Increased from 220 to 300
    startX = 50,
    startY = 50,
    maxClientsPerRow = 3
  } = options;

  const nodes = [];
  const edges = [];

  // Calculate compact grid
  const clientColumnWidth = levelSpacing * 5; // Increased from 4 to 5
  const rowHeight = 250; // Increased from 150 to 250

  hierarchy.forEach((client, clientIndex) => {
    const row = Math.floor(clientIndex / maxClientsPerRow);
    const col = clientIndex % maxClientsPerRow;

    const clientX = startX + (col * clientColumnWidth);
    let currentY = startY + (row * rowHeight);

    // Create client node
    const clientNodeId = `client-${client.id}`;

    nodes.push({
      id: clientNodeId,
      type: 'client',
      position: { x: clientX, y: currentY },
      data: {
        label: client.company_name,
        ...client,
        onClick: () => console.log('Client clicked:', client)
      }
    });

    // Layout projects horizontally from this client
    (client.projects || []).forEach((project, projectIndex) => {
      const projectNodeId = `project-${project.id}`;
      const projectX = clientX + levelSpacing;
      const projectY = currentY + (projectIndex * nodeSpacing);

      const currentStage = project.currentStage;
      const stageCount = project.stages?.length || 0;
      const completedStages = project.stages?.filter(s => s.status === 'done').length || 0;

      nodes.push({
        id: projectNodeId,
        type: 'project',
        position: { x: projectX, y: projectY },
        data: {
          label: project.name,
          status: project.status,
          currentStage: currentStage?.name,
          progress: stageCount > 0 ? Math.round((completedStages / stageCount) * 100) : 0,
          stageCount,
          ...project,
          onClick: () => console.log('Project clicked:', project)
        }
      });

      edges.push({
        id: `${clientNodeId}-${projectNodeId}`,
        source: clientNodeId,
        target: projectNodeId,
        type: 'smoothstep',
        animated: project.status === 'active'
      });

      // Quotations for this project
      (project.quotations || []).forEach((quotation, quotationIndex) => {
        const quotationNodeId = `quotation-${quotation.id}`;
        const quotationX = projectX + levelSpacing;
        const quotationY = projectY + (quotationIndex * 80); // Increased from 40 to 80

        nodes.push({
          id: quotationNodeId,
          type: 'quotation',
          position: { x: quotationX, y: quotationY },
          data: {
            label: quotation.quote_number,
            ...quotation,
            onClick: () => console.log('Quotation clicked:', quotation)
          }
        });

        edges.push({
          id: `${projectNodeId}-${quotationNodeId}`,
          source: projectNodeId,
          target: quotationNodeId,
          type: 'smoothstep'
        });

        // Items for this quotation
        (quotation.items || []).forEach((item, itemIndex) => {
          const itemNodeId = `item-${item.id}`;
          const itemX = quotationX + levelSpacing;
          const itemY = quotationY + (itemIndex * 70); // Increased from 35 to 70

          nodes.push({
            id: itemNodeId,
            type: 'product',
            position: { x: itemX, y: itemY },
            data: {
              label: item.description || item.item_number,
              ...item,
              onClick: () => console.log('Item clicked:', item)
            }
          });

          edges.push({
            id: `${quotationNodeId}-${itemNodeId}`,
            source: quotationNodeId,
            target: itemNodeId,
            type: 'smoothstep'
          });

          // Supplier if exists
          if (item.supplier) {
            const supplierNodeId = `supplier-${item.supplier.id}`;
            const supplierX = itemX + levelSpacing;
            const supplierY = itemY;

            // Only add if not already added
            if (!nodes.find(n => n.id === supplierNodeId)) {
              nodes.push({
                id: supplierNodeId,
                type: 'supplier',
                position: { x: supplierX, y: supplierY },
                data: {
                  label: item.supplier.name,
                  ...item.supplier,
                  onClick: () => console.log('Supplier clicked:', item.supplier)
                }
              });
            }

            edges.push({
              id: `${itemNodeId}-${supplierNodeId}`,
              source: itemNodeId,
              target: supplierNodeId,
              type: 'smoothstep'
            });
          }
        });
      });
    });
  });

  return { nodes, edges };
}

/**
 * Create compact Supplier View layout with grid
 */
export function createCompactSupplierLayout(hierarchy, options = {}) {
  const {
    nodeSpacing = 100,     // Increased from 50 to 100
    levelSpacing = 300,    // Increased from 220 to 300
    startX = 50,
    startY = 50,
    maxSuppliersPerRow = 3
  } = options;

  const nodes = [];
  const edges = [];
  const createdNodes = new Set();

  const supplierColumnWidth = levelSpacing * 5; // Increased from 4 to 5
  const rowHeight = 250; // Increased from 150 to 250

  hierarchy.forEach((supplier, supplierIndex) => {
    const row = Math.floor(supplierIndex / maxSuppliersPerRow);
    const col = supplierIndex % maxSuppliersPerRow;

    const supplierX = startX + (col * supplierColumnWidth);
    let currentY = startY + (row * rowHeight);

    const supplierNodeId = `supplier-${supplier.id}`;

    nodes.push({
      id: supplierNodeId,
      type: 'supplier',
      position: { x: supplierX, y: currentY },
      data: {
        label: supplier.name,
        productCount: supplier.products?.length || 0,
        ...supplier,
        onClick: () => console.log('Supplier clicked:', supplier)
      }
    });
    createdNodes.add(supplierNodeId);

    // Products
    (supplier.products || []).forEach((product, productIndex) => {
      const productNodeId = `product-${product.id}`;
      const productX = supplierX + levelSpacing;
      const productY = currentY + (productIndex * nodeSpacing);

      nodes.push({
        id: productNodeId,
        type: 'product',
        position: { x: productX, y: productY },
        data: {
          label: product.description || product.item_number,
          ...product,
          onClick: () => console.log('Product clicked:', product)
        }
      });

      edges.push({
        id: `${supplierNodeId}-${productNodeId}`,
        source: supplierNodeId,
        target: productNodeId,
        type: 'smoothstep'
      });

      if (product.quotation) {
        const quotation = product.quotation;
        const quotationNodeId = `quotation-${quotation.id}`;
        const quotationX = productX + levelSpacing;
        const quotationY = productY;

        if (!createdNodes.has(quotationNodeId)) {
          nodes.push({
            id: quotationNodeId,
            type: 'quotation',
            position: { x: quotationX, y: quotationY },
            data: {
              label: quotation.quote_number,
              ...quotation,
              onClick: () => console.log('Quotation clicked:', quotation)
            }
          });
          createdNodes.add(quotationNodeId);
        }

        edges.push({
          id: `${productNodeId}-${quotationNodeId}`,
          source: productNodeId,
          target: quotationNodeId,
          type: 'smoothstep'
        });

        if (quotation.project) {
          const project = quotation.project;
          const projectNodeId = `project-${project.id}`;
          const projectX = quotationX + levelSpacing;
          const projectY = quotationY;

          if (!createdNodes.has(projectNodeId)) {
            const stageCount = project.stages?.length || 0;
            const completedStages = project.stages?.filter(s => s.status === 'done').length || 0;

            nodes.push({
              id: projectNodeId,
              type: 'project',
              position: { x: projectX, y: projectY },
              data: {
                label: project.name,
                status: project.status,
                currentStage: project.currentStage?.name,
                progress: stageCount > 0 ? Math.round((completedStages / stageCount) * 100) : 0,
                stageCount,
                ...project,
                onClick: () => console.log('Project clicked:', project)
              }
            });
            createdNodes.add(projectNodeId);
          }

          edges.push({
            id: `${quotationNodeId}-${projectNodeId}`,
            source: quotationNodeId,
            target: projectNodeId,
            type: 'smoothstep'
          });

          if (project.client) {
            const client = project.client;
            const clientNodeId = `client-${client.id}`;
            const clientX = projectX + levelSpacing;
            const clientY = projectY;

            if (!createdNodes.has(clientNodeId)) {
              nodes.push({
                id: clientNodeId,
                type: 'client',
                position: { x: clientX, y: clientY },
                data: {
                  label: client.company_name,
                  ...client,
                  onClick: () => console.log('Client clicked:', client)
                }
              });
              createdNodes.add(clientNodeId);
            }

            edges.push({
              id: `${projectNodeId}-${clientNodeId}`,
              source: projectNodeId,
              target: clientNodeId,
              type: 'smoothstep'
            });
          }
        }
      }
    });
  });

  return { nodes, edges };
}
