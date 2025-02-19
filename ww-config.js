export default {
  editor: {
      label: 'Org Chart',
      icon: 'logos/vueflow',
      customStylePropertiesOrder: [['nodeColor', 'edgeColor', 'backgroundColor']],
      customSettingsPropertiesOrder: ['data'],
  },
  triggerEvents: [
      {
          name: 'node:click',
          label: { en: 'On Node Click' },
          event: {
              nodeId: null,
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
      selectedNodeId: {
          label: 'Selected Node ID',
          type: 'Variable',
          bindable: true,
          responsive: true,
          states: true,
          section: 'settings',
          defaultValue: null,
      },
      selectedInWeWeb: { // ✅ Allow external selection from WeWeb
          label: 'Selected Node from WeWeb',
          type: 'Variable',
          bindable: true,
          responsive: true,
          states: true,
          section: 'settings',
          defaultValue: null,
      },
      nodeColor: {
          label: 'Node Color',
          type: 'Color',
          section: 'style',
          bindable: true,
          defaultValue: '#3498db',
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

