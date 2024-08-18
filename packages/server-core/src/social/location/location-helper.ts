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

import { Paginated } from '@feathersjs/feathers/lib'
import { v4 as uuidv4 } from 'uuid'

import {
  LocationData,
  LocationID,
  locationPath,
  LocationSettingType,
  LocationType,
  staticResourcePath
} from '@etherealengine/common/src/schema.type.module'
import { Application } from '@etherealengine/server-core/declarations'
import logger from '@etherealengine/server-core/src/ServerLogger'

export const createLocations = async (app: Application, projectName: string, sceneFiles: Record<string, string>) => {
  return Promise.all(
    Object.entries(sceneFiles).map(async ([locationName, fileName]) => {
      const cleanedLocationName = locationName.replace('-', ' ')

      const assetURL = `projects/${projectName}/${fileName}`
      const locationId = uuidv4() as LocationID

      const scene = (
        await app.service(staticResourcePath).find({
          query: { key: assetURL }
        })
      ).data.pop()
      if (!scene) return logger.warn(`Location ${cleanedLocationName} Scene not found for ${fileName}`)

      const locationSetting = {
        locationId,
        locationType: 'public',
        audioEnabled: true,
        videoEnabled: true,
        screenSharingEnabled: true,
        faceStreamingEnabled: true
      } as LocationSettingType

      const location = {
        id: locationId,
        name: cleanedLocationName,
        slugifiedName: cleanedLocationName,
        maxUsersPerInstance: 20,
        sceneId: scene.id,
        locationSetting,
        isLobby: false,
        isFeatured: false
      } as LocationData

      const existingLocation = (await app.service(locationPath).find({
        query: {
          slugifiedName: cleanedLocationName
        }
      })) as Paginated<LocationType>
      if (existingLocation.total === 0) await app.service(locationPath).create(location)
    })
  )
}
