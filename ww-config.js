export default {
    editor: {
      label: 'Org Chart',
      icon: 'logos/vueflow',
      customStylePropertiesOrder: [['nodeColor', 'edgeColor', 'backgroundColor', 'omitColor']],
      customSettingsPropertiesOrder: ['data', 'lcaStructure'],
    },
    triggerEvents: [
      {
        name: 'node:click',
        label: { en: 'On Node Click' },
        event: {
          nodeId: null,
        },
        default: true,
      },
      {
        name: 'node:connect',
        label: { en: 'On Nodes Connected' },
        event: {
          sourceId: null,
          targetId: null,
        },
      },
      {
        name: 'node:omit',
        label: { en: 'On Node Omit' },
        event: {
          nodeId: null,
          omitted: null,
          omittedNodes: [],
        },
      }
    ],
    properties: {
      data: {
        label: 'Collection Data',
        type: 'Info',
        section: 'settings',
        bindable: 'list',
        defaultValue: null,
        bindingValidation: {
          type: 'array',
          tooltip: 'Array of objects representing nodes and edges.',
        },
      },
      lcaStructure: {
        label: 'LCA Structure',
        type: 'Info',
        section: 'settings',
        bindable: 'list',
        defaultValue: [],
        bindingValidation: {
          type: 'array',
          tooltip: 'LCA structure array with rank-based relationships.',
        },
      },
      selectedNodeId: {
        label: 'Selected Node ID',
        type: 'Variable',
        bindable: true,
        responsive: true,
        states: true,
        section: 'settings',
        defaultValue: null,
      },
      selectedInWeWeb: {
        label: 'Selected Node from WeWeb',
        type: 'Variable',
        bindable: true,
        responsive: true,
        states: true,
        section: 'settings',
        defaultValue: null,
      },
      omittedNodes: {
        label: 'Omitted Nodes',
        type: 'Variable',
        bindable: true,
        responsive: true,
        states: true,
        section: 'settings',
        defaultValue: [],
      },
      nodeColor: {
        label: 'Node Color',
        type: 'Color',
        section: 'style',
        bindable: true,
        defaultValue: '#3498db',
      },
      omitColor: {
        label: 'Omit Color',
        type: 'Color',
        section: 'style',
        bindable: true,
        defaultValue: '#8B0000',
      },
      edgeColor: {
        label: 'Edge Color',
        type: 'Color',
        section: 'style',
        bindable: true,
        defaultValue: '#ccc',
      },
      backgroundColor: {
        label: 'Background Color',
        type: 'Color',
        section: 'style',
        bindable: true,
        defaultValue: '#f4f4f4',
      },
    },
  };