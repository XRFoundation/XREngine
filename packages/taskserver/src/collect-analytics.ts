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

import { Knex } from 'knex'

import {
  analyticsPath,
  channelPath,
  ChannelType,
  instanceAttendancePath,
  instancePath,
  userPath
} from '@etherealengine/common/src/schema.type.module'
import config from '@etherealengine/server-core/src/appconfig'
import multiLogger from '@etherealengine/server-core/src/ServerLogger'

const logger = multiLogger.child({ component: 'taskserver:collect-analytics' })

const DEFAULT_INTERVAL_SECONDS = 1800
const configInterval = parseInt(config.taskserver.processInterval)
const interval = (configInterval || DEFAULT_INTERVAL_SECONDS) * 1000

let lastTimestamp: string
let analyticsData: any[] = []
const collectedData: any[] = []
export default (app): void => {
  setInterval(async () => {
    logger.info('Collecting analytics at %s.', new Date().toString())
    const activeLocations: any[] = []
    const activeScenes: any[] = []
    const activeChannels = (await app.service(channelPath).find({
      paginate: false,
      isInternal: true
    })) as ChannelType[]

    const knexClient: Knex = app.get('knexClient')
    const currentTimestamp = new Date().toISOString()

    if (lastTimestamp) {
      analyticsData = analyticsData.filter((data) => {
        if (data.timestamp) {
          return new Date(data.timestamp) > new Date(lastTimestamp)
        }
        return false
      })
    }

    if (collectedData.length > 0) {
      // Log the collected events
      collectedData.forEach((data) => {
        logger.info(data)
      })
    }

    lastTimestamp = currentTimestamp

    const instanceUsers = await knexClient
      .from(userPath)
      .join(instanceAttendancePath, `${instanceAttendancePath}.userId`, `${userPath}.id`)
      .where(`${instanceAttendancePath}.ended`, false)
      .andWhere(`${instanceAttendancePath}.isChannel`, false)
      .select()
      .options({ nestTables: true })

    for (const user of instanceUsers) {
      collectedData.push({
        timestamp: user.updatedAt,
        user
      })
    }
    const channelUsers = await knexClient
      .from(userPath)
      .join(instanceAttendancePath, `${instanceAttendancePath}.userId`, `${userPath}.id`)
      .where(`${instanceAttendancePath}.ended`, false)
      .andWhere(`${instanceAttendancePath}.isChannel`, true)
      .select()
      .options({ nestTables: true })

    for (const user of channelUsers) {
      collectedData.push({
        timestamp: user.updatedAt,
        user
      })
    }
    const activeInstances = await app.service(instancePath).find({
      query: {
        ended: {
          $ne: 1
        }
      },
      isInternal: true
    })

    for (const instance of activeInstances.data) {
      collectedData.push({
        timestamp: instance.updatedAt,
        instance
      })
      if (instance.location) {
        if (activeLocations.indexOf(instance.location.id) < 0) activeLocations.push(instance.location.id)
        if (activeScenes.indexOf(instance.location.sceneId) < 0) activeScenes.push(instance.location.sceneId)
      }
    }

    await Promise.all([
      app.service(analyticsPath).create({
        type: 'activeChannels',
        count: activeChannels.length
      }),
      app.service(analyticsPath).create({
        type: 'instanceUsers',
        count: instanceUsers.length
      }),
      app.service(analyticsPath).create({
        type: 'channelUsers',
        count: channelUsers.length
      }),
      app.service(analyticsPath).create({
        type: 'activeLocations',
        count: activeLocations.length
      }),
      app.service(analyticsPath).create({
        type: 'activeScenes',
        count: activeScenes.length
      }),
      app.service(analyticsPath).create({
        type: 'activeInstances',
        count: activeInstances.total
      })
    ])
  }, interval)
}
