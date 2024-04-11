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

import koa from '@feathersjs/koa'

import { Application } from '../../../declarations'
// import { addVolumetricAssetFromProject } from '../../media/volumetric/volumetric-upload.helper'
import { AssetDataType } from '@etherealengine/common/src/schemas/assets/asset.schema'
import { getCacheDomain } from '../../media/storageprovider/getCacheDomain'
import { getCachedURL } from '../../media/storageprovider/getCachedURL'
import { getStorageProvider } from '../../media/storageprovider/storageprovider'

export const getEnvMapBake = (app: Application) => {
  return async (ctx: koa.FeathersKoaContext) => {
    const envMapBake = await getEnvMapBakeById(app, ctx.params.entityId)
    ctx.body = {
      status: 'success',
      json: envMapBake
    }
  }
}

export const getSceneData = async (sceneKey: string, metadataOnly?: boolean, internal = false) => {
  const storageProvider = getStorageProvider()
  const sceneName = sceneKey.split('/').pop()!.replace('.scene.json', '')
  const directory = sceneKey.replace(`${sceneName}.scene.json`, '')

  const sceneExists = await storageProvider.doesExist(`${sceneName}.scene.json`, directory)
  if (!sceneExists) throw new Error(`No scene named ${sceneName} exists in project ${directory}`)

  let thumbnailPath = `${directory}${sceneName}.thumbnail.jpg`

  //if no jpg is found, fallback on jpeg, if still not found, fallback on ethereal logo
  if (!(await storageProvider.doesExist(`${sceneName}.thumbnail.jpg`, directory))) {
    thumbnailPath = `${directory}${sceneName}.thumbnail.jpeg`
    if (!(await storageProvider.doesExist(`${sceneName}.thumbnail.jpeg`, directory))) thumbnailPath = ``
  }

  const projectName = directory.split('/')[1]

  const cacheDomain = getCacheDomain(storageProvider, internal)
  const thumbnailUrl =
    thumbnailPath !== `` ? getCachedURL(thumbnailPath, cacheDomain) : `/static/etherealengine_thumbnail.jpg`

  const sceneResult = await storageProvider.getCachedObject(sceneKey)
  const sceneData: AssetDataType = {
    id: sceneKey,
    name: sceneName,
    project: projectName,
    thumbnailURL: thumbnailUrl,
    assetURL: sceneKey
  }

  return sceneData
}

export const getEnvMapBakeById = async (app, entityId: string) => {
  // TODO: reimplement with new scene format
  // const models = app.get('sequelizeClient').models
  // return models.component.findOne({
  //   where: {
  //     type: 'envmapbake',
  //     '$entity.entityId$': entityId
  //   },
  //   include: [
  //     {
  //       model: models.entity,
  //       attributes: ['collectionId', 'name', 'entityId'],
  //       as: 'entity'
  //     }
  //   ]
  // })
}

export const parseScenePortals = (scene: AssetDataType) => {
  const portals: PortalType[] = []
  for (const [entityId, entity] of Object.entries((scene.scene as SceneJsonType)?.entities)) {
    for (const component of entity.components)
      if (component.name === PortalComponent.jsonID) {
        portals.push({
          sceneName: scene.name,
          portalEntityId: entityId,
          portalEntityName: entity.name,
          previewImageURL: component.props.previewImageURL,
          spawnPosition: component.props.spawnPosition,
          spawnRotation: component.props.spawnRotation
        })
      }
  }
  return portals
}
