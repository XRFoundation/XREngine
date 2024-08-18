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

import assert from 'assert'
import { v4 as uuidv4 } from 'uuid'

import { locationSettingPath } from '@etherealengine/common/src/schemas/social/location-setting.schema'
import { LocationID, locationPath, LocationType } from '@etherealengine/common/src/schemas/social/location.schema'
import { destroyEngine } from '@etherealengine/ecs/src/Engine'

import { staticResourcePath } from '@etherealengine/common/src/schema.type.module'
import { getDateTimeSql } from '@etherealengine/common/src/utils/datetime-sql'
import { Application } from '../../../declarations'
import { createFeathersKoaApp } from '../../createApp'
import { LocationParams } from './location.class'

const params = { isInternal: true } as LocationParams

describe('location.test', () => {
  let app: Application
  const locations: any[] = []

  before(async () => {
    app = createFeathersKoaApp()
    await app.setup()
  })

  after(() => {
    return destroyEngine()
  })

  it('should create a new location', async () => {
    const name = `Test Location ${uuidv4()}`

    const scene = await app.service(staticResourcePath).find({
      query: {
        key: 'projects/etherealengine/default-project/public/scenes/default.gltf'
      }
    })

    const item = await app.service(locationPath).create(
      {
        name,
        slugifiedName: '',
        sceneId: scene.data[0].id,
        maxUsersPerInstance: 20,
        locationSetting: {
          locationType: 'public',
          audioEnabled: true,
          videoEnabled: true,
          faceStreamingEnabled: false,
          screenSharingEnabled: false,
          locationId: '' as LocationID
        },
        isLobby: false,
        isFeatured: false
      },
      params
    )

    assert.ok(item)
    assert.equal(item.name, name)
    locations.push(item)
  })

  it('should get the new location', async () => {
    const item = await app.service(locationPath).get(locations[0].id)

    assert.ok(item)
    assert.equal(item.name, locations[0].name)
    assert.equal(item.slugifiedName, locations[0].slugifiedName)
    assert.equal(item.isLobby, locations[0].isLobby)
  })

  it('should be able to update the location', async () => {
    const newName = `Update Test Location ${uuidv4()}`
    const locationSetting = await app.service(locationSettingPath).create({
      locationType: 'public',
      audioEnabled: true,
      videoEnabled: true,
      faceStreamingEnabled: false,
      screenSharingEnabled: false,
      locationId: locations[0].id,
      createdAt: await getDateTimeSql(),
      updatedAt: await getDateTimeSql()
    })

    locationSetting.audioEnabled = true
    locationSetting.videoEnabled = true
    locationSetting.faceStreamingEnabled = false
    locationSetting.screenSharingEnabled = false

    const item = (await app
      .service(locationPath)
      .patch(locations[0].id, { name: newName, locationSetting })) as any as LocationType

    assert.ok(item)
    assert.equal(item.name, newName)

    locations[0].name = newName
  })

  it('should be able to delete the location', async () => {
    await app.service(locationPath).remove(locations[0].id)

    const item = await app.service(locationPath).find({ query: { id: locations[0].id } })

    assert.equal(item.total, 0)
  })
})
