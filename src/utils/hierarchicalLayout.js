/**
 * Create hierarchical layout for Client View
 * Client → Projects → Quotations → Items → Suppliers
 */
export function createClientHierarchicalLayout(hierarchy, options = {}) {
  const {
    nodeSpacing = 80,
    levelSpacing = 200,
    startX = 50,
    startY = 50
  } = options;

  const nodes = [];
  const edges = [];
  let yOffset = startY;

  hierarchy.forEach((client, clientIndex) => {
    // Create client node
    const clientNodeId = `client-${client.id}`;
    const clientX = startX;
    const clientY = yOffset;

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

    let projectYOffset = clientY;
    const projectX = clientX + levelSpacing;

    (client.projects || []).forEach((project, projectIndex) => {
      // Create project node
      const projectNodeId = `project-${project.id}`;
      const projectY = projectYOffset;

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

      // Edge from client to project
      edges.push({
        id: `${clientNodeId}-${projectNodeId}`,
        source: clientNodeId,
        target: projectNodeId,
        type: 'smoothstep',
        animated: project.status === 'active'
      });

      let quotationYOffset = projectY;
      const quotationX = projectX + levelSpacing;

      (project.quotations || []).forEach((quotation, quotationIndex) => {
        // Create quotation node
        const quotationNodeId = `quotation-${quotation.id}`;
        const quotationY = quotationYOffset;

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

        // Edge from project to quotation
        edges.push({
          id: `${projectNodeId}-${quotationNodeId}`,
          source: projectNodeId,
          target: quotationNodeId,
          type: 'smoothstep'
        });

        let itemYOffset = quotationY;
        const itemX = quotationX + levelSpacing;

        (quotation.items || []).forEach((item, itemIndex) => {
          // Create product/service node
          const itemNodeId = `item-${item.id}`;
          const itemY = itemYOffset;

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

          // Edge from quotation to item
          edges.push({
            id: `${quotationNodeId}-${itemNodeId}`,
            source: quotationNodeId,
            target: itemNodeId,
            type: 'smoothstep'
          });

          // If item has a supplier, create supplier node
          if (item.supplier) {
            const supplierNodeId = `supplier-${item.supplier.id}-${itemNodeId}`;
            const supplierX = itemX + levelSpacing;
            const supplierY = itemY;

            // Check if supplier node already exists
            const existingSupplier = nodes.find(n => n.id === `supplier-${item.supplier.id}`);

            if (!existingSupplier) {
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

              // Edge from item to supplier
              edges.push({
                id: `${itemNodeId}-${supplierNodeId}`,
                source: itemNodeId,
                target: supplierNodeId,
                type: 'smoothstep'
              });
            } else {
              // Connect to existing supplier
              edges.push({
                id: `${itemNodeId}-${existingSupplier.id}`,
                source: itemNodeId,
                target: existingSupplier.id,
                type: 'smoothstep'
              });
            }
          }

          itemYOffset += nodeSpacing;
        });

        quotationYOffset = itemYOffset + nodeSpacing;
      });

      projectYOffset = quotationYOffset + nodeSpacing;
    });

    yOffset = projectYOffset + nodeSpacing * 2;
  });

  return { nodes, edges };
}

/**
 * Create hierarchical layout for Supplier View
 * Supplier → Products → Quotations → Projects → Clients
 */
export function createSupplierHierarchicalLayout(hierarchy, options = {}) {
  const {
    nodeSpacing = 80,
    levelSpacing = 200,
    startX = 50,
    startY = 50
  } = options;

  const nodes = [];
  const edges = [];
  const createdNodes = new Set(); // Track created nodes to avoid duplicates
  let yOffset = startY;

  hierarchy.forEach((supplier, supplierIndex) => {
    // Create supplier node
    const supplierNodeId = `supplier-${supplier.id}`;
    const supplierX = startX;
    const supplierY = yOffset;

    nodes.push({
      id: supplierNodeId,
      type: 'supplier',
      position: { x: supplierX, y: supplierY },
      data: {
        label: supplier.name,
        productCount: supplier.products?.length || 0,
        ...supplier,
        onClick: () => console.log('Supplier clicked:', supplier)
      }
    });
    createdNodes.add(supplierNodeId);

    let productYOffset = supplierY;
    const productX = supplierX + levelSpacing;

    (supplier.products || []).forEach((product, productIndex) => {
      // Create product node
      const productNodeId = `product-${product.id}`;
      const productY = productYOffset;

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

      // Edge from supplier to product
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

        // Create quotation node if not exists
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

        // Edge from product to quotation
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

          // Create project node if not exists
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

          // Edge from quotation to project
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

            // Create client node if not exists
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

            // Edge from project to client
            edges.push({
              id: `${projectNodeId}-${clientNodeId}`,
              source: projectNodeId,
              target: clientNodeId,
              type: 'smoothstep'
            });
          }
        }
      }

      productYOffset += nodeSpacing;
    });

    yOffset = productYOffset + nodeSpacing * 2;
  });

  return { nodes, edges };
}
