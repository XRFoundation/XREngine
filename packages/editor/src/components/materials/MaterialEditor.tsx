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

import React, { useCallback, useEffect } from 'react'
import { Texture } from 'three'

import styles from '@etherealengine/editor/src/components/layout/styles.module.scss'

import { NO_PROXY, none, useHookstate } from '@etherealengine/hyperflux'
import createReadableTexture from '@etherealengine/spatial/src/renderer/functions/createReadableTexture'
import MaterialLibraryIcon from '@mui/icons-material/Yard'
import { Box, Divider, Stack } from '@mui/material'

import { EntityUUID, UUIDComponent, getComponent, getMutableComponent, setComponent } from '@etherealengine/ecs'
import { getTextureAsync } from '@etherealengine/engine/src/assets/functions/resourceHooks'
import { TransparencyDitheringPlugin } from '@etherealengine/engine/src/avatar/components/TransparencyDitheringComponent'
import { SourceComponent } from '@etherealengine/engine/src/scene/components/SourceComponent'
import { setMaterialName } from '@etherealengine/engine/src/scene/materials/functions/materialSourcingFunctions'
import {
  MaterialComponent,
  MaterialComponents,
  pluginByName,
  prototypeByName
} from '@etherealengine/spatial/src/renderer/materials/MaterialComponent'
import { useTranslation } from 'react-i18next'
import { EditorControlFunctions } from '../../functions/EditorControlFunctions'
import { Button } from '../inputs/Button'
import { InputGroup } from '../inputs/InputGroup'
import ParameterInput from '../inputs/ParameterInput'
import SelectInput from '../inputs/SelectInput'
import StringInput from '../inputs/StringInput'
import { PanelDragContainer, PanelIcon, PanelTitle } from '../layout/Panel'
import { InfoTooltip } from '../layout/Tooltip'

type ThumbnailData = {
  src: string
  blob: string
}

const toBlobs = (thumbnails: Record<string, ThumbnailData>): Record<string, string> => {
  const blobs = {}
  Object.entries(thumbnails).map(([k, { blob }]) => {
    blobs[k] = blob
  })
  return blobs
}

export function MaterialEditor(props: { materialUUID: EntityUUID }) {
  const { t } = useTranslation()
  const prototypes = Object.keys(prototypeByName).map((prototype) => ({
    label: prototype,
    value: prototype
  }))

  const entity = UUIDComponent.getEntityByUUID(props.materialUUID)
  const materialComponent = getMutableComponent(entity, MaterialComponent[MaterialComponents.State])
  const material = materialComponent.material.value!
  const thumbnails = useHookstate<Record<string, ThumbnailData>>({})
  const textureUnloadMap = useHookstate<Record<string, (() => void) | undefined>>({})

  const createThumbnail = async (field: string, texture: Texture) => {
    if (texture?.isTexture) {
      try {
        const blob: string = (await createReadableTexture(texture, {
          maxDimensions: { width: 256, height: 256 },
          url: true
        })) as string
        const thumbData: ThumbnailData = {
          src: texture.image?.src ?? 'BLOB',
          blob
        }
        thumbnails[field].set(thumbData)
        return Promise.resolve()
      } catch (e) {
        console.warn('failed loading thumbnail: ' + e)
      }
    }
  }

  const createThumbnails = async () => {
    const promises = Object.entries(material).map(([field, texture]: [string, Texture]) =>
      createThumbnail(field, texture)
    )
    return Promise.all(promises)
  }

  const checkThumbs = async () => {
    thumbnails.promised && (await thumbnails.promise)
    const thumbnailVals = thumbnails.value
    Object.entries(thumbnailVals).map(([k, { blob }]) => {
      if (!material[k]) {
        URL.revokeObjectURL(blob)
        thumbnails[k].set(none)
      }
    })
    await Promise.all(
      Object.entries(material).map(async ([field, texture]: [string, Texture]) => {
        if (texture?.isTexture) {
          if (!thumbnails[field]?.value || thumbnails[field]?.value?.src !== texture.image?.src)
            await createThumbnail(field, texture)
        }
      })
    )
  }

  const clearThumbs = useCallback(async () => {
    Object.values(thumbnails.value).map(({ blob }) => URL.revokeObjectURL(blob))
    thumbnails.set({})
  }, [])

  const prototypeName = useHookstate('')
  const materialName = useHookstate('')

  useEffect(() => {
    clearThumbs().then(createThumbnails).then(checkThumbs)
  }, [materialName, prototypeName])

  const prototypeEntity = materialComponent.prototypeEntity.value!
  const prototype = getMutableComponent(prototypeEntity, MaterialComponent[MaterialComponents.Prototype])

  const selectedPlugin = useHookstate(TransparencyDitheringPlugin.id)

  materialName.set(material.name)
  prototypeName.set(material.type)

  const parameters = useHookstate(0)
  return (
    <div style={{ position: 'relative' }}>
      <InputGroup name="Name" label={t('editor:properties.mesh.material.name')}>
        <StringInput
          value={materialComponent.material.value!.name}
          onChange={(name) => setMaterialName(entity, name)}
        />
      </InputGroup>
      <InputGroup name="Source" label={t('editor:properties.mesh.material.source')}>
        <div className={styles.contentContainer}>
          <Box className="Box" sx={{ padding: '8px', overflow: 'scroll' }}>
            <Stack className="Stack" spacing={2} direction="column" alignContent={'center'}>
              <Stack className="Stack" spacing={2} direction="row" alignContent={'flex-start'}></Stack>
              <Stack className="Stack" spacing={2} direction="row">
                <div>
                  <label>{t('editor:properties.mesh.material.path')}</label>
                </div>
                <div>{getComponent(entity, SourceComponent)}</div>
              </Stack>
            </Stack>
          </Box>
        </div>
      </InputGroup>
      <br />
      <InputGroup name="Prototype" label={t('editor:properties.mesh.material.prototype')}>
        <SelectInput
          value={prototypeName.value}
          options={prototypes}
          onChange={(protoId) => {
            if (materialComponent.prototypeEntity.value) materialComponent.prototypeEntity.set(prototypeByName[protoId])
            prototypeName.set(protoId)
          }}
        />
      </InputGroup>
      <Divider className={styles.divider} />
      <ParameterInput
        entity={props.materialUUID}
        values={materialComponent.parameters.value!}
        onChange={(k) => async (val) => {
          let prop
          if (prototype.prototypeArguments![k].type === 'texture' && typeof val === 'string') {
            if (val) {
              const priorUnload = textureUnloadMap.get(NO_PROXY)[k]
              if (priorUnload) {
                priorUnload()
              }
              const [texture, unload] = await getTextureAsync(val)
              textureUnloadMap.merge({ [k]: unload })
              prop = texture
            } else {
              prop = null
            }
          } else {
            prop = val
          }
          EditorControlFunctions.modifyMaterial(
            [materialComponent.material.value!.uuid],
            materialComponent.material.value!.uuid as EntityUUID,
            [{ [k]: prop }]
          )
          parameters.set(parameters.value + 1)
          if (materialComponent.parameters.value) materialComponent.parameters[k].set(prop)
        }}
        defaults={prototype.prototypeArguments!.value}
        thumbnails={toBlobs(thumbnails.value)}
      />
      <br />
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid #fff',
          borderRadius: '4px',
          padding: '4px'
        }}
      >
        <SelectInput
          value={selectedPlugin.value}
          options={Object.keys(pluginByName).map((key) => ({ label: key, value: key }))}
          onChange={selectedPlugin.set}
        />
        <Button
          onClick={() => {
            setComponent(entity, MaterialComponent[MaterialComponents.State], {
              pluginEntities: [...(materialComponent.pluginEntities.value ?? []), pluginByName[selectedPlugin.value]!]
            })
          }}
        >
          {t('editor:properties.mesh.material.addPlugin')}
        </Button>
      </div>
    </div>
  )
}

export const MaterialPropertyTitle = () => {
  const { t } = useTranslation()

  return (
    <div className={styles.dockableTab}>
      <PanelDragContainer>
        <PanelIcon as={MaterialLibraryIcon} size={12} />
        <PanelTitle>
          <InfoTooltip title={t('editor:properties.mesh.materialProperties.info')}>
            <span>{t('editor:properties.mesh.materialProperties.title')}</span>
          </InfoTooltip>
        </PanelTitle>
      </PanelDragContainer>
    </div>
  )
}

export default MaterialEditor
