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
import { useTranslation } from 'react-i18next'
import { MdPanTool } from 'react-icons/md'

import { useComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import {
  commitProperty,
  EditorComponentType,
  updateProperty
} from '@etherealengine/editor/src/components/properties/Util'
import { SceneDynamicLoadTagComponent } from '@etherealengine/engine/src/scene/components/SceneDynamicLoadTagComponent'
import BooleanInput from '../../input/Boolean'
import InputGroup from '../../input/Group'
import NumericInput from '../../input/Numeric'
import SelectInput from '../../input/Select'
import NodeEditor from '../nodeEditor'

export const SceneDynamicLoadTagEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()
  const component = useComponent(props.entity, SceneDynamicLoadTagComponent)

  return (
    <NodeEditor
      {...props}
      name={t('editor:properties.sceneDynamicLoadTag.name')}
      description={t('editor:properties.sceneDynamicLoadTag.description')}
      icon={<SceneDynamicLoadTagEditor.iconComponent />}
    >
      <InputGroup name="mode" label={t('editor:properties.sceneDynamicLoadTag.lbl-mode')}>
        <SelectInput
          options={[
            { label: 'distance', value: 'distance' },
            { label: 'trigger', value: 'trigger' }
          ]}
          value={component.mode.value}
          onChange={commitProperty(SceneDynamicLoadTagComponent, 'mode')}
        />
      </InputGroup>
      <InputGroup name="Distance" label={t('editor:properties.sceneDynamicLoadTag.lbl-distance')}>
        <NumericInput
          value={component.distance.value}
          onChange={updateProperty(SceneDynamicLoadTagComponent, 'distance')}
          onRelease={commitProperty(SceneDynamicLoadTagComponent, 'distance')}
        />
      </InputGroup>
      <InputGroup name="Bass" label={t('editor:properties.sceneDynamicLoadTag.lbl-loaded')}>
        <BooleanInput
          value={component.loaded.value}
          onChange={commitProperty(SceneDynamicLoadTagComponent, 'loaded')}
        />
      </InputGroup>
    </NodeEditor>
  )
}

SceneDynamicLoadTagEditor.iconComponent = MdPanTool

export default SceneDynamicLoadTagEditor
