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

// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, virtual } from '@feathersjs/schema'
import { v4 as uuidv4 } from 'uuid'

import {
  InstanceID,
  InstanceQuery,
  InstanceType,
  instancePath
} from '@etherealengine/common/src/schemas/networking/instance.schema'
import { channelPath } from '@etherealengine/common/src/schemas/social/channel.schema'
import { locationPath } from '@etherealengine/common/src/schemas/social/location.schema'
import { fromDateTimeSql, getDateTimeSql } from '@etherealengine/common/src/utils/datetime-sql'
import type { HookContext } from '@etherealengine/server-core/declarations'
import { BadRequest } from '@feathersjs/errors'

export const instanceResolver = resolve<InstanceType, HookContext>({
  location: virtual(async (instance, context) => {
    if (context.event !== 'removed' && instance.locationId)
      return await context.app.service(locationPath).get(instance.locationId)
  }),
  assignedAt: virtual(async (instance) => (instance.assignedAt ? fromDateTimeSql(instance.assignedAt) : '')),
  createdAt: virtual(async (instance) => fromDateTimeSql(instance.createdAt)),
  updatedAt: virtual(async (instance) => fromDateTimeSql(instance.updatedAt))
})

export const instanceExternalResolver = resolve<InstanceType, HookContext>({})

export const instanceDataResolver = resolve<InstanceType, HookContext>({
  id: async () => {
    return uuidv4() as InstanceID
  },
  projectId: async (value, instance, context) => {
    try {
      // Populate projectId from locationId
      if (instance.locationId) {
        const locationData = await context.app.service(locationPath).get(instance.locationId)
        if (locationData) {
          return locationData.projectId
        } else {
          throw new BadRequest('Error populating projectId into world instance')
        }
      }
      // Populate projectId from channelId
      if (instance.channelId) {
        const channelData = await context.app.service(channelPath).get(instance.channelId)
        if (channelData.instanceId) {
          const channelInstance = await context.app.service(instancePath).get(channelData.instanceId)
          return channelInstance.projectId
        }
        return ''
      }
    } catch (error) {
      throw new BadRequest('Error populating projectId into instance')
    }
  },
  createdAt: getDateTimeSql,
  updatedAt: getDateTimeSql
})

export const instancePatchResolver = resolve<InstanceType, HookContext>({
  updatedAt: getDateTimeSql
})

export const instanceQueryResolver = resolve<InstanceQuery, HookContext>({})
