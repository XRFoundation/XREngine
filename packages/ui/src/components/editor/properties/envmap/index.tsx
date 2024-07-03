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

import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { UUIDComponent } from '@etherealengine/ecs'
import { getComponent, useComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { EnvMapBakeComponent } from '@etherealengine/engine/src/scene/components/EnvMapBakeComponent'
import { EnvmapComponent } from '@etherealengine/engine/src/scene/components/EnvmapComponent'
import { getEntityErrors } from '@etherealengine/engine/src/scene/components/ErrorComponent'
import { EnvMapSourceType, EnvMapTextureType } from '@etherealengine/engine/src/scene/constants/EnvMapEnum'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'

import { useQuery } from '@etherealengine/ecs/src/QueryFunctions'
import {
  EditorComponentType,
  commitProperty,
  updateProperties,
  updateProperty
} from '@etherealengine/editor/src/components/properties/Util'
import { IoMapOutline } from 'react-icons/io5'
import Button from '../../../../primitives/tailwind/Button'
import ColorInput from '../../../../primitives/tailwind/Color'
import Slider from '../../../../primitives/tailwind/Slider'
import FolderInput from '../../input/Folder'
import InputGroup from '../../input/Group'
import ImagePreviewInput from '../../input/Image/Preview'
import SelectInput from '../../input/Select'
import NodeEditor from '../nodeEditor'

/**
 * EnvMapSourceOptions array containing SourceOptions for Envmap
 */
const EnvMapSourceOptions = Object.values(EnvMapSourceType).map((value) => ({ label: value, value }))

/**
 * EnvMapSourceOptions array containing SourceOptions for Envmap
 */
const EnvMapTextureOptions = Object.values(EnvMapTextureType).map((value) => ({ label: value, value }))

/**
 * EnvMapEditor provides the editor view for environment map property customization.
 */
export const EnvMapEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()
  const entity = props.entity

  const bakeEntities = useQuery([EnvMapBakeComponent]).map((entity) => {
    return {
      label: getComponent(entity, NameComponent),
      value: getComponent(entity, UUIDComponent)
    }
  })

  const onChangeCubemapURLSource = useCallback((value) => {
    const directory = value[value.length - 1] === '/' ? value.substring(0, value.length - 1) : value
    if (directory !== directory /*envmapComponent.envMapSourceURL*/) {
      updateProperties(EnvmapComponent, { envMapSourceURL: directory })
    }
  }, [])

  const envmapComponent = useComponent(entity, EnvmapComponent)

  const errors = getEntityErrors(props.entity, EnvmapComponent)

  return (
    <NodeEditor
      {...props}
      component={EnvmapComponent}
      name={t('editor:properties.envmap.name')}
      description={t('editor:properties.envmap.description')}
      icon={<EnvMapEditor.iconComponent />}
    >
      <InputGroup name="Envmap Source" label={t('editor:properties.envmap.lbl-source')}>
        <SelectInput
          key={props.entity}
          options={EnvMapSourceOptions}
          value={envmapComponent.type.value}
          onChange={commitProperty(EnvmapComponent, 'type')}
        />
      </InputGroup>
      {envmapComponent.type.value === EnvMapSourceType.Color && (
        <InputGroup name="EnvMapColor" label={t('editor:properties.envmap.lbl-color')}>
          <ColorInput
            value={envmapComponent.envMapSourceColor.value}
            onChange={commitProperty(EnvmapComponent, 'envMapSourceColor')}
          />
        </InputGroup>
      )}
      {envmapComponent.type.value === EnvMapSourceType.Bake && (
        <InputGroup name="EnvMapBake" label={t('editor:properties.envmap.lbl-bake')}>
          <SelectInput
            options={bakeEntities}
            value={envmapComponent.envMapSourceEntityUUID.value}
            onChange={commitProperty(EnvmapComponent, 'envMapSourceEntityUUID')}
          />
        </InputGroup>
      )}
      {envmapComponent.type.value === EnvMapSourceType.Texture && (
        <div>
          <InputGroup name="Texture Type" label={t('editor:properties.envmap.lbl-textureType')}>
            <SelectInput
              key={props.entity}
              options={EnvMapTextureOptions}
              value={envmapComponent.envMapTextureType.value}
              onChange={commitProperty(EnvmapComponent, 'envMapTextureType')}
            />
          </InputGroup>
          <InputGroup name="Texture URL" label={t('editor:properties.envmap.lbl-textureUrl')}>
            {envmapComponent.envMapTextureType.value === EnvMapTextureType.Cubemap && (
              <FolderInput value={envmapComponent.envMapSourceURL.value} onRelease={onChangeCubemapURLSource} />
            )}
            {envmapComponent.envMapTextureType.value === EnvMapTextureType.Equirectangular && (
              <ImagePreviewInput
                value={envmapComponent.envMapSourceURL.value}
                onRelease={commitProperty(EnvmapComponent, 'envMapSourceURL')}
              />
            )}
            {errors?.MISSING_FILE && (
              <div style={{ marginTop: 2, color: '#FF8C00' }}>{t('editor:properties.scene.error-url')}</div>
            )}
          </InputGroup>
        </div>
      )}
      {envmapComponent.type.value === EnvMapSourceType.Probes && (
        <Button
          onClick={() => {
            commitProperty(EnvmapComponent, 'type')(EnvMapSourceType.None)
            setTimeout(() => {
              commitProperty(EnvmapComponent, 'type')(EnvMapSourceType.Probes)
            }, 1000)
          }}
        >
          {t('editor:properties.envmap.bake-reflection-probes')}
        </Button>
      )}
      {envmapComponent.type.value !== EnvMapSourceType.None && (
        <InputGroup name="EnvMap Intensity" label={t('editor:properties.envmap.lbl-intensity')}>
          <Slider
            min={0}
            max={20}
            value={envmapComponent.envMapIntensity.value}
            onChange={updateProperty(EnvmapComponent, 'envMapIntensity')}
            onRelease={commitProperty(EnvmapComponent, 'envMapIntensity')}
          />
        </InputGroup>
      )}
    </NodeEditor>
  )
}
EnvMapEditor.iconComponent = IoMapOutline
export default EnvMapEditor
