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

import { useComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { getEntityErrors } from '@etherealengine/engine/src/scene/components/ErrorComponent'
import { ReflectionProbeComponent } from '@etherealengine/engine/src/scene/components/ReflectionProbeComponent'

import { EditorComponentType, commitProperty } from '@etherealengine/editor/src/components/properties/Util'
import { IoMapOutline } from 'react-icons/io5'
import InputGroup from '../../input/Group'
import ImagePreviewInput from '../../input/Image/Preview'
import NodeEditor from '../nodeEditor'

/**
 * ReflectionProbeEditor provides the editor view for reflection probe property customization.
 */
export const ReflectionProbeEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()
  const entity = props.entity

  const reflectionProbeComponent = useComponent(entity, ReflectionProbeComponent)

  const errors = getEntityErrors(props.entity, ReflectionProbeComponent)

  return (
    <NodeEditor
      {...props}
      component={ReflectionProbeComponent}
      name={t('editor:properties.reflectionProbe.name')}
      description={t('editor:properties.reflectionProbe.description')}
      icon={<ReflectionProbeEditor.iconComponent />}
    >
      <div>
        <InputGroup name="Texture URL" label={t('editor:properties.reflectionProbe.src')}>
          <ImagePreviewInput
            value={reflectionProbeComponent.src.value}
            onRelease={commitProperty(ReflectionProbeComponent, 'src')}
          />
          {errors?.LOADING_ERROR && (
            <div style={{ marginTop: 2, color: '#FF8C00' }}>{t('editor:properties.scene.error-url')}</div>
          )}
        </InputGroup>
      </div>
    </NodeEditor>
  )
}
ReflectionProbeEditor.iconComponent = IoMapOutline
export default ReflectionProbeEditor
