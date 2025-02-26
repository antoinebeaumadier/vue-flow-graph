<script setup>
import { ref, defineProps, computed, watch, watchEffect, onMounted, nextTick } from 'vue';
import { VueFlow, useVueFlow, MarkerType } from '@vue-flow/core';

const props = defineProps({
  content: { type: Object, required: true },
});

const emit = defineEmits(["update:content", "trigger-event"]);
const { fitView } = useVueFlow();

const highlightedNode = ref(null);
const highlightedEdges = ref([]);

const nodes = ref([]);
const edges = ref([]);

// Separate references for LCA tree
const lcaNodes = ref([]);
const lcaEdges = ref([]);

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
          : (node.country_iso ? [node.country_iso] : [])
      },
      draggable: false,
      style: {
        backgroundColor: isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db",
        color: "#fff",
        padding: "8px",
        borderRadius: "4px",
        textAlign: "center",
        border: `2px solid ${isHighlighted ? "#DE0030" : "#000"}`,
        cursor: "pointer",
        width: "200px",
        fontFamily: "Nunito, sans-serif",
        fontWeight: "500"
      },
      // Use custom node with HTML template
      type: "customNode",
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
          country: node.country || ""
        },
        draggable: false,
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
    return {
      ...node,
      style: {
        ...node.style,
        backgroundColor: isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db",
        border: `2px solid ${isHighlighted ? "#DE0030" : "#000"}`,
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

  edges.value = props.content.data.flatMap((item) =>
    item.child_variant_ids?.map((childId) => {
      const stringItemId = String(item.id);
      const stringChildId = String(childId);
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
    }) || []
  );
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

// Combine all nodes and edges for both trees
const allNodes = computed(() => {
  return [...nodes.value, ...lcaNodes.value];
});

const allEdges = computed(() => {
  return [...edges.value, ...lcaEdges.value];
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
    // Handle LCA node click if needed
    const lcaNodeId = nodeId;
    // You can add custom handling for LCA nodes here
    
    // Emit the trigger event for LCA node click
    emit("trigger-event", {
      name: "lca-node:click",
      event: {
        nodeId: lcaNodeId
      }
    });
  }
};

// Watch for Changes from WeWeb Selection
watch(() => props.content.selectedInWeWeb, (newSelectedId) => {
  if (!newSelectedId) return;
  
  console.log(`🔄 External Selection Changed: Highlighting Node ${newSelectedId}`);
  updateHighlighting(newSelectedId);
});

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
      font-display: swap;
    }
  `;
  document.head.appendChild(emojiFontStyle);
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
</script>

<template>
  <div class="dual-tree-container" :style="{ backgroundColor: content.backgroundColor || '#f4f4f4' }">
    <VueFlow 
      :nodes="allNodes" 
      :edges="allEdges" 
      @nodeClick="handleNodeClick"
      :key="allNodes.length"
      :nodesDraggable="false"
      :edgesUpdatable="false"
      :edgesFocusable="false"
      :edgesDraggable="false"
      :nodesConnectable="false">
      
      <!-- Custom Node Template for Org Chart -->
      <template #node-customNode="{ data }">
        <div class="custom-node">
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
        </div>
      </template>
      
      <!-- Custom Node Template for LCA Nodes -->
      <template #node-lcaNode="{ data }">
        <div class="lca-node">
          <div class="process-name">{{ data.processName }}</div>
          <div class="process-type" :class="data.processType">{{ data.processType }}</div>
          <div v-if="data.country" class="country-flag">
            {{ getCountryFlag(data.country) }}
          </div>
        </div>
      </template>
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