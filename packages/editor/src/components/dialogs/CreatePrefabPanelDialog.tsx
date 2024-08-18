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

import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'
import config from '@etherealengine/common/src/config'
import { staticResourcePath } from '@etherealengine/common/src/schema.type.module'
import { pathJoin } from '@etherealengine/common/src/utils/miscUtils'
import {
  Engine,
  Entity,
  createEntity,
  entityExists,
  getComponent,
  removeEntity,
  setComponent
} from '@etherealengine/ecs'
import PrefabConfirmationPanelDialog from '@etherealengine/editor/src/components/dialogs/PrefabConfirmationPanelDialog'
import { GLTFDocumentState } from '@etherealengine/engine/src/gltf/GLTFDocumentState'
import { ModelComponent } from '@etherealengine/engine/src/scene/components/ModelComponent'
import { SourceComponent } from '@etherealengine/engine/src/scene/components/SourceComponent'
import { proxifyParentChildRelationships } from '@etherealengine/engine/src/scene/functions/loadGLTFModel'
import { getMutableState, getState, startReactor, useHookstate } from '@etherealengine/hyperflux'
import { TransformComponent } from '@etherealengine/spatial'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import Input from '@etherealengine/ui/src/primitives/tailwind/Input'
import Modal from '@etherealengine/ui/src/primitives/tailwind/Modal'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Quaternion, Scene, Vector3 } from 'three'
import { EditorControlFunctions } from '../../functions/EditorControlFunctions'
import { exportRelativeGLTF } from '../../functions/exportGLTF'
import { EditorState } from '../../services/EditorServices'
import { SelectionState } from '../../services/SelectionServices'

export default function CreatePrefabPanel({ entity }: { entity: Entity }) {
  const defaultPrefabFolder = useHookstate<string>('assets/custom-prefabs')
  const prefabName = useHookstate<string>('prefab')
  const prefabTag = useHookstate<string[]>([])
  const { t } = useTranslation()

  const onExportPrefab = async () => {
    const editorState = getState(EditorState)
    const fileName = defaultPrefabFolder.value + '/' + prefabName.value + '.gltf'
    const srcProject = editorState.projectName!
    const fileURL = pathJoin(config.client.fileServer, 'projects', srcProject, fileName)
    try {
      const parentEntity = getComponent(entity, EntityTreeComponent).parentEntity
      const prefabEntity = createEntity()
      const obj = new Scene()
      addObjectToGroup(prefabEntity, obj)
      proxifyParentChildRelationships(obj)
      setComponent(prefabEntity, EntityTreeComponent, { parentEntity })
      setComponent(prefabEntity, NameComponent, prefabName.value)
      const entityTransform = getComponent(entity, TransformComponent)
      const position = entityTransform.position.clone()
      const rotation = entityTransform.rotation.clone()
      const scale = entityTransform.scale.clone()
      setComponent(prefabEntity, TransformComponent, {
        position,
        rotation,
        scale
      })
      setComponent(entity, TransformComponent, {
        position: new Vector3(0, 0, 0),
        rotation: new Quaternion().identity(),
        scale: new Vector3(1, 1, 1)
      })
      setComponent(entity, EntityTreeComponent, { parentEntity: prefabEntity })
      getMutableState(SelectionState).selectedEntities.set([])
      await exportRelativeGLTF(prefabEntity, srcProject, fileName)

      const resources = await Engine.instance.api.service(staticResourcePath).find({
        query: { key: 'projects/' + srcProject + '/' + fileName }
      })
      if (resources.data.length === 0) {
        throw new Error('User not found')
      }
      const resource = resources.data[0]
      const tags = [...prefabTag.value]
      await Engine.instance.api.service(staticResourcePath).patch(resource.id, { tags: tags, project: srcProject })

      removeEntity(prefabEntity)
      EditorControlFunctions.removeObject([entity])
      const sceneID = getComponent(parentEntity, SourceComponent)
      const reactor = startReactor(() => {
        const documentState = useHookstate(getMutableState(GLTFDocumentState))
        const nodes = documentState[sceneID].nodes
        useEffect(() => {
          if (!entityExists(entity)) {
            const { entityUUID } = EditorControlFunctions.createObjectFromSceneElement(
              [
                { name: ModelComponent.jsonID, props: { src: fileURL } },
                { name: TransformComponent.jsonID, props: { position, rotation, scale } }
              ],
              parentEntity
            )
            getMutableState(SelectionState).selectedEntities.set([entityUUID])
            reactor.stop()
          } else {
            console.log('Entity not removed')
          }
        }, [nodes])
        return null
      })
      PopoverState.hidePopupover()
      defaultPrefabFolder.set('assets/custom-prefabs')
      prefabName.set('prefab')
      prefabTag.set([])

      PopoverState.showPopupover(<PrefabConfirmationPanelDialog entity={entity} />)
    } catch (e) {
      console.error(e)
    }
  }
  return (
    <Modal
      title="Create Prefab"
      onSubmit={onExportPrefab}
      className="w-[50vw] max-w-2xl"
      onClose={PopoverState.hidePopupover}
    >
      <Input
        value={defaultPrefabFolder.value}
        onChange={(event) => defaultPrefabFolder.set(event.target.value)}
        label="Default Save Folder"
      />
      <Input value={prefabName.value} onChange={(event) => prefabName.set(event.target.value)} label="Name" />

      <Button
        size="small"
        variant="outline"
        className="text-left text-xs"
        onClick={() => {
          prefabTag.set([...(prefabTag.value ?? []), ''])
        }}
      >
        {t('editor:layout.filebrowser.fileProperties.addTag')}
      </Button>
      <div>
        {(prefabTag.value ?? []).map((tag, index) => (
          <div style={{ display: 'flex', flexDirection: 'row', margin: '0, 16px 0 0' }}>
            <Input
              key={index}
              label={t('editor:layout.filebrowser.fileProperties.tag')}
              onChange={(event) => {
                const tags = [...prefabTag.value]
                tags[index] = event.target.value
                prefabTag.set(tags)
              }}
              value={prefabTag.value[index]}
            />
            <Button
              onClick={() => {
                prefabTag.set(prefabTag.value.filter((_, i) => i !== index))
              }}
              size="small"
              variant="outline"
              className="text-left text-xs"
            >
              {' '}
              x{' '}
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
