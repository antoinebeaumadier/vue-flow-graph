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

// Compute Nodes
watchEffect(() => {
  if (!props.content.data || !Array.isArray(props.content.data)) {
    console.log("No nodes available");
    nodes.value = [];
    return;
  }

  const groupedNodes = {};
  props.content.data.forEach((node) => {
    if (!groupedNodes[node.parent_id]) {
      groupedNodes[node.parent_id] = [];
    }
    groupedNodes[node.parent_id].push(node);
  });

  let spacingX = 250;
  let spacingYBase = 180;

  nodes.value = props.content.data.map((node) => {
    let xPos = 600;
    let yPos = node.rank * spacingYBase;

    if (groupedNodes[node.parent_id]?.length > 1) {
      let siblings = groupedNodes[node.parent_id];
      let siblingIndex = siblings.findIndex((sibling) => sibling.id === node.id);
      xPos = 600 + siblingIndex * spacingX - ((siblings.length - 1) * spacingX) / 2;
    }

    const stringNodeId = String(node.id);
    const isHighlighted = highlightedNode.value === stringNodeId;
    
    return {
      id: stringNodeId,
      position: { x: xPos, y: yPos },
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

  // Update WeWeb variable
  emit("update:content", { selectedNodeId: nodeId, selectedInWeWeb: nodeId });
};

// Watch for Changes from WeWeb Selection
watch(() => props.content.selectedInWeWeb, (newSelectedId) => {
  if (!newSelectedId) return;
  
  console.log(`🔄 External Selection Changed: Highlighting Node ${newSelectedId}`);
  updateHighlighting(newSelectedId);
});

onMounted(() => {
  setTimeout(() => {
    console.log("Org Chart Mounted", props.content);
  }, 50);
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