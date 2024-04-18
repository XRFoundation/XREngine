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

import React from 'react'

import { useComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { EnvMapBakeComponent } from '@etherealengine/engine/src/scene/components/EnvMapBakeComponent'
import { EnvMapBakeTypes } from '@etherealengine/engine/src/scene/types/EnvMapBakeTypes'

import SportsGolfIcon from '@mui/icons-material/SportsGolf'

import { uploadBPCEMBakeToServer } from '../../functions/uploadEnvMapBake'
import BooleanInput from '../inputs/BooleanInput'
import { PropertiesPanelButton } from '../inputs/Button'
import InputGroup from '../inputs/InputGroup'
import SelectInput from '../inputs/SelectInput'
import Vector3Input from '../inputs/Vector3Input'
import { EnvMapBakeProperties } from './EnvMapBakeProperties'
import NodeEditor from './NodeEditor'
import { commitProperty, updateProperty } from './Util'

export const enum BakePropertyTypes {
  'Boolean',
  'BakeType',
  'RefreshMode',
  'Resolution',
  'Vector'
}

const DefaultEnvMapBakeSettings = [
  {
    label: 'Bake Settings',
    options: [
      {
        label: 'Type',
        propertyName: 'bakeType',
        type: BakePropertyTypes.BakeType
      },
      {
        label: 'Scale',
        propertyName: 'bakeScale',
        type: BakePropertyTypes.Vector
      }
    ]
  },
  {
    label: 'Realtime Settings',
    options: [
      {
        label: 'Refresh Mode',
        propertyName: 'refreshMode',
        type: BakePropertyTypes.RefreshMode
      }
    ]
  },

  {
    label: 'Settings',
    options: [
      {
        label: 'Box Projection',
        propertyName: 'boxProjection',
        type: BakePropertyTypes.Boolean
      }
    ]
  },
  {
    label: 'Capture Settings',
    options: [
      {
        label: 'Resolution',
        propertyName: 'resolution',
        type: BakePropertyTypes.Resolution
      }
    ]
  }
]

const bakeResolutionTypes = [256, 512, 1024, 2048]

const titleLabelStyle = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'left',
  fontWeight: 'bold',
  color: 'var(--textColor)',
  padding: '0 8px 8px',
  ':last-child': {
    marginLeft: 'auto'
  }
}

const envMapBakeNodeEditorStyle = {}

export const EnvMapBakeNodeEditor = (props) => {
  const bakeComponent = useComponent(props.entity, EnvMapBakeComponent)
  const renderEnvMapBakeProperties = () => {
    const renderedProperty = DefaultEnvMapBakeSettings.map((element, id) => {
      if (element.label == 'Realtime Settings' && bakeComponent.bakeType.value == EnvMapBakeTypes.Realtime) {
        return <div key={id + 'Realtime'} />
      }

      const renderProp = element.label
        ? [
            <div style={titleLabelStyle as React.CSSProperties} key={id + 'title'}>
              {element.label}
            </div>
          ]
        : []

      element.options?.forEach((property, propertyid) => {
        renderProp.push(
          <EnvMapBakeProperties
            key={id + '' + propertyid}
            element={property}
            bakeComponent={bakeComponent.value}
            entity={props.entity}
          />
        )
      })

      renderProp.push(<br key={id + 'break'} />)
      return renderProp
    })

    return renderedProperty
  }

  const onChangePosition = (value) => {
    bakeComponent.bakePositionOffset.value.copy(value)
  }
  const onChangeScale = (value) => {
    bakeComponent.bakeScale.value.copy(value)
  }

  return (
    <NodeEditor
      style={envMapBakeNodeEditorStyle}
      {...props}
      name="EnvMap Bake"
      description="For Adding EnvMap bake in your scene"
    >
      <PropertiesPanelButton onClick={() => uploadBPCEMBakeToServer(props.entity)}>Bake</PropertiesPanelButton>
      <InputGroup name="Position" label="Position Offset">
        <Vector3Input
          value={bakeComponent.bakePositionOffset.value}
          onChange={updateProperty(EnvMapBakeComponent, 'bakePositionOffset')}
          onRelease={commitProperty(EnvMapBakeComponent, 'bakePositionOffset')}
        />
      </InputGroup>
      <InputGroup name="Scale" label="Scale">
        <Vector3Input
          value={bakeComponent.bakeScale.value}
          onChange={updateProperty(EnvMapBakeComponent, 'bakeScale')}
          onRelease={commitProperty(EnvMapBakeComponent, 'bakeScale')}
        />
      </InputGroup>
      <InputGroup name="Type" label="Bake Type">
        <SelectInput
          options={[
            { label: 'Baked', value: 'Baked' },
            { label: 'Realtime', value: 'Realtime' }
          ]}
          key={props.entity}
          value={bakeComponent.bakeType.value}
          onChange={commitProperty(EnvMapBakeComponent, 'bakeType')}
        />
      </InputGroup>
      <InputGroup name="Bake Resolution" label="Bake Resolution">
        <SelectInput
          options={bakeResolutionTypes.map((resolution) => ({ label: resolution.toString(), value: resolution }))}
          key={props.entity}
          value={bakeComponent.resolution.value}
          onChange={commitProperty(EnvMapBakeComponent, 'resolution')}
        />
      </InputGroup>
      <InputGroup name="Box Projection" label="Box Projection">
        <BooleanInput
          value={bakeComponent.boxProjection.value}
          onChange={commitProperty(EnvMapBakeComponent, 'boxProjection')}
        />
      </InputGroup>
    </NodeEditor>
  )
}

EnvMapBakeNodeEditor.iconComponent = SportsGolfIcon
export default EnvMapBakeNodeEditor
