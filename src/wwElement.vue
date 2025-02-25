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
  
  // Group nodes by rank for horizontal positioning
  const nodesByRank = {};
  data.forEach(node => {
    const rank = node.rank || 0;
    if (!nodesByRank[rank]) nodesByRank[rank] = [];
    nodesByRank[rank].push(node);
  });
  
  // First pass: Position parent nodes
  const spacingX = 250;  // Horizontal spacing between siblings
  const spacingYBase = 150;  // Vertical spacing between ranks
  const baseX = 600;  // Center X position
  const nodePositions = {};
  
  // Store node positions by their ID
  data.forEach((node) => {
    const rank = node.rank || 0;
    let xPos = baseX;
    let yPos = rank * spacingYBase;
    
    nodePositions[node.id] = { x: xPos, y: yPos };
  });
  
  // Second pass: Adjust sibling positions based on parent position
  data.forEach((node) => {
    // Skip nodes without a parent (root nodes)
    if (!node.parent_id) return;
    
    // Get siblings (nodes with the same parent)
    const siblings = data.filter(n => n.parent_id === node.parent_id);
    
    if (siblings.length > 1) {
      // Get parent position
      const parentPos = nodePositions[node.parent_id];
      if (!parentPos) return;
      
      // Position siblings centered around their parent
      const siblingIndex = siblings.findIndex(s => s.id === node.id);
      const totalWidth = (siblings.length - 1) * spacingX;
      
      // Center siblings around parent, not around base position
      const startX = parentPos.x - totalWidth / 2;
      nodePositions[node.id].x = startX + siblingIndex * spacingX;
    }
  });
  
  // Create final node objects for Vue Flow
  return data.map(node => {
    const stringNodeId = String(node.id);
    const pos = nodePositions[node.id] || { x: baseX, y: (node.rank || 0) * spacingYBase };
    const isHighlighted = highlightedNode.value === stringNodeId;
    
    return {
      id: stringNodeId,
      position: { x: pos.x, y: pos.y },
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