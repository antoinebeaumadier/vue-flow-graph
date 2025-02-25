<script setup>
import { ref, defineProps, computed, watch, watchEffect, onMounted, nextTick } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';

const props = defineProps({
  content: { type: Object, required: true },
});

const emit = defineEmits(["update:content", "trigger-event"]);
const { fitView } = useVueFlow();

const highlightedNode = ref(null);
const highlightedEdges = ref([]);

const nodes = ref([]);
const edges = ref([]);

// Helper function to calculate node positions with better spacing
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
  const baseX = 600;  // Root X position
  
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
    
    return {
      id: stringNodeId,
      position: { 
        x: nodeData.xPos || baseX, 
        y: nodeData.yPos || 0 
      },
      data: { label: `${node.name} - ${node.company_name}` },
      draggable: false,
      style: {
        backgroundColor: isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db",
        color: "#fff",
        padding: "10px",
        borderRadius: "8px",
        textAlign: "center",
        border: `2px solid ${isHighlighted ? "#DE0030" : "#000"}`,
        cursor: "pointer",
      },
    };
  });
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
        color: "#fff",
        padding: "10px",
        borderRadius: "8px",
        textAlign: "center",
        cursor: "pointer",
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

// Compute Nodes using improved positioning algorithm
watchEffect(() => {
  if (!props.content.data || !Array.isArray(props.content.data)) {
    console.log("No nodes available");
    nodes.value = [];
    return;
  }
  
  nodes.value = calculateNodePositions(props.content.data);
});

// Compute Edges
watchEffect(() => {
  if (!props.content.data || !Array.isArray(props.content.data)) {
    console.log("No edges available");
    edges.value = [];
    return;
  }

  edges.value = props.content.data.flatMap((item) =>
    item.child_variant_ids.map((childId) => {
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
      };
    })
  );
});

// Handle Node Click
const handleNodeClick = (event) => {
  console.log("Click event:", event);
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

// Watch for Changes from WeWeb Selection
watch(() => props.content.selectedInWeWeb, (newSelectedId) => {
  if (!newSelectedId) return;
  
  console.log(`🔄 External Selection Changed: Highlighting Node ${newSelectedId}`);
  updateHighlighting(newSelectedId);
});

// Center the view on component mount
onMounted(() => {
  // Allow a short delay for the graph to render first
  setTimeout(() => {
    console.log("Org Chart Mounted - Fitting View", props.content);
    if (nodes.value.length > 0) {
      fitView({ 
        padding: 0.5,
        includeHiddenNodes: false,
        duration: 800
      });
    }
  }, 300);
});

// Re-center when nodes change
watch(() => nodes.value.length, (newLength, oldLength) => {
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
  <div class="org-chart-container" :style="{ backgroundColor: content.backgroundColor || '#f4f4f4' }">
    <VueFlow 
      :nodes="nodes" 
      :edges="edges" 
      @nodeClick="handleNodeClick"
      :key="nodes.length"
      :nodesDraggable="false"
      :edgesUpdatable="false"
      :edgesFocusable="false"
      :edgesDraggable="false"
      :nodesConnectable="false">
    </VueFlow>
  </div>
</template>

<style lang="scss" scoped>
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

.my-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 600px;
}

.org-chart-container {
  height: 600px;
  width: 100%;
}
</style>