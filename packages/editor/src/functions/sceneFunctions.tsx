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

import i18n from 'i18next'

import config from '@etherealengine/common/src/config'
import multiLogger from '@etherealengine/common/src/logger'
import { StaticResourceType, fileBrowserPath, staticResourcePath } from '@etherealengine/common/src/schema.type.module'
import { cleanString } from '@etherealengine/common/src/utils/cleanString'
import { EntityUUID, UUIDComponent, UndefinedEntity } from '@etherealengine/ecs'
import { getComponent, setComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { GLTFComponent } from '@etherealengine/engine/src/gltf/GLTFComponent'
import { GLTFDocumentState } from '@etherealengine/engine/src/gltf/GLTFDocumentState'
import { GLTFSourceState } from '@etherealengine/engine/src/gltf/GLTFState'
import { handleScenePaths } from '@etherealengine/engine/src/scene/functions/GLTFConversion'
import { getMutableState, getState } from '@etherealengine/hyperflux'
import { EngineState } from '@etherealengine/spatial/src/EngineState'
import { tryStopPlayMode } from '@etherealengine/spatial/src/common/functions/PlayModeFunctions'
import { SceneComponent } from '@etherealengine/spatial/src/renderer/components/SceneComponents'
import { Params } from '@feathersjs/feathers'
import { EditorState } from '../services/EditorServices'
import { uploadProjectFiles } from './assetFunctions'

const logger = multiLogger.child({ component: 'editor:sceneFunctions' })

/**
 * deleteScene used to delete project using projectId.
 *
 * @param  {string}  sceneId
 * @return {Promise}
 */
export const deleteScene = async (sceneKey: string): Promise<any> => {
  try {
    await Engine.instance.api.service(fileBrowserPath).remove(sceneKey)
  } catch (error) {
    logger.error(error, 'Error in deleting project')
    throw error
  }
  return true
}

export const renameScene = async (
  resource: StaticResourceType,
  newKey: string,
  projectName: string,
  params?: Params
) => {
  const oldPath = resource.key
  const newPath = newKey
  const oldName = resource.key.split('/').pop()!
  const newName = newKey.split('/').pop()!
  try {
    return await Engine.instance.api
      .service(fileBrowserPath)
      .update(null, { oldProject: projectName, newProject: projectName, oldPath, newPath, oldName, newName }, params)
  } catch (error) {
    logger.error(error, 'Error in renaming project')
    throw error
  }
}

const fileServer = config.client.fileServer

export const saveSceneGLTF = async (
  sceneAssetID: string,
  projectName: string,
  sceneFile: string,
  signal: AbortSignal,
  saveAs?: boolean
) => {
  if (signal.aborted) throw new Error(i18n.t('editor:errors.saveProjectAborted'))

  const { rootEntity } = getState(EditorState)
  const sourceID = `${getComponent(rootEntity, UUIDComponent)}-${getComponent(rootEntity, GLTFComponent).src}`

  const sceneName = cleanString(sceneFile!.replace('.scene.json', '').replace('.gltf', ''))
  const currentSceneDirectory = getState(EditorState).scenePath!.split('/').slice(0, -1).join('/')

  if (saveAs) {
    const existingScene = await Engine.instance.api.service(staticResourcePath).find({
      query: { key: `${currentSceneDirectory}/${sceneName}.gltf`, $limit: 1 }
    })

    if (existingScene.data.length > 0) throw new Error(i18n.t('editor:errors.sceneAlreadyExists'))
  }

  const gltfData = getState(GLTFDocumentState)[sourceID]
  if (!gltfData) {
    logger.error('Failed to save scene, no gltf data found')
  }
  const encodedGLTF = handleScenePaths(gltfData, 'encode')
  const blob = [JSON.stringify(encodedGLTF, null, 2)]
  const file = new File(blob, `${sceneName}.gltf`)

  const currentScene = await Engine.instance.api.service(staticResourcePath).get(sceneAssetID)

  const [[newPath]] = await Promise.all(
    uploadProjectFiles(
      projectName,
      [file],
      [currentSceneDirectory],
      [
        {
          type: 'scene',
          contentType: 'model/gltf+json',
          thumbnailKey: currentScene.thumbnailKey
        }
      ]
    ).promises
  )

  const newURL = new URL(newPath)
  newURL.hash = ''
  newURL.search = ''
  const assetURL = newURL.href.replace(fileServer, '').slice(1) // remove leading slash

  const result = await Engine.instance.api.service(staticResourcePath).find({
    query: { key: assetURL, $limit: 1 }
  })

  if (result.total !== 1) {
    throw new Error(i18n.t('editor:errors.sceneSaveFailed'))
  }

  getMutableState(EditorState).merge({
    sceneName,
    scenePath: assetURL,
    projectName,
    sceneAssetID: result.data[0].id
  })
}

export const createScene = async (
  projectName: string,
  templateURL = config.client.fileServer + '/projects/etherealengine/default-project/public/scenes/default.gltf'
) => {
  const sceneData = await Engine.instance.api.service(fileBrowserPath).patch(null, {
    project: projectName,
    type: 'scene',
    body: templateURL,
    path: 'public/scenes/New-Scene.gltf',
    thumbnailKey: templateURL.replace(`${config.client.fileServer}/`, '').replace('.gltf', '.thumbnail.jpg'),
    unique: true
  })
  return sceneData
}

export const onNewScene = async (
  templateURL = config.client.fileServer + '/projects/etherealengine/default-project/public/scenes/default.gltf'
) => {
  const { projectName } = getState(EditorState)
  if (!projectName) return

  try {
    const sceneData = await createScene(projectName, templateURL)
    if (!sceneData) return
    const sceneName = sceneData.key.split('/').pop()

    getMutableState(EditorState).merge({
      sceneName,
      scenePath: sceneData.key,
      projectName: projectName,
      sceneAssetID: sceneData.id
    })
  } catch (error) {
    logger.error(error)
  }
}

export const setCurrentEditorScene = (sceneURL: string, uuid: EntityUUID) => {
  tryStopPlayMode()
  const gltfEntity = GLTFSourceState.load(sceneURL, uuid, getState(EngineState).originEntity)
  setComponent(gltfEntity, SceneComponent)
  getMutableState(EditorState).rootEntity.set(gltfEntity)
  return () => {
    getMutableState(EditorState).rootEntity.set(UndefinedEntity)
    GLTFSourceState.unload(gltfEntity)
  }
}
