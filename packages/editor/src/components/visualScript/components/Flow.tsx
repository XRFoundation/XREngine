/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and 
provide for limited attribution for the Original Developer. In addition, 
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023 
Ethereal Engine. All Rights Reserved.
*/

import { useVisualScriptRunner } from '@etherealengine/engine/src/visualscript/systems/useVisualScriptRunner'
import { GraphJSON, IRegistry } from '@etherealengine/visual-script'
import { useHookstate } from '@hookstate/core'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Background, BackgroundVariant, NodeToolbar, Panel, Position, ReactFlow } from 'reactflow'
import { PropertiesPanelButton } from '../../inputs/Button'
import { useFlowHandlers } from '../hooks/useFlowHandlers'
import { useNodeSpecGenerator } from '../hooks/useNodeSpecGenerator'
import { useSelectionHandler } from '../hooks/useSelectionHandler'
import { useTemplateHandler } from '../hooks/useTemplateHandler'
import { useVariableHandler } from '../hooks/useVariableHandler'
import { useVisualScriptFlow } from '../hooks/useVisualScriptFlow'
import CustomControls from './Controls'
import { NodePicker } from './NodePicker'
import SidePanel from './SidePanel'
import { Examples } from './modals/LoadModal'

type FlowProps = {
  initialVisualScript: GraphJSON
  examples: Examples
  registry: IRegistry
  onChangeVisualScript: (newVisualScript: GraphJSON) => void
}

export const Flow: React.FC<FlowProps> = ({
  initialVisualScript: visualScript,
  examples,
  registry,
  onChangeVisualScript
}) => {
  const specGenerator = useNodeSpecGenerator(registry)
  const flowRef = useRef(null)
  const dragging = useHookstate(false)
  const mouseOver = useHookstate(false)
  const { t } = useTranslation()

  const {
    nodes,
    edges,
    variables,
    setVariables,
    onNodesChange,
    onEdgesChange,
    visualScriptJson,
    setVisualScriptJson,
    deleteNodes,
    nodeTypes
  } = useVisualScriptFlow({
    initialVisualScriptJson: visualScript,
    specGenerator
  })

  const {
    onConnect,
    handleStartConnect,
    handleStopConnect,
    handlePaneClick,
    handlePaneContextMenu,
    nodePickerVisibility,
    handleAddNode,
    lastConnectStart,
    closeNodePicker,
    nodePickFilters
  } = useFlowHandlers({
    nodes,
    onEdgesChange,
    onNodesChange,
    specGenerator
  })

  const { handleAddVariable, handleEditVariable, handleDeleteVariable } = useVariableHandler({
    variables,
    setVariables
  })

  const { togglePlay, playing } = useVisualScriptRunner({
    visualScriptJson,
    registry
  })

  const { selectedNodes, selectedEdges, onSelectionChange, copyNodes, pasteNodes } = useSelectionHandler({
    nodes,
    onNodesChange,
    onEdgesChange
  })

  const { handleAddTemplate, handleEditTemplate, handleDeleteTemplate, handleApplyTemplate } = useTemplateHandler({
    selectedNodes,
    selectedEdges,
    pasteNodes,
    onNodesChange
  })

  useEffect(() => {
    if (dragging.value || !mouseOver.value) return
    onChangeVisualScript(visualScriptJson ?? visualScript)
  }, [visualScriptJson]) // change in node position triggers reactor

  return (
    <ReactFlow
      ref={flowRef}
      nodeTypes={nodeTypes}
      nodes={nodes}
      edges={edges}
      onNodeDragStart={() => dragging.set(true)}
      onNodeDragStop={() => dragging.set(false)}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodesDelete={deleteNodes}
      onConnectStart={handleStartConnect}
      onConnectEnd={handleStopConnect}
      onPaneMouseEnter={() => mouseOver.set(true)}
      onPaneMouseLeave={() => mouseOver.set(false)}
      fitView
      fitViewOptions={{ maxZoom: 1 }}
      onPaneClick={handlePaneClick}
      onPaneContextMenu={handlePaneContextMenu}
      onSelectionChange={onSelectionChange}
      multiSelectionKeyCode={'Shift'}
      deleteKeyCode={'Backspace'}
    >
      <Panel position="top-left" style={{ width: '25%' }}>
        <SidePanel
          flowref={flowRef}
          examples={examples}
          variables={variables}
          onNodesChange={onNodesChange}
          handleAddTemplate={handleAddTemplate}
          handleApplyTemplate={handleApplyTemplate}
          handleDeleteTemplate={handleDeleteTemplate}
          handleEditTemplate={handleEditTemplate}
          handleAddVariable={handleAddVariable}
          handleEditVariable={handleEditVariable}
          handleDeleteVariable={handleDeleteVariable}
        />
      </Panel>

      <CustomControls
        playing={playing}
        togglePlay={togglePlay}
        onSaveVisualScript={onChangeVisualScript}
        setVisualScript={setVisualScriptJson}
        examples={examples}
        variables={variables}
        specGenerator={specGenerator}
      />
      <Background variant={BackgroundVariant.Lines} color="#2a2b2d" style={{ backgroundColor: '#1E1F22' }} />
      {nodePickerVisibility && (
        <NodePicker
          flowRef={flowRef}
          position={nodePickerVisibility}
          filters={nodePickFilters}
          onPickNode={handleAddNode}
          onClose={closeNodePicker}
          specJSON={specGenerator?.getAllNodeSpecs()}
        />
      )}

      <NodeToolbar
        nodeId={selectedNodes.map((node) => node.id)}
        isVisible={selectedNodes.length > 1}
        position={Position.Top}
      >
        <PropertiesPanelButton
          style={{}}
          onClick={() => {
            handleAddTemplate()
          }}
        >
          {t('editor:visualScript.editorPanel.makeTemplate')}
        </PropertiesPanelButton>
      </NodeToolbar>
    </ReactFlow>
  )
}
