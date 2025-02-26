<script setup>
import { ref, defineProps, computed, watch, watchEffect, onMounted, nextTick } from 'vue';
import { VueFlow, useVueFlow, MarkerType, Position, Handle } from '@vue-flow/core';
import { MiniMap } from '@vue-flow/minimap'
import { v4 as uuidv4 } from 'uuid';
import '@vue-flow/minimap/dist/style.css'

const props = defineProps({
  content: { type: Object, required: true },
});

const emit = defineEmits(["update:content", "trigger-event"]);
const { 
  findNode, 
  onConnect, 
  onNodesChange,
  addEdges, 
  removeEdges,
  project, 
  getEdges, 
  getNodes, 
  fitView 
} = useVueFlow();

const highlightedNode = ref(null);
const highlightedEdges = ref([]);
const deactivatedNodes = ref(new Set());
const isDragging = ref(false);

const nodes = ref([]);
const edges = ref([]);

// Separate references for LCA tree
const lcaNodes = ref([]);
const lcaEdges = ref([]);

// Track user-created connections
const userCreatedEdges = ref([]);

// Helper function to check if a node is a leaf node (no children or all children deactivated)
const isLeafNode = (nodeId) => {
  const node = props.content.data?.find(n => String(n.id) === nodeId);
  if (!node) return true;
  
  // If no child_variant_ids, it's a leaf node
  if (!node.child_variant_ids || node.child_variant_ids.length === 0) return true;
  
  // If all children are deactivated, it's a leaf node
  return node.child_variant_ids.every(childId => 
    deactivatedNodes.value.has(String(childId))
  );
};

// Helper function to get all descendant nodes
const getAllDescendants = (nodeId) => {
  const descendants = new Set();
  
  const addChildren = (id) => {
    const node = props.content.data?.find(n => String(n.id) === id);
    if (!node || !node.child_variant_ids) return;
    
    node.child_variant_ids.forEach(childId => {
      const childIdStr = String(childId);
      descendants.add(childIdStr);
      addChildren(childIdStr);
    });
  };
  
  addChildren(nodeId);
  return descendants;
};

// Helper function to calculate node positions with better spacing for org chart tree
const calculateNodePositions = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  
  // Create a map of nodes by ID for easier access
  const nodesById = {};
  data.forEach(node => {
    nodesById[node.id] = { ...node, children: [] };
  });
  
  // Build the tree structure by identifying children for each node
  data.forEach(node => {
    if (node.parent_id && nodesById[node.parent_id]) {
      nodesById[node.parent_id].children.push(node.id);
    }
  });
  
  // Constants for spacing
  const spacingX = 250;  // Horizontal spacing between siblings
  const spacingYBase = 150;  // Vertical spacing between ranks
  const baseX = 300;  // Root X position
  
  // Function to calculate subtree width
  const calculateSubtreeWidth = (nodeId) => {
    const node = nodesById[nodeId];
    if (!node.children.length) return spacingX; // Leaf node width
    
    // Sum the widths of all children subtrees
    return node.children.reduce((sum, childId) => sum + calculateSubtreeWidth(childId), 0);
  };
  
  // First pass: Calculate horizontal positions in a bottom-up approach
  const calculateXPosition = (nodeId, leftBoundary) => {
    const node = nodesById[nodeId];
    
    if (!node.children.length) {
      // Leaf node - position at the given boundary
      node.xPos = leftBoundary + spacingX / 2;
      return node.xPos;
    }
    
    let currentX = leftBoundary;
    const childPositions = [];
    
    // Position all children first
    node.children.forEach(childId => {
      const childWidth = calculateSubtreeWidth(childId);
      const childCenter = calculateXPosition(childId, currentX);
      childPositions.push(childCenter);
      currentX += childWidth;
    });
    
    // Position parent centered over its children
    if (childPositions.length) {
      const firstChild = childPositions[0];
      const lastChild = childPositions[childPositions.length - 1];
      node.xPos = (firstChild + lastChild) / 2;
    } else {
      node.xPos = leftBoundary + spacingX / 2;
    }
    
    return node.xPos;
  };
  
  // Start positioning from the root(s)
  const rootNodes = data.filter(node => !node.parent_id || !nodesById[node.parent_id]);
  let currentX = baseX - (calculateSubtreeWidth(rootNodes[0]?.id || 0) / 2);
  
  rootNodes.forEach(rootNode => {
    const rootWidth = calculateSubtreeWidth(rootNode.id);
    calculateXPosition(rootNode.id, currentX);
    currentX += rootWidth;
  });
  
  // Set vertical positions based on rank
  data.forEach(node => {
    const rank = node.rank || 0;
    nodesById[node.id].yPos = rank * spacingYBase;
  });
  
  // Create final node objects for Vue Flow
  return data.map(node => {
    const nodeData = nodesById[node.id];
    const stringNodeId = String(node.id);
    const isHighlighted = highlightedNode.value === stringNodeId;
    const isDeactivated = deactivatedNodes.value.has(stringNodeId);
    
    // Create the node with HTML content for structured layout
    return {
      id: stringNodeId,
      position: { 
        x: nodeData.xPos || baseX, 
        y: nodeData.yPos || 0 
      },
      // Use a structured node data format with product name, company name, and country ISO array
      data: { 
        productName: node.name, 
        companyName: node.company_name,
        // Handle both array and single value formats for country codes
        countryCodes: Array.isArray(node.country_iso) 
          ? node.country_iso 
          : (node.country_iso ? [node.country_iso] : []),
        isDeactivated: isDeactivated
      },
      // Allow connectable if it's a leaf node
      connectable: isLeafNode(stringNodeId) && !isDeactivated,
      draggable: false,
      style: {
        backgroundColor: isDeactivated ? "#cccccc" : (isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db"),
        color: isDeactivated ? "#666666" : "#fff",
        padding: "8px",
        borderRadius: "4px",
        textAlign: "center",
        border: `2px solid ${isDeactivated ? "#999999" : (isHighlighted ? "#DE0030" : "#000")}`,
        cursor: "pointer",
        width: "200px",
        fontFamily: "Nunito, sans-serif",
        fontWeight: "500",
        opacity: isDeactivated ? 0.7 : 1
      },
      // Use custom node with HTML template
      type: "customNode",
      // Add sources/targets for connections
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top
    };
  });
};

// Helper function to calculate LCA tree node positions from highest rank to lowest
const calculateLcaNodePositions = (lcaData) => {
  if (!lcaData || !Array.isArray(lcaData) || lcaData.length === 0) return [];
  
  // Sort by rank in descending order (highest rank first)
  const sortedData = [...lcaData].sort((a, b) => b.rank - a.rank);
  
  // Create a map for organizing nodes by rank
  const nodesByRank = {};
  let maxRank = 0;
  
  // Group nodes by rank
  sortedData.forEach(node => {
    const rank = node.rank || 0;
    if (!nodesByRank[rank]) {
      nodesByRank[rank] = [];
    }
    nodesByRank[rank].push(node);
    maxRank = Math.max(maxRank, rank);
  });
  
  // Constants for spacing
  const spacingX = 250;  // Horizontal spacing between siblings
  const spacingYBase = 150;  // Vertical spacing between ranks
  const baseX = 900;  // Starting X position for LCA tree
  
  // Create final LCA node objects for Vue Flow
  const lcaNodes = [];
  let nodeId = 1000; // Start IDs from 1000 to avoid conflicts with org chart
  
  // Create parent-child relationships
  const edges = [];
  
  // Process each rank level
  for (let rank = maxRank; rank >= 1; rank--) {
    const nodesInRank = nodesByRank[rank] || [];
    const totalWidth = nodesInRank.length * spacingX;
    let startX = baseX - (totalWidth / 2) + (spacingX / 2);
    
    // Position nodes at this rank
    nodesInRank.forEach((node, index) => {
      const x = startX + (index * spacingX);
      const y = (maxRank - rank) * spacingYBase; // Invert Y axis
      
      // Create a unique string ID
      const stringNodeId = `lca-${nodeId}`;
      node._id = stringNodeId;
      nodeId++;
      
      // Add node
      lcaNodes.push({
        id: stringNodeId,
        position: { x, y },
        data: { 
          processName: node.nomenclature_process?.name_eng || "Unknown Process",
          processType: node.nomenclature_process?.sector || "unknown",
          country: node.country || "",
          originalData: node // Store original data for reference
        },
        draggable: false,
        // Make LCA nodes connectable for custom connections
        connectable: true,
        style: {
          backgroundColor: "#34495e", // Different color from org chart
          color: "#fff",
          padding: "8px",
          borderRadius: "4px",
          textAlign: "center",
          border: "2px solid #000",
          cursor: "pointer",
          width: "200px",
          fontFamily: "Nunito, sans-serif",
          fontWeight: "500"
        },
        type: "lcaNode",
        // Add source/target positions for better connections
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top
      });
      
      // Connect to next rank if not the lowest rank
      if (rank > 1) {
        // Connect to all nodes in the rank below
        // For last rank (1), simply connect to all nodes in rank 2
        const lowerRank = rank - 1;
        const lowerRankNodes = nodesByRank[lowerRank] || [];
        
        if (lowerRankNodes.length > 0) {
          lowerRankNodes.forEach(targetNode => {
            // We'll add these edges later when all nodes are created
            node._hasTargets = true;
          });
        }
      }
    });
  }
  
  // Now create all edges based on rank
  for (let rank = maxRank; rank > 1; rank--) {
    const sourceNodes = nodesByRank[rank] || [];
    const targetNodes = nodesByRank[rank-1] || [];
    
    if (sourceNodes.length && targetNodes.length) {
      sourceNodes.forEach(sourceNode => {
        targetNodes.forEach(targetNode => {
          edges.push({
            id: `e-lca-${sourceNode._id}-${targetNode._id}`,
            source: sourceNode._id,
            target: targetNode._id,
            animated: false,
            style: {
              stroke: props.content.lcaEdgeColor || "#34495e",
              strokeWidth: 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 15,
              height: 15,
              color: props.content.lcaEdgeColor || "#34495e",
            },
          });
        });
      });
    }
  }
  
  return { nodes: lcaNodes, edges };
};

// Helper function to update highlighting consistently
const updateHighlighting = (nodeId) => {
  if (!nodeId) return;
  
  // Ensure nodeId is a string and update highlighted state
  const stringNodeId = String(nodeId);
  console.log("Updating highlighting for node:", stringNodeId);
  
  highlightedNode.value = stringNodeId;
  highlightedEdges.value = edges.value
    .filter((edge) => edge.source === stringNodeId || edge.target === stringNodeId)
    .map((edge) => edge.id);

  // Update nodes with string comparison
  nodes.value = nodes.value.map(node => {
    const isHighlighted = node.id === stringNodeId;
    const isDeactivated = deactivatedNodes.value.has(node.id);
    
    return {
      ...node,
      connectable: isLeafNode(node.id) && !isDeactivated,
      data: {
        ...node.data,
        isDeactivated: isDeactivated
      },
      style: {
        ...node.style,
        backgroundColor: isDeactivated ? "#cccccc" : (isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db"),
        color: isDeactivated ? "#666666" : "#fff",
        border: `2px solid ${isDeactivated ? "#999999" : (isHighlighted ? "#DE0030" : "#000")}`,
        opacity: isDeactivated ? 0.7 : 1
      },
    };
  });

  // Update edges with string comparison
  edges.value = edges.value.map(edge => {
    const isHighlighted = edge.source === stringNodeId || edge.target === stringNodeId;
    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: isHighlighted ? "#DE0030" : props.content.edgeColor || "#000",
        strokeWidth: isHighlighted ? 3 : 1.5,
      },
      animated: !isHighlighted,
    };
  });

  // Focus camera on the selected node
  nextTick(() => {
    fitView({ duration: 500, padding: 0.2 });
  });
};

// Function to toggle node activation state
const toggleNodeActivation = (nodeId) => {
  if (!nodeId) return;
  
  const stringNodeId = String(nodeId);
  console.log(`Toggling activation for node: ${stringNodeId}`);
  
  // If the node is deactivated, activate it
  if (deactivatedNodes.value.has(stringNodeId)) {
    deactivatedNodes.value.delete(stringNodeId);
  } else {
    // If the node is activated, deactivate it and all its descendants
    deactivatedNodes.value.add(stringNodeId);
    
    // Get all descendants and deactivate them
    const descendants = getAllDescendants(stringNodeId);
    descendants.forEach(descendantId => {
      deactivatedNodes.value.add(descendantId);
    });
    
    // Remove any connections to/from this node and its descendants
    removeConnectionsToDeactivatedNodes([stringNodeId, ...descendants]);
  }
  
  // Update nodes to reflect activation state changes
  updateNodesActivationState();
  
  // Emit the updated deactivated nodes
  emitStateUpdate();
};

// Function to remove connections to/from deactivated nodes
const removeConnectionsToDeactivatedNodes = (nodeIds) => {
  // Get all current edges
  const currentEdges = [...edges.value, ...lcaEdges.value, ...userCreatedEdges.value];
  
  // Find edges that connect to any of the deactivated nodes
  const edgesToRemove = currentEdges.filter(edge => 
    nodeIds.includes(edge.source) || nodeIds.includes(edge.target)
  );
  
  // Remove these edges
  if (edgesToRemove.length > 0) {
    removeEdges(edgesToRemove);
    
    // Also remove from userCreatedEdges
    userCreatedEdges.value = userCreatedEdges.value.filter(edge => 
      !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
    );
  }
};

// Function to update nodes activation state
const updateNodesActivationState = () => {
  // Update org chart nodes
  nodes.value = nodes.value.map(node => {
    const isDeactivated = deactivatedNodes.value.has(node.id);
    const isHighlighted = highlightedNode.value === node.id;
    
    return {
      ...node,
      connectable: isLeafNode(node.id) && !isDeactivated,
      data: {
        ...node.data,
        isDeactivated: isDeactivated
      },
      style: {
        ...node.style,
        backgroundColor: isDeactivated ? "#cccccc" : (isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db"),
        color: isDeactivated ? "#666666" : "#fff",
        border: `2px solid ${isDeactivated ? "#999999" : (isHighlighted ? "#DE0030" : "#000")}`,
        opacity: isDeactivated ? 0.7 : 1
      },
    };
  });
};

// Function to handle new connections
const handleConnect = (params) => {
  // Validate connection
  const sourceNode = findNode(params.source);
  const targetNode = findNode(params.target);
  
  // Don't allow connections to deactivated nodes
  if (!sourceNode || !targetNode) return;
  if (sourceNode.data.isDeactivated || targetNode.data.isDeactivated) return;
  
  // Create a unique ID for the edge
  const edgeId = `e-user-${params.source}-${params.target}-${uuidv4().slice(0, 8)}`;
  
  // Create the new edge
  const newEdge = {
    id: edgeId,
    source: params.source,
    target: params.target,
    animated: false,
    data: { userCreated: true },
    style: {
      stroke: "#2ecc71", // Distinct color for user-created connections
      strokeWidth: 2,
      strokeDasharray: "5, 5" // Dashed line for user connections
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 15,
      height: 15,
      color: "#2ecc71",
    },
  };
  
  // Add the edge to the flow
  addEdges([newEdge]);
  
  // Track user-created edges
  userCreatedEdges.value.push(newEdge);
  
  // Emit state update
  emitStateUpdate();
};

// Function to emit state update to parent
const emitStateUpdate = () => {
  const updatedContent = {
    ...props.content,
    deactivatedNodes: Array.from(deactivatedNodes.value),
    userConnections: userCreatedEdges.value.map(edge => ({
      source: edge.source,
      target: edge.target,
      id: edge.id
    }))
  };
  
  emit("update:content", updatedContent);
};

// Compute Org Chart Nodes using improved positioning algorithm
watchEffect(() => {
  if (!props.content.data || !Array.isArray(props.content.data)) {
    console.log("No nodes available for org chart");
    nodes.value = [];
    return;
  }
  
  nodes.value = calculateNodePositions(props.content.data);
});

// Compute Org Chart Edges
watchEffect(() => {
  if (!props.content.data || !Array.isArray(props.content.data)) {
    console.log("No edges available for org chart");
    edges.value = [];
    return;
  }

  edges.value = props.content.data.flatMap((item) => {
    if (deactivatedNodes.value.has(String(item.id))) {
      // Don't create edges from deactivated nodes
      return [];
    }
    
    return item.child_variant_ids?.map((childId) => {
      const stringItemId = String(item.id);
      const stringChildId = String(childId);
      
      // Skip if child is deactivated
      if (deactivatedNodes.value.has(stringChildId)) {
        return null;
      }
      
      const isHighlighted = highlightedNode.value === stringItemId || highlightedNode.value === stringChildId;
      
      return {
        id: `e${stringItemId}-${stringChildId}`,
        source: stringItemId,
        target: stringChildId,
        animated: !isHighlighted,
        style: {
          stroke: isHighlighted ? "#DE0030" : props.content.edgeColor || "#000",
          strokeWidth: isHighlighted ? 3 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: isHighlighted ? "#DE0030" : props.content.edgeColor || "#000",
        },
      };
    }).filter(Boolean) || [];
  });
});

// Compute LCA tree nodes and edges
watchEffect(() => {
  if (!props.content.lcaData || !Array.isArray(props.content.lcaData)) {
    console.log("No LCA data available");
    lcaNodes.value = [];
    lcaEdges.value = [];
    return;
  }
  
  const lcaResult = calculateLcaNodePositions(props.content.lcaData);
  lcaNodes.value = lcaResult.nodes;
  lcaEdges.value = lcaResult.edges;
});

// Initialize deactivated nodes from saved state
watch(() => props.content.deactivatedNodes, (newDeactivatedNodes) => {
  if (newDeactivatedNodes && Array.isArray(newDeactivatedNodes)) {
    deactivatedNodes.value = new Set(newDeactivatedNodes);
    updateNodesActivationState();
  }
}, { immediate: true });

// Initialize user connections from saved state
watch(() => props.content.userConnections, (newConnections) => {
  if (newConnections && Array.isArray(newConnections)) {
    // Create edges for saved connections
    const savedEdges = newConnections.map(conn => ({
      id: conn.id || `e-user-${conn.source}-${conn.target}-${uuidv4().slice(0, 8)}`,
      source: conn.source,
      target: conn.target,
      animated: false,
      data: { userCreated: true },
      style: {
        stroke: "#2ecc71", // Distinct color for user-created connections
        strokeWidth: 2,
        strokeDasharray: "5, 5" // Dashed line for user connections
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: "#2ecc71",
      },
    }));
    
    userCreatedEdges.value = savedEdges;
    
    // Add saved edges to the flow
    if (savedEdges.length > 0) {
      nextTick(() => {
        addEdges(savedEdges);
      });
    }
  }
}, { immediate: true });

// Combine all nodes and edges for both trees
const allNodes = computed(() => {
  return [...nodes.value, ...lcaNodes.value];
});

const allEdges = computed(() => {
  return [...edges.value, ...lcaEdges.value, ...userCreatedEdges.value];
});

// Handle Node Click
const handleNodeClick = (event) => {
  console.log("Click event:", event);
  const nodeId = event?.node?.id || null;
  if (!nodeId) return;

  console.log("Node clicked:", nodeId);
  
  // Only highlight org chart nodes, not LCA nodes
  if (!nodeId.startsWith('lca-')) {
    updateHighlighting(nodeId);

    // Fix: Properly structure the content update
    const updatedContent = {
      ...props.content,
      selectedNodeId: nodeId,
      selectedInWeWeb: nodeId
    };
    
    // Emit the content update
    emit("update:content", updatedContent);
    
    // Emit the trigger event for node click
    emit("trigger-event", {
      name: "node:click",
      event: {
        nodeId: nodeId
      }
    });
  } else {
    // Handle LCA node click
    const lcaNodeId = nodeId;
    
    // Emit the trigger event for LCA node click
    emit("trigger-event", {
      name: "lca-node:click",
      event: {
        nodeId: lcaNodeId
      }
    });
  }
};

// Handle activation/deactivation button click
const handleActivationToggle = () => {
  if (highlightedNode.value) {
    toggleNodeActivation(highlightedNode.value);
  }
};

// Watch for Changes from WeWeb Selection
watch(() => props.content.selectedInWeWeb, (newSelectedId) => {
  if (!newSelectedId) return;
  
  console.log(`🔄 External Selection Changed: Highlighting Node ${newSelectedId}`);
  updateHighlighting(newSelectedId);
});

// Handle edge removal (Delete key or button)
const handleEdgeRemove = (event) => {
  const selectedEdges = getEdges().filter(e => e.selected);
  
  if (selectedEdges.length > 0) {
    // Only allow removing user-created edges
    const userEdgesToRemove = selectedEdges.filter(edge => 
      edge.data?.userCreated
    );
    
    if (userEdgesToRemove.length > 0) {
      // Remove selected edges
      removeEdges(userEdgesToRemove);
      
      // Also remove from userCreatedEdges
      userCreatedEdges.value = userCreatedEdges.value.filter(edge => 
        !userEdgesToRemove.some(e => e.id === edge.id)
      );
      
      // Emit state update
      emitStateUpdate();
    }
  }
};

// Get flag emoji from ISO code
const getCountryFlag = (isoCode) => {
  if (!isoCode) return '';
  
  // Convert ISO code to regional indicator symbols
  // Each letter in the ISO code is converted to a regional indicator symbol (A-Z)
  // by adding 127397 to its UTF-16 code point value
  return Array.from(isoCode.toUpperCase())
    .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join('');
};

// Center the view on component mount
onMounted(() => {
  // Allow a short delay for the graph to render first
  setTimeout(() => {
    console.log("Dual Tree Chart Mounted - Fitting View", props.content);
    if (allNodes.value.length > 0) {
      fitView({ 
        padding: 0.5,
        includeHiddenNodes: false,
        duration: 800
      });
    }
  }, 300);
  
  // Add Nunito font to document if needed
  const nunitoFont = document.createElement('link');
  nunitoFont.rel = 'stylesheet';
  nunitoFont.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap';
  document.head.appendChild(nunitoFont);
  
  // Add Noto Color Emoji font for flags
  const emojiFontStyle = document.createElement('style');
  emojiFontStyle.textContent = `
    @font-face {
      font-family: 'NotoColorEmoji';
      src: url('https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/fonts/NotoColorEmoji.ttf') format('truetype');
      unicode-range: U+1F1E6-1F1FF; /* Range for country flag emojis */
      font-display: swap;
    }
  `;
  document.head.appendChild(emojiFontStyle);
  
  // Setup connection handling
  onConnect((params) => {
    handleConnect(params);
  });
  
  // Setup node change handling (for potential future drag support)
  onNodesChange((changes) => {
    console.log("Node changes:", changes);
  });
});

// Re-center when nodes change
watch(() => allNodes.value.length, (newLength, oldLength) => {
  if (newLength > 0) {
    nextTick(() => {
      fitView({ 
        padding: 0.5,
        includeHiddenNodes: false,
        duration: 800 
      });
    });
  }
});

// Setup keyboard handler for edge deletion
const handleKeyDown = (event) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    handleEdgeRemove();
  }
};
</script>

<template>
  <div class="dual-tree-container" :style="{ backgroundColor: content.backgroundColor || '#f4f4f4' }">
    <!-- Controls Panel -->
    <div class="controls-panel">
      <button 
        class="control-button toggle-activation" 
        @click="handleActivationToggle"
        :disabled="!highlightedNode"
        :class="{ 'disabled': !highlightedNode }">
        {{ deactivatedNodes.has(highlightedNode) ? 'Activate' : 'Deactivate' }} Node
      </button>
      <button 
        class="control-button remove-edge" 
        @click="handleEdgeRemove">
        Remove Selected Connection
      </button>
      <div class="instructions">
        <p>• Click a node to select it</p>
        <p>• Click the Activate/Deactivate button to toggle node state</p>
        <p>• Drag between nodes to create connections</p>
        <p>• Select a connection and click Remove to delete it</p>
      </div>
    </div>
    
    <VueFlow 
      :nodes="allNodes" 
      :edges="allEdges" 
      @nodeClick="handleNodeClick"
      :key="allNodes.length"
      :nodesDraggable="false"
      :edgesUpdatable="false"
      :edgesFocusable="true"
      :edgesSelectable="true"
      :edgesDraggable="false"
      :nodesConnectable="true"
      :connectOnClick="false"
      @keydown="handleKeyDown">
      
      <!-- Custom Node Template for Org Chart -->
      <template #node-customNode="{ data }">
  <div class="custom-node" :class="{ 'deactivated': data.isDeactivated }">
    <!-- Add source handle at the bottom -->
    <Handle 
      type="source" 
      :position="Position.Bottom" 
      :connectable="!data.isDeactivated"
    />
    
    <!-- Add target handle at the top -->
    <Handle 
      type="target" 
      :position="Position.Top" 
      :connectable="!data.isDeactivated"
    />
    
    <div class="product-name">{{ data.productName }}</div>
    <div class="company-name">{{ data.companyName }}</div>
    <div v-if="data.countryCodes && data.countryCodes.length > 0" class="country-flags">
      <span 
        v-for="(code, index) in data.countryCodes" 
        :key="index" 
        class="country-flag"
        :title="code.toUpperCase()">
        {{ getCountryFlag(code) }}
      </span>
    </div>
    <div v-if="data.isDeactivated" class="deactivated-badge">
      DEACTIVATED
    </div>
  </div>
</template>

<!-- Modified template for the lcaNode template -->
<template #node-lcaNode="{ data }">
  <div class="lca-node">
    <!-- Add source handle at the bottom -->
    <Handle type="source" :position="Position.Bottom" />
    
    <!-- Add target handle at the top -->
    <Handle type="target" :position="Position.Top" />
    
    <div class="process-name">{{ data.processName }}</div>
    <div class="process-type" :class="data.processType">{{ data.processType }}</div>
    <div v-if="data.country" class="country-flag">
      {{ getCountryFlag(data.country) }}
    </div>
  </div>
</template>
      
      <!-- Connection Line Template -->
      <template #connection-line="{ sourceX, sourceY, targetX, targetY }">
        <path
          :d="`M ${sourceX},${sourceY} L ${targetX},${targetY}`"
          class="animated connection-line"
          stroke="#2ecc71"
          stroke-width="2"
          stroke-dasharray="5, 5"
          fill="none"
        />
      </template>
      <MiniMap pannable zoomable />
    </VueFlow>
  </div>
</template>

<style lang="scss">
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

/* Flag emoji specific font-face for better cross-platform support */
@font-face {
  font-family: 'NotoColorEmoji';
  src: url('https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/fonts/NotoColorEmoji.ttf') format('truetype');
  unicode-range: U+1F1E6-1F1FF; /* Range for country flag emojis */
  font-display: swap;
}

.controls-panel {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 999;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 250px;
}

.dual-tree-container {
  height: 700px;
  width: 100%;
  font-family: 'Nunito', sans-serif;
}

.custom-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  
  .product-name {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
  }
  
  .company-name {
    font-size: 12px;
    font-weight: 400;
    margin-bottom: 8px;
  }
  
  .country-flags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 5px;
    margin-top: 4px;
    
    .country-flag {
      font-size: 20px;
      font-family: 'NotoColorEmoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
    }
  }
}

.lca-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  
  .process-name {
    font-size: 14px;
    font-weight: 500;
    margin-bottom: 4px;
  }
  
  .process-type {
    font-size: 12px;
    font-weight: 400;
    margin-bottom: 8px;
    padding: 2px 8px;
    border-radius: 10px;
    
    &.textile {
      background-color: #3498db;
    }
    
    &.plastic {
      background-color: #9b59b6;
    }
    
    &.generic {
      background-color: #2ecc71;
    }
    
    &.custom {
      background-color: #e74c3c;
    }
  }
  
  .country-flag {
    font-size: 20px;
    font-family: 'NotoColorEmoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
  }
}
</style>