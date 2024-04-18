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

import { Application } from '../../../declarations'

import { PortalQuery, PortalType } from '@etherealengine/common/src/schemas/projects/portal.schema'
import { SceneDataType, scenePath } from '@etherealengine/common/src/schemas/projects/scene.schema'
import { locationPath } from '@etherealengine/common/src/schemas/social/location.schema'
import { Paginated, Params, ServiceInterface } from '@feathersjs/feathers'
import { getSceneData } from '../scene/scene-helper'
import { parseScenePortals } from '../scene/scene-parser'

export interface PortalParams extends Params<PortalQuery> {
  paginate?: false
}

export class PortalService implements ServiceInterface<PortalType | Paginated<PortalType>, PortalParams> {
  app: Application

  constructor(app: Application) {
    this.app = app
  }

  async get(id: string, params?: PortalParams) {
    const locationName = params?.query?.locationName

    if (!params?.query?.locationName) throw new Error('No locationID provided')

    const location = await this.app.service(locationPath).find({
      query: {
        slugifiedName: locationName
      }
    })
    if (!location?.data?.length) throw new Error('No location found')

    const sceneData = await getSceneData(location.data[0].sceneId, false, params!.provider == null)

    const portals = parseScenePortals(sceneData) as PortalType[]
    const portalResult: PortalType = portals.find((portal) => portal.portalEntityId === id) || ({} as PortalType)
    return portalResult
  }

  async find(params?: PortalParams) {
    let paginate = params?.paginate
    if (params?.query?.paginate === false) {
      paginate = false
    }
    const scenes = (await this.app
      .service(scenePath)
      .find({ query: { metadataOnly: false, paginate: false } })) as any as SceneDataType[]
    const sceneResult = scenes.map((scene) => parseScenePortals(scene)).flat() as PortalType[]
    return paginate === false ? sceneResult : { data: sceneResult, total: sceneResult.length, limit: 0, skip: 0 }
  }
}
