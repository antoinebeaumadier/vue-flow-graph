<script setup>
import { ref, defineProps, computed, watch, watchEffect, onMounted, nextTick } from 'vue';
import { VueFlow, useVueFlow, Panel, addNodeType } from '@vue-flow/core';

const props = defineProps({
  content: { type: Object, required: true },
});

const emit = defineEmits(["update:content", "trigger-event"]);
const { fitView, findNode, addEdges, onConnect } = useVueFlow();

const highlightedNode = ref(null);
const highlightedEdges = ref([]);
const omittedNodeIds = ref([]);

const nodes = ref([]);
const edges = ref([]);
const lcaNodes = ref([]);
const lcaEdges = ref([]);

// ========== Register custom node types ==========
// This needs to happen before the component is mounted
onMounted(() => {
  // Register custom node types
  addNodeType('treeNode', {
    template: `
      <div class="custom-node tree-node">
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
        <div class="node-controls">
          <button 
            class="omit-button" 
            :class="{ omitted: data.isOmitted }"
            @click.stop="$emit('node:omit', id)">
            {{ data.isOmitted ? 'Include' : 'Omit' }}
          </button>
        </div>
      </div>
    `,
    setup(props) {
      const getCountryFlag = (isoCode) => {
        if (!isoCode) return '';
        try {
          return Array.from(isoCode.toUpperCase())
            .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
            .join('');
        } catch (error) {
          console.error("Error generating flag:", error);
          return '';
        }
      };
      
      return { getCountryFlag };
    }
  });
  
  addNodeType('lcaNode', {
    template: `
      <div class="custom-node lca-node">
        <div class="product-name">{{ data.productName }}</div>
        <div class="company-name">{{ data.companyName }}</div>
        <div class="percentage" v-if="data.percentage !== undefined">{{ data.percentage }}%</div>
        <div v-if="data.countryCodes && data.countryCodes.length > 0" class="country-flags">
          <span 
            v-for="(code, index) in data.countryCodes" 
            :key="index" 
            class="country-flag"
            :title="code.toUpperCase()">
            {{ getCountryFlag(code) }}
          </span>
        </div>
        <div class="node-controls">
          <button 
            class="omit-button" 
            :class="{ omitted: data.isOmitted }"
            @click.stop="$emit('node:omit', id)">
            {{ data.isOmitted ? 'Include' : 'Omit' }}
          </button>
        </div>
      </div>
    `,
    setup(props) {
      const getCountryFlag = (isoCode) => {
        if (!isoCode) return '';
        try {
          return Array.from(isoCode.toUpperCase())
            .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
            .join('');
        } catch (error) {
          console.error("Error generating flag:", error);
          return '';
        }
      };
      
      return { getCountryFlag };
    }
  });

  // Register onConnect handler
  onConnect(handleConnect);
  
  // Initialize omittedNodes if it exists in content
  if (Array.isArray(props.content.omittedNodes)) {
    omittedNodeIds.value = props.content.omittedNodes.map(String);
  }
  
  // Allow a short delay for the graph to render first
  setTimeout(() => {
    if (nodes.value.length > 0 || lcaNodes.value.length > 0) {
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

// ========== LCA Structure Processing ==========

// Process LCA structure data into nodes and edges
const processLCAStructure = (lcaData) => {
  if (!lcaData || !Array.isArray(lcaData) || lcaData.length === 0) {
    console.log("No LCA data available");
    return { nodes: [], edges: [] };
  }

  try {
    // Sort by rank (descending) to ensure proper processing
    const sortedData = [...lcaData].sort((a, b) => a.rank - b.rank);
    
    // Create nodes from LCA data
    const lcaNodes = sortedData.map((item, index) => {
      const nodeId = `lca-${item.nomenclature_process_id || index}`;
      
      return {
        id: nodeId,
        type: 'lcaNode',
        position: { x: 0, y: 0 }, // Will be calculated later
        data: {
          ...item,
          productName: item.nomenclature_process?.name || `Process ${index + 1}`,
          companyName: `Rank: ${item.rank} - ${item.rank_name_eng || ''}`,
          countryCodes: item.country ? [item.country] : [],
          percentage: item.percentage || 100,
          isOmitted: false
        },
        draggable: true,
        connectable: true
      };
    });

    // Create edges based on rank relationships
    const lcaEdges = [];
    const nodesByRank = {};
    
    // Group nodes by rank
    sortedData.forEach((item, index) => {
      const rank = item.rank;
      if (!nodesByRank[rank]) {
        nodesByRank[rank] = [];
      }
      nodesByRank[rank].push(`lca-${item.nomenclature_process_id || index}`);
    });
    
    // Create rank numbers array and sort them
    const ranks = Object.keys(nodesByRank).map(Number).sort((a, b) => a - b);
    
    // Connect nodes between consecutive ranks
    for (let i = 0; i < ranks.length - 1; i++) {
      const currentRank = ranks[i];
      const nextRank = ranks[i + 1];
      
      // Connect each node in the current rank to each node in the next rank
      nodesByRank[currentRank].forEach(sourceId => {
        nodesByRank[nextRank].forEach(targetId => {
          lcaEdges.push({
            id: `e-${sourceId}-${targetId}`,
            source: sourceId,
            target: targetId,
            animated: false,
            style: {
              stroke: props.content.edgeColor || '#000',
              strokeWidth: 1.5,
            },
          });
        });
      });
    }

    // Position the nodes based on rank and number of nodes in each rank
    const spacingX = 250;
    const spacingY = 150;
    const startY = 100;
    
    ranks.forEach((rank, rankIndex) => {
      const nodesInRank = nodesByRank[rank];
      const rankWidth = nodesInRank.length * spacingX;
      const startX = 1200 - (rankWidth / 2);
      
      nodesInRank.forEach((nodeId, nodeIndex) => {
        const node = lcaNodes.find(n => n.id === nodeId);
        if (node) {
          node.position = {
            x: startX + (nodeIndex * spacingX),
            y: startY + (rankIndex * spacingY)
          };
        }
      });
    });

    return { nodes: lcaNodes, edges: lcaEdges };
  } catch (error) {
    console.error("Error processing LCA structure:", error);
    return { nodes: [], edges: [] };
  }
};

// ========== Original Tree Positioning ==========

// Helper function to calculate node positions with better spacing
const calculateNodePositions = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];
  
  try {
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
      if (!node || !node.children.length) return spacingX; // Leaf node width
      
      // Sum the widths of all children subtrees
      return node.children.reduce((sum, childId) => sum + calculateSubtreeWidth(childId), 0);
    };
    
    // First pass: Calculate horizontal positions in a bottom-up approach
    const calculateXPosition = (nodeId, leftBoundary) => {
      const node = nodesById[nodeId];
      if (!node) return leftBoundary + spacingX / 2;
      
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
    let currentX = baseX;
    
    if (rootNodes.length > 0) {
      currentX = baseX - (calculateSubtreeWidth(rootNodes[0]?.id || 0) / 2);
      
      rootNodes.forEach(rootNode => {
        const rootWidth = calculateSubtreeWidth(rootNode.id);
        calculateXPosition(rootNode.id, currentX);
        currentX += rootWidth;
      });
    }
    
    // Set vertical positions based on rank
    data.forEach(node => {
      const rank = node.rank || 0;
      if (nodesById[node.id]) {
        nodesById[node.id].yPos = rank * spacingYBase;
      }
    });
    
    // Create final node objects for Vue Flow
    return data.map(node => {
      const nodeData = nodesById[node.id] || {};
      const stringNodeId = String(node.id);
      const isHighlighted = highlightedNode.value === stringNodeId;
      const isOmitted = omittedNodeIds.value.includes(stringNodeId);
      
      // Create the node with HTML content for structured layout
      return {
        id: stringNodeId,
        position: { 
          x: nodeData.xPos || baseX, 
          y: nodeData.yPos || 0 
        },
        // Use a structured node data format with product name, company name, and country ISO array
        data: { 
          productName: node.name || "Unnamed Product", 
          companyName: node.company_name || "Unknown Company",
          // Handle both array and single value formats for country codes
          countryCodes: Array.isArray(node.country_iso) 
            ? node.country_iso 
            : (node.country_iso ? [node.country_iso] : []),
          isOmitted: isOmitted
        },
        draggable: true,
        connectable: true,
        style: {
          backgroundColor: isOmitted ? props.content.omitColor || "#8B0000" : 
                         isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db",
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
        type: "treeNode",
      };
    });
  } catch (error) {
    console.error("Error calculating node positions:", error);
    return [];
  }
};

// ========== Helper Functions ==========

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

  // Update all nodes with string comparison
  updateAllNodes();
  updateAllEdges();

  // Focus camera on the selected node
  nextTick(() => {
    fitView({ duration: 500, padding: 0.2 });
  });
};

// Update all nodes with current state (highlighting and omitted status)
const updateAllNodes = () => {
  // Update tree nodes
  nodes.value = nodes.value.map(node => {
    const isHighlighted = node.id === highlightedNode.value;
    const isOmitted = omittedNodeIds.value.includes(node.id);
    
    return {
      ...node,
      data: {
        ...node.data,
        isOmitted: isOmitted
      },
      style: {
        ...node.style,
        backgroundColor: isOmitted ? props.content.omitColor || "#8B0000" : 
                         isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db",
        border: `2px solid ${isHighlighted ? "#DE0030" : "#000"}`,
      },
    };
  });
  
  // Update LCA nodes
  lcaNodes.value = lcaNodes.value.map(node => {
    const isHighlighted = node.id === highlightedNode.value;
    const isOmitted = omittedNodeIds.value.includes(node.id);
    
    return {
      ...node,
      data: {
        ...node.data,
        isOmitted: isOmitted
      },
      style: {
        ...node.style,
        backgroundColor: isOmitted ? props.content.omitColor || "#8B0000" : 
                         isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db",
        border: `2px solid ${isHighlighted ? "#DE0030" : "#000"}`,
      },
    };
  });
};

// Update all edges with current state
const updateAllEdges = () => {
  // Update tree edges
  edges.value = edges.value.map(edge => {
    const isHighlighted = highlightedEdges.value.includes(edge.id);
    const isSourceOmitted = omittedNodeIds.value.includes(edge.source);
    const isTargetOmitted = omittedNodeIds.value.includes(edge.target);
    const isOmitted = isSourceOmitted || isTargetOmitted;
    
    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: isOmitted ? props.content.omitColor || "#8B0000" :
                isHighlighted ? "#DE0030" : props.content.edgeColor || "#000",
        strokeWidth: isHighlighted ? 3 : 1.5,
        opacity: isOmitted ? 0.5 : 1
      },
      animated: !isHighlighted && !isOmitted,
    };
  });
  
  // Update LCA edges
  lcaEdges.value = lcaEdges.value.map(edge => {
    const isHighlighted = highlightedEdges.value.includes(edge.id);
    const isSourceOmitted = omittedNodeIds.value.includes(edge.source);
    const isTargetOmitted = omittedNodeIds.value.includes(edge.target);
    const isOmitted = isSourceOmitted || isTargetOmitted;
    
    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: isOmitted ? props.content.omitColor || "#8B0000" :
                isHighlighted ? "#DE0030" : props.content.edgeColor || "#000",
        strokeWidth: isHighlighted ? 3 : 1.5,
        opacity: isOmitted ? 0.5 : 1
      },
      animated: !isHighlighted && !isOmitted,
    };
  });
};

// Recursive function to get all child node IDs
const getAllChildNodeIds = (nodeId) => {
  if (!nodeId) return [];
  const children = [];
  
  // Find direct children
  const directChildren = edges.value
    .filter(edge => edge.source === nodeId)
    .map(edge => edge.target);
  
  // Add direct children to the list
  children.push(...directChildren);
  
  // Recursively find grandchildren
  directChildren.forEach(childId => {
    children.push(...getAllChildNodeIds(childId));
  });
  
  return children;
};

// Toggle omit status for a node and its children
const toggleOmitStatus = (nodeId) => {
  if (!nodeId) return;
  const isCurrentlyOmitted = omittedNodeIds.value.includes(nodeId);
  let updatedOmittedNodes = [...omittedNodeIds.value];
  
  // Get all child nodes
  const allChildrenIds = getAllChildNodeIds(nodeId);
  
  if (isCurrentlyOmitted) {
    // Remove this node and all its children from omitted list
    updatedOmittedNodes = updatedOmittedNodes.filter(
      id => id !== nodeId && !allChildrenIds.includes(id)
    );
  } else {
    // Add this node and all its children to omitted list
    updatedOmittedNodes.push(nodeId, ...allChildrenIds);
    // Remove duplicates
    updatedOmittedNodes = [...new Set(updatedOmittedNodes)];
  }
  
  // Update omitted nodes
  omittedNodeIds.value = updatedOmittedNodes;
  
  // Update content prop
  const updatedContent = {
    ...props.content,
    omittedNodes: updatedOmittedNodes
  };
  
  // Emit the content update
  emit("update:content", updatedContent);
  
  // Emit the trigger event for node omit
  emit("trigger-event", {
    name: "node:omit",
    event: {
      nodeId: nodeId,
      omitted: !isCurrentlyOmitted,
      omittedNodes: updatedOmittedNodes
    }
  });
  
  // Update node and edge styling
  updateAllNodes();
  updateAllEdges();
};

// Get flag emoji from ISO code
const getCountryFlag = (isoCode) => {
  if (!isoCode) return '';
  
  try {
    // Convert ISO code to regional indicator symbols
    // Each letter in the ISO code is converted to a regional indicator symbol (A-Z)
    // by adding 127397 to its UTF-16 code point value
    return Array.from(isoCode.toUpperCase())
      .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
      .join('');
  } catch (error) {
    console.error("Error generating flag:", error);
    return '';
  }
};

// ========== Event Handlers ==========

// Handle Node Click
const handleNodeClick = (event) => {
  const nodeId = event?.node?.id || null;
  if (!nodeId) return;

  console.log("Node clicked:", nodeId);
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
};

// Handle Node Omit (from custom node event)
const handleNodeOmit = (nodeId) => {
  if (nodeId) {
    toggleOmitStatus(nodeId);
  }
};

// Handle Node Connection
const handleConnect = (connection) => {
  if (!connection.source || !connection.target) return;
  
  console.log("Connection created:", connection);
  
  // Emit the trigger event for node connection
  emit("trigger-event", {
    name: "node:connect",
    event: {
      sourceId: connection.source,
      targetId: connection.target
    }
  });
};

// ========== Watchers ==========

// Compute Tree Nodes using improved positioning algorithm
watchEffect(() => {
  if (!props.content.data || !Array.isArray(props.content.data)) {
    console.log("No nodes available");
    nodes.value = [];
    return;
  }
  
  nodes.value = calculateNodePositions(props.content.data);
});

// Compute Tree Edges
watchEffect(() => {
  if (!props.content.data || !Array.isArray(props.content.data)) {
    console.log("No edges available");
    edges.value = [];
    return;
  }

  edges.value = props.content.data.flatMap((item) => {
    if (!item.child_variant_ids || !Array.isArray(item.child_variant_ids)) {
      return [];
    }
    
    return item.child_variant_ids.map((childId) => {
      const stringItemId = String(item.id);
      const stringChildId = String(childId);
      const isHighlighted = highlightedNode.value === stringItemId || highlightedNode.value === stringChildId;
      const isSourceOmitted = omittedNodeIds.value.includes(stringItemId);
      const isTargetOmitted = omittedNodeIds.value.includes(stringChildId);
      const isOmitted = isSourceOmitted || isTargetOmitted;
      
      return {
        id: `e${stringItemId}-${stringChildId}`,
        source: stringItemId,
        target: stringChildId,
        animated: !isHighlighted && !isOmitted,
        style: {
          stroke: isOmitted ? props.content.omitColor || "#8B0000" :
                  isHighlighted ? "#DE0030" : props.content.edgeColor || "#000",
          strokeWidth: isHighlighted ? 3 : 1.5,
          opacity: isOmitted ? 0.5 : 1
        },
      };
    });
  });
});

// Process LCA Structure Data
watch(() => props.content.lcaStructure, (newLcaData) => {
  if (!newLcaData || !Array.isArray(newLcaData) || newLcaData.length === 0) {
    console.log("No LCA structure data available");
    lcaNodes.value = [];
    lcaEdges.value = [];
    return;
  }
  
  console.log("Processing LCA Structure:", newLcaData);
  const { nodes: processedNodes, edges: processedEdges } = processLCAStructure(newLcaData);
  
  lcaNodes.value = processedNodes;
  lcaEdges.value = processedEdges;
  
  // Allow time for nodes to render, then fit view
  nextTick(() => {
    fitView({ 
      padding: 0.5, 
      includeHiddenNodes: false, 
      duration: 800 
    });
  });
}, { immediate: true });

// Watch for Changes from WeWeb Selection
watch(() => props.content.selectedInWeWeb, (newSelectedId) => {
  if (!newSelectedId) return;
  
  console.log(`🔄 External Selection Changed: Highlighting Node ${newSelectedId}`);
  updateHighlighting(newSelectedId);
});

// Watch for Changes in omittedNodes prop
watch(() => props.content.omittedNodes, (newOmittedNodes) => {
  if (Array.isArray(newOmittedNodes)) {
    omittedNodeIds.value = newOmittedNodes.map(String);
    updateAllNodes();
    updateAllEdges();
  }
}, { immediate: true });

// Re-center when nodes change
watch([() => nodes.value.length, () => lcaNodes.value.length], ([newTreeLength, newLcaLength], [oldTreeLength, oldLcaLength]) => {
  if (newTreeLength > 0 || newLcaLength > 0) {
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
  <div class="org-chart-container" :style="{ backgroundColor: content.backgroundColor || '#f4f4f4' }">
    <VueFlow 
      :key="nodes.length + lcaNodes.length"
      :nodes="[...nodes, ...lcaNodes]" 
      :edges="[...edges, ...lcaEdges]" 
      @nodeClick="handleNodeClick"
      @node:omit="handleNodeOmit"
      :nodesDraggable="true"
      :edgesUpdatable="false"
      :edgesFocusable="true"
      :edgesDraggable="false"
      :elevateEdgesOnSelect="true"
      :nodesConnectable="true"
      :connectOnClick="true">
      
      <!-- Controls -->
      <Panel position="top-right">
        <div class="controls">
          <button class="control-button" @click="fitView({ padding: 0.5, duration: 800 })">
            Center View
          </button>
        </div>
      </Panel>
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

.my-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 600px;
}

.org-chart-container {
  height: 600px;
  width: 100%;
  font-family: 'Nunito', sans-serif;
}

/* Controls styling */
.controls {
  display: flex;
  gap: 8px;
  margin: 8px;
}

.control-button {
  background-color: #fff;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-family: 'Nunito', sans-serif;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: #f0f0f0;
    border-color: #999;
  }
}

/* Node controls styling */
.node-controls {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.omit-button {
  background-color: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  padding: 2px 6px;
  color: white;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }
  
  &.omitted {
    background-color: rgba(255, 255, 255, 0.6);
    color: #8B0000;
  }
}

/* Custom node styling */
.custom-node {
  display: flex;
  flex-direction: column;
  min-width: 180px;
  width: 100%;
  padding: 10px;
  border-radius: 4px;
}

.product-name {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 4px;
}

.company-name {
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.percentage {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.country-flags {
  display: flex;
  gap: 4px;
  justify-content: center;
  margin-top: 4px;
}

.country-flag {
  font-family: 'NotoColorEmoji', Apple Color Emoji, Segoe UI Emoji, sans-serif;
  font-size: 16px;
  line-height: 1;
}

/* Tree node specific styling */
.tree-node {
  background-color: #3498db;
  color: white;
}

/* LCA node specific styling */
.lca-node {
  background-color: #2c3e50;
  color: white;
}
</style>