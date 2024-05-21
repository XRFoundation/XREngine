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

import { LayoutData } from 'rc-dock'

import { EntityUUID, getComponent } from '@etherealengine/ecs'
import { Entity, UndefinedEntity } from '@etherealengine/ecs/src/Entity'
import { GLTFModifiedState } from '@etherealengine/engine/src/gltf/GLTFDocumentState'
import { SourceComponent } from '@etherealengine/engine/src/scene/components/SourceComponent'
import { defineState, getState, syncStateWithLocalStorage } from '@etherealengine/hyperflux'

interface IExpandedNodes {
  [scene: string]: {
    [entity: Entity]: true
  }
}

export const EditorState = defineState({
  name: 'EditorState',
  initial: () => ({
    projectName: null as string | null,
    sceneName: null as string | null,
    /** the url of the current scene file */
    scenePath: null as string | null,
    /** just used to store the id of the current scene asset */
    sceneAssetID: null as string | null,
    expandedNodes: {} as IExpandedNodes,
    lockPropertiesPanel: '' as EntityUUID,
    panelLayout: {} as LayoutData,
    rootEntity: UndefinedEntity
  }),
  isModified: () => {
    const rootEntity = getState(EditorState).rootEntity
    if (!rootEntity) return false
    return !!getState(GLTFModifiedState)[getComponent(rootEntity, SourceComponent)]
  },
  extension: syncStateWithLocalStorage(['expandedNodes'])
})
