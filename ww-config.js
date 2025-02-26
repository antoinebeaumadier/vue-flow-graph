export default {
    editor: {
        label: 'Dual Tree Chart',
        icon: 'logos/vueflow',
        customStylePropertiesOrder: [['nodeColor', 'edgeColor', 'lcaNodeColor', 'lcaEdgeColor', 'backgroundColor']],
        customSettingsPropertiesOrder: ['data', 'lcaData', 'deactivatedNodes', 'userConnections'],
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
            name: 'lca-node:click',
            label: { en: 'On LCA Node Click' },
            event: {
                nodeId: null,
            },
        },
        {
            name: 'node:activation-change',
            label: { en: 'On Node Activation Change' },
            event: {
                nodeId: null,
                activated: true,
            },
        },
        {
            name: 'connection:created',
            label: { en: 'On Connection Created' },
            event: {
                sourceId: null,
                targetId: null,
            },
        },
        {
            name: 'connection:removed',
            label: { en: 'On Connection Removed' },
            event: {
                connectionId: null,
            },
        }
    ],
    properties: {
        data: {
            label: 'Organization Data',
            type: 'Info',
            section: 'settings',
            bindable: 'list',
            defaultValue: null,
            bindingValidation: {
                type: 'array',
                tooltip: 'Array of objects representing organization nodes and edges.',
            },
        },
        lcaData: {
            label: 'LCA Structure Data',
            type: 'Info',
            section: 'settings',
            bindable: 'list',
            defaultValue: null,
            bindingValidation: {
                type: 'array',
                tooltip: 'Array of objects representing LCA structure nodes by rank.',
            },
        },
        deactivatedNodes: {
            label: 'Deactivated Nodes',
            type: 'Array',
            section: 'settings',
            bindable: true,
            responsive: true,
            states: true,
            defaultValue: [],
            bindingValidation: {
                type: 'array',
                tooltip: 'Array of node IDs that are deactivated.',
            },
        },
        userConnections: {
            label: 'User-Created Connections',
            type: 'Array',
            section: 'settings',
            bindable: true,
            responsive: true,
            states: true,
            defaultValue: [],
            bindingValidation: {
                type: 'array',
                tooltip: 'Array of user-created connections between nodes.',
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
        nodeColor: {
            label: 'Organization Node Color',
            type: 'Color',
            section: 'style',
            bindable: true,
            defaultValue: '#3498db',
        },
        edgeColor: {
            label: 'Organization Edge Color',
            type: 'Color',
            section: 'style',
            bindable: true,
            defaultValue: '#ccc',
        },
        lcaNodeColor: {
            label: 'LCA Node Color',
            type: 'Color',
            section: 'style',
            bindable: true,
            defaultValue: '#34495e',
        },
        lcaEdgeColor: {
            label: 'LCA Edge Color',
            type: 'Color',
            section: 'style',
            bindable: true,
            defaultValue: '#34495e',
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