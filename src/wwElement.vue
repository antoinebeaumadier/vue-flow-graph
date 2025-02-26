<script setup>
import { ref, defineProps, computed, watch, watchEffect, onMounted, nextTick } from 'vue';
import { VueFlow, useVueFlow, Panel, addNodeType, removeEdges, removeNodes } from '@vue-flow/core';

const props = defineProps({
  content: { type: Object, required: true },
});

const emit = defineEmits(["update:content", "trigger-event"]);
const { fitView, findNode, addEdges, onConnect, getNodes, getEdges } = useVueFlow();

const highlightedNode = ref(null);
const highlightedEdges = ref([]);
const omittedNodeIds = ref([]);

const nodes = ref([]);
const edges = ref([]);
const lcaNodes = ref([]);
const lcaEdges = ref([]);

// Register custom node types
onMounted(() => {
  addNodeType('treeNode', {
    template: `
      <foreignObject width="200" height="150" :style="{zIndex: 1000}">
        <div xmlns="http://www.w3.org/1999/xhtml"
             style="background-color: #3498db; 
                   color: white; 
                   padding: 10px; 
                   border-radius: 4px; 
                   width: 100%; 
                   height: 100%; 
                   text-align: center;
                   font-family: 'Nunito', sans-serif;
                   box-sizing: border-box;
                   display: flex;
                   flex-direction: column;
                   border: 2px solid black;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">
            {{ data.name }}
          </div>
          <div style="font-size: 12px; margin-bottom: 4px;">
            {{ data.companyName }}
          </div>
          <div v-if="data.countryCodes && data.countryCodes.length > 0" 
               style="display: flex; gap: 4px; justify-content: center; margin-top: 4px;">
            <span v-for="(code, index) in data.countryCodes" 
                  :key="index" 
                  style="font-family: 'NotoColorEmoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif; font-size: 16px;"
                  :title="code.toUpperCase()">
              {{ getCountryFlag(code) }}
            </span>
          </div>
          <div style="display: flex; justify-content: center; margin-top: 8px;">
            <button style="background-color: rgba(255, 255, 255, 0.2); 
                          border: 1px solid rgba(255, 255, 255, 0.4); 
                          border-radius: 4px; 
                          padding: 2px 6px; 
                          color: white; 
                          font-size: 11px; 
                          cursor: pointer;"
                    :style="data.isOmitted ? {backgroundColor: 'rgba(255, 255, 255, 0.6)', color: '#8B0000'} : {}"
                    @click.stop="$emit('node:omit', id)">
              {{ data.isOmitted ? 'Include' : 'Omit' }}
            </button>
          </div>
        </div>
      </foreignObject>
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
      <foreignObject width="200" height="150" :style="{zIndex: 1000}">
        <div xmlns="http://www.w3.org/1999/xhtml"
             style="background-color: #2c3e50; 
                   color: white; 
                   padding: 10px; 
                   border-radius: 4px; 
                   width: 100%; 
                   height: 100%; 
                   text-align: center;
                   font-family: 'Nunito', sans-serif;
                   box-sizing: border-box;
                   display: flex;
                   flex-direction: column;
                   border: 2px solid black;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">
            {{ data.name }}
          </div>
          <div style="font-size: 12px; margin-bottom: 4px;">
            {{ data.companyName }}
          </div>
          <div v-if="data.percentage !== undefined" 
               style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">
            {{ data.percentage }}%
          </div>
          <div v-if="data.countryCodes && data.countryCodes.length > 0" 
               style="display: flex; gap: 4px; justify-content: center; margin-top: 4px;">
            <span v-for="(code, index) in data.countryCodes" 
                  :key="index" 
                  style="font-family: 'NotoColorEmoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif; font-size: 16px;"
                  :title="code.toUpperCase()">
              {{ getCountryFlag(code) }}
            </span>
          </div>
          <div style="display: flex; justify-content: center; margin-top: 8px;">
            <button style="background-color: rgba(255, 255, 255, 0.2); 
                          border: 1px solid rgba(255, 255, 255, 0.4); 
                          border-radius: 4px; 
                          padding: 2px 6px; 
                          color: white; 
                          font-size: 11px; 
                          cursor: pointer;"
                    :style="data.isOmitted ? {backgroundColor: 'rgba(255, 255, 255, 0.6)', color: '#8B0000'} : {}"
                    @click.stop="$emit('node:omit', id)">
              {{ data.isOmitted ? 'Include' : 'Omit' }}
            </button>
          </div>
        </div>
      </foreignObject>
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

  onConnect(handleConnect);

  if (Array.isArray(props.content.omittedNodes)) {
    omittedNodeIds.value = props.content.omittedNodes.map(String);
  }

  // Fonts setup
  const nunitoFont = document.createElement('link');
  nunitoFont.rel = 'stylesheet';
  nunitoFont.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap';
  document.head.appendChild(nunitoFont);

  const emojiFontStyle = document.createElement('style');
  emojiFontStyle.textContent = `
    @font-face {
      font-family: 'NotoColorEmoji';
      src: url('https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/fonts/NotoColorEmoji.ttf') format('truetype');
      font-display: swap;
    }
  `;
  document.head.appendChild(emojiFontStyle);
  
  // Add debugging to force node visibility after render
  setTimeout(() => {
    console.log("Forcing node visibility");
    document.querySelectorAll('.vue-flow__node foreignObject').forEach(fo => {
      fo.setAttribute('width', '200');
      fo.setAttribute('height', '150');
    });
  }, 1000);
});

// Process LCA structure data into nodes and edges (inverted order: rank 1 at bottom)
const processLCAStructure = (lcaData) => {
  if (!lcaData || !Array.isArray(lcaData) || lcaData.length === 0) {
    return { nodes: [], edges: [] };
  }

  try {
    // Sort by rank (ascending) to invert order (rank 1 at bottom)
    const sortedData = [...lcaData].sort((a, b) => a.rank - b.rank);
    
    // Setup spacing constants
    const spacingX = 250;
    const spacingY = 150;
    const startY = 100; // Start from top for highest rank

    // Create a mapping of nodes by rank
    const nodesByRank = {};
    sortedData.forEach((item, index) => {
      const rank = item.rank;
      if (!nodesByRank[rank]) {
        nodesByRank[rank] = [];
      }
      nodesByRank[rank].push({
        id: `lca-${item.nomenclature_process_id || index}`,
        data: item
      });
    });

    const ranks = Object.keys(nodesByRank).map(Number).sort((a, b) => a - b);
    const maxRank = Math.max(...ranks);

    // Create nodes with correct positions
    const lcaNodes = sortedData.map((item, index) => {
      const nodeId = `lca-${item.nomenclature_process_id || index}`;
      const rank = item.rank;
      
      // Calculate position for this node
      // Find position of this node in its rank
      const rankNodes = nodesByRank[rank];
      const nodeIndex = rankNodes.findIndex(n => n.id === nodeId);
      
      // Calculate X position based on rank width
      const rankWidth = rankNodes.length * spacingX;
      const startX = 1200 - (rankWidth / 2);
      const xPos = startX + (nodeIndex * spacingX);
      
      // Calculate Y position (inverted)
      const yPos = startY + ((maxRank - rank) * spacingY);
      
      return {
        id: nodeId,
        type: 'lcaNode',
        position: { x: xPos, y: yPos },
        data: {
          name: item.nomenclature_process?.name_eng || `Process ${index + 1}`,
          companyName: `Rank: ${item.rank} - ${item.rank_name_eng || ''}`,
          countryCodes: item.country ? [item.country] : [],
          percentage: item.percentage || 0,
          isOmitted: false
        },
        draggable: true,
        connectable: true,
        width: 200,
        height: 150,
        style: {
          zIndex: 10
        }
      };
    });

    // Create edges between ranks
    const lcaEdges = [];
    
    // Connect nodes hierarchically (parent-child within ranks, top to bottom)
    for (let i = 0; i < ranks.length - 1; i++) {
      const currentRank = ranks[i];
      const nextRank = ranks[i + 1];
      nodesByRank[currentRank].forEach((sourceNode) => {
        // Connect to the first node in the next rank for a cleaner hierarchy
        if (nodesByRank[nextRank].length > 0) {
          const targetNode = nodesByRank[nextRank][0]; // Connect to the first node in the next rank
          lcaEdges.push({
            id: `e-${sourceNode.id}-${targetNode.id}`,
            source: sourceNode.id,
            target: targetNode.id,
            animated: false,
            style: {
              stroke: props.content.edgeColor || '#000',
              strokeWidth: 1.5,
            },
          });
        }
      });
    }

    return { nodes: lcaNodes, edges: lcaEdges };
  } catch (error) {
    console.error("Error processing LCA structure:", error);
    return { nodes: [], edges: [] };
  }
};

// Process Collection Data into nodes and edges
const calculateNodePositions = (data) => {
  if (!data || !Array.isArray(data) || data.length === 0) return [];

  try {
    const nodesById = {};
    data.forEach(node => {
      nodesById[node.id] = { ...node, children: [] };
    });

    data.forEach(node => {
      if (node.parent_id && nodesById[node.parent_id]) {
        nodesById[node.parent_id].children.push(node.id);
      }
    });

    const spacingX = 250;
    const spacingYBase = 150;
    const baseX = 300;

    const calculateSubtreeWidth = (nodeId) => {
      const node = nodesById[nodeId];
      if (!node || !node.children.length) return spacingX;
      return node.children.reduce((sum, childId) => sum + calculateSubtreeWidth(childId), 0);
    };

    const calculateXPosition = (nodeId, leftBoundary) => {
      const node = nodesById[nodeId];
      if (!node) return leftBoundary + spacingX / 2;

      if (!node.children.length) {
        node.xPos = leftBoundary + spacingX / 2;
        return node.xPos;
      }

      let currentX = leftBoundary;
      const childPositions = [];

      node.children.forEach(childId => {
        const childWidth = calculateSubtreeWidth(childId);
        const childCenter = calculateXPosition(childId, currentX);
        childPositions.push(childCenter);
        currentX += childWidth;
      });

      if (childPositions.length) {
        const firstChild = childPositions[0];
        const lastChild = childPositions[childPositions.length - 1];
        node.xPos = (firstChild + lastChild) / 2;
      } else {
        node.xPos = leftBoundary + spacingX / 2;
      }

      return node.xPos;
    };

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

    data.forEach(node => {
      const rank = node.rank || 0;
      if (nodesById[node.id]) {
        nodesById[node.id].yPos = rank * spacingYBase;
      }
    });

    return data.map(node => {
      const nodeData = nodesById[node.id] || {};
      const stringNodeId = String(node.id);
      const isHighlighted = highlightedNode.value === stringNodeId;
      const isOmitted = omittedNodeIds.value.includes(stringNodeId);

      return {
        id: stringNodeId,
        position: { x: nodeData.xPos || baseX, y: nodeData.yPos || 0 },
        data: {
          name: node.name || "Unnamed Node",
          companyName: node.company_name || "Unknown Company",
          countryCodes: Array.isArray(node.country_iso) ? node.country_iso : (node.country_iso ? [node.country_iso] : []),
          isOmitted: isOmitted
        },
        draggable: false,
        connectable: false,
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
          height: "auto",
          fontFamily: "Nunito, sans-serif",
          fontWeight: "500",
          zIndex: 999,
          position: "relative"
        },
        width: 200,
        height: 150,
        type: "treeNode",
      };
    });
  } catch (error) {
    console.error("Error calculating node positions:", error);
    return [];
  }
};

// Helper functions
const updateHighlighting = (nodeId) => {
  if (!nodeId) return;
  const stringNodeId = String(nodeId);
  highlightedNode.value = stringNodeId;
  highlightedEdges.value = [...edges.value, ...lcaEdges.value]
    .filter((edge) => edge.source === stringNodeId || edge.target === stringNodeId)
    .map((edge) => edge.id);

  updateAllNodes();
  updateAllEdges();

  nextTick(() => {
    fitView({ duration: 500, padding: 0.2 });
  });
};

const updateAllNodes = () => {
  nodes.value = nodes.value.map(node => {
    const isHighlighted = node.id === highlightedNode.value;
    const isOmitted = omittedNodeIds.value.includes(node.id);
    return {
      ...node,
      data: { ...node.data, isOmitted: isOmitted },
      style: {
        ...node.style,
        backgroundColor: isOmitted ? props.content.omitColor || "#8B0000" : 
                         isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db",
        border: `2px solid ${isHighlighted ? "#DE0030" : "#000"}`,
      },
    };
  });

  lcaNodes.value = lcaNodes.value.map(node => {
    const isHighlighted = node.id === highlightedNode.value;
    const isOmitted = omittedNodeIds.value.includes(node.id);
    return {
      ...node,
      data: { ...node.data, isOmitted: isOmitted },
      style: {
        ...node.style,
        backgroundColor: isOmitted ? props.content.omitColor || "#8B0000" : 
                         isHighlighted ? "#DE0030" : props.content.nodeColor || "#3498db",
        border: `2px solid ${isHighlighted ? "#DE0030" : "#000"}`,
      },
    };
  });
};

const updateAllEdges = () => {
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

const getAllChildNodeIds = (nodeId) => {
  if (!nodeId) return [];
  const children = [];
  const directChildren = [...edges.value, ...lcaEdges.value]
    .filter(edge => edge.source === nodeId)
    .map(edge => edge.target);
  children.push(...directChildren);
  directChildren.forEach(childId => {
    children.push(...getAllChildNodeIds(childId));
  });
  return children;
};

const toggleOmitStatus = (nodeId) => {
  if (!nodeId) return;
  const isCurrentlyOmitted = omittedNodeIds.value.includes(nodeId);
  let updatedOmittedNodes = [...omittedNodeIds.value];
  const allChildrenIds = getAllChildNodeIds(nodeId);

  if (isCurrentlyOmitted) {
    updatedOmittedNodes = updatedOmittedNodes.filter(
      id => id !== nodeId && !allChildrenIds.includes(id)
    );
  } else {
    updatedOmittedNodes.push(nodeId, ...allChildrenIds);
    updatedOmittedNodes = [...new Set(updatedOmittedNodes)];
  }

  omittedNodeIds.value = updatedOmittedNodes;
  const updatedContent = { ...props.content, omittedNodes: updatedOmittedNodes };
  emit("update:content", updatedContent);
  emit("trigger-event", {
    name: "node:omit",
    event: { nodeId: nodeId, omitted: !isCurrentlyOmitted, omittedNodes: updatedOmittedNodes }
  });
  updateAllNodes();
  updateAllEdges();
};

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

const handleNodeClick = (event) => {
  const nodeId = event?.node?.id || null;
  if (!nodeId) return;
  updateHighlighting(nodeId);
  const updatedContent = { ...props.content, selectedNodeId: nodeId, selectedInWeWeb: nodeId };
  emit("update:content", updatedContent);
  emit("trigger-event", { name: "node:click", event: { nodeId: nodeId } });
};

const handleNodeOmit = (nodeId) => {
  if (nodeId) {
    toggleOmitStatus(nodeId);
  }
};

const handleConnect = (connection) => {
  if (!connection.source || !connection.target) return;
  const sourceType = connection.source.startsWith('lca-') ? 'lca' : 'tree';
  const targetType = connection.target.startsWith('lca-') ? 'lca' : 'tree';

  // Allow connections within LCA_structure or from LCA_structure to Collection Data, but not within Collection Data
  if ((sourceType === 'lca' && targetType === 'lca') || 
      (sourceType === 'lca' && targetType === 'tree')) {
    console.log("Connection created:", connection);
    emit("trigger-event", {
      name: "node:connect",
      event: { sourceId: connection.source, targetId: connection.target }
    });
    addEdges([connection]);
  }
};

const onEdgesUpdate = (oldEdge, newConnection) => {
  if (!newConnection.source || !newConnection.target) return;
  const sourceType = newConnection.source.startsWith('lca-') ? 'lca' : 'tree';
  const targetType = newConnection.target.startsWith('lca-') ? 'lca' : 'tree';

  if ((sourceType === 'lca' && targetType === 'lca') || 
      (sourceType === 'lca' && targetType === 'tree')) {
    const updatedEdges = [...edges.value, ...lcaEdges.value].map(edge => 
      edge.id === oldEdge.id ? { ...edge, ...newConnection } : edge
    );
    edges.value = updatedEdges.filter(e => !e.source.startsWith('tree') || !e.target.startsWith('tree'));
    lcaEdges.value = updatedEdges.filter(e => e.source.startsWith('lca-') && e.target.startsWith('lca-'));
  }
};

const onNodesDelete = (deletedNodes) => {
  const nodeIds = deletedNodes.map(node => node.id);
  nodes.value = nodes.value.filter(node => !nodeIds.includes(node.id));
  lcaNodes.value = lcaNodes.value.filter(node => !nodeIds.includes(node.id));

  // Remove edges connected to deleted nodes
  edges.value = edges.value.filter(edge => 
    !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
  );
  lcaEdges.value = lcaEdges.value.filter(edge => 
    !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
  );
};

// Watchers
watchEffect(() => {
  if (!props.content.data || !Array.isArray(props.content.data)) {
    nodes.value = [];
    return;
  }
  nodes.value = calculateNodePositions(props.content.data);
});

watchEffect(() => {
  if (!props.content.data || !Array.isArray(props.content.data)) {
    edges.value = [];
    return;
  }
  edges.value = props.content.data.flatMap((item) => {
    if (!item.child_variant_ids || !Array.isArray(item.child_variant_ids)) return [];
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

watch(() => props.content.lcaStructure, (newLcaData) => {
  const { nodes: processedNodes, edges: processedEdges } = processLCAStructure(newLcaData || []);
  lcaNodes.value = processedNodes;
  lcaEdges.value = processedEdges;
  nextTick(() => {
    fitView({ padding: 0.5, includeHiddenNodes: false, duration: 800 });
  });
}, { immediate: true });

watch(() => props.content.selectedInWeWeb, (newSelectedId) => {
  if (!newSelectedId) return;
  updateHighlighting(newSelectedId);
});

watch(() => props.content.omittedNodes, (newOmittedNodes) => {
  if (Array.isArray(newOmittedNodes)) {
    omittedNodeIds.value = newOmittedNodes.map(String);
    updateAllNodes();
    updateAllEdges();
  }
}, { immediate: true });

watch([() => nodes.value.length, () => lcaNodes.value.length], ([newTreeLength, newLcaLength]) => {
  if (newTreeLength > 0 || newLcaLength > 0) {
    nextTick(() => {
      fitView({ padding: 0.5, includeHiddenNodes: false, duration: 800 });
      
      // Force repaint of nodes
      setTimeout(() => {
        document.querySelectorAll('.vue-flow__node foreignObject').forEach(fo => {
          fo.setAttribute('width', '200');
          fo.setAttribute('height', '150');
        });
      }, 100);
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
      :nodesDraggable="node => node.type === 'lcaNode'"
      :edgesUpdatable="true" 
      :edgesFocusable="true"
      :edgesDraggable="true" 
      :elevateEdgesOnSelect="true"
      :nodesConnectable="node => node.type === 'lcaNode'" 
      :connectOnClick="true"
      :nodesFocusable="true"
      :applyDefault="false"
      :selectionKeyCode="null"
      :fitView="true"
      :minZoom="0.2"
      :maxZoom="4"
      @edgesUpdate="onEdgesUpdate"
      @nodesDelete="onNodesDelete">
      
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

@font-face {
  font-family: 'NotoColorEmoji';
  src: url('https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/fonts/NotoColorEmoji.ttf') format('truetype');
  unicode-range: U+1F1E6-1F1FF;
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

.custom-node {
  display: flex !important;
  flex-direction: column !important;
  min-width: 180px !important;
  width: 100% !important;
  padding: 10px !important;
  border-radius: 4px !important;
  z-index: 999 !important;
  position: relative !important;
}

.node-name {
  font-weight: 700 !important;
  font-size: 14px !important;
  margin-bottom: 4px !important;
  opacity: 1 !important;
  visibility: visible !important;
  color: white !important;
}

.company-name {
  font-size: 12px !important;
  opacity: 0.9 !important;
  margin-bottom: 4px !important;
  visibility: visible !important;
  color: white !important;
}

.percentage {
  font-size: 13px !important;
  font-weight: 600 !important;
  margin-bottom: 4px !important;
  visibility: visible !important;
  color: white !important;
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

.tree-node {
  background-color: #3498db;
  color: white;
}

.lca-node {
  background-color: #2c3e50;
  color: white;
}

/* Vue Flow specific fixes */
.vue-flow__node-treeNode,
.vue-flow__node-lcaNode {
  overflow: visible !important;
  z-index: 1000 !important;
  pointer-events: all !important;
}

/* Target the Vue Flow internal node content */
.vue-flow__node-treeNode .vue-flow__node-default__content,
.vue-flow__node-lcaNode .vue-flow__node-default__content {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  pointer-events: all !important;
  z-index: 1000 !important;
  max-width: none !important;
  width: 100% !important;
}

/* Ensure SVG transforms don't affect text display */
.vue-flow__node-treeNode .vue-flow__node-default,
.vue-flow__node-lcaNode .vue-flow__node-default {
  height: auto !important;
  width: auto !important;
  background: transparent !important;
  border: none !important;
}

/* Force foreignObject visibility */
.vue-flow__node foreignObject {
  overflow: visible !important;
  z-index: 1000 !important;
  visibility: visible !important;
  display: block !important;
}

/* Ensure HTML content within foreignObject is visible */
.vue-flow__node foreignObject * {
  visibility: visible !important;
  opacity: 1 !important;
  color: white !important;
}

/* Fix for Vue Flow's node rendering system */
.vue-flow__node {
  overflow: visible !important;
}

/* Fix for text display */
.vue-flow__node-treeNode .vue-flow__handle,
.vue-flow__node-lcaNode .vue-flow__handle {
  z-index: 1 !important;
}

/* Ensure foreignObject renders properly */
.vue-flow__node svg {
  overflow: visible !important;
}
</style>