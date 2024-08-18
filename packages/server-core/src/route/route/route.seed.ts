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
import { v4 as uuidv4 } from 'uuid'

import { RouteID, routePath, RouteType } from '@etherealengine/common/src/schemas/route/route.schema'
import { getDateTimeSql } from '@etherealengine/common/src/utils/datetime-sql'
import appConfig from '@etherealengine/server-core/src/appconfig'

export async function seed(knex: Knex): Promise<void> {
  const { testEnabled } = appConfig
  const { forceRefresh } = appConfig.db

  const seedData: RouteType[] = await Promise.all(
    [
      {
        project: 'etherealengine/default-project',
        route: '/'
      },
      {
        project: 'etherealengine/default-project',
        route: '/location'
      },
      {
        project: 'etherealengine/default-project',
        route: '/admin'
      },
      {
        project: 'etherealengine/default-project',
        route: '/studio'
      },
      {
        project: 'etherealengine/default-project',
        route: '/studio-old'
      },
      {
        project: 'etherealengine/default-project',
        route: '/capture'
      },
      {
        project: 'etherealengine/default-project',
        route: '/chat'
      },
      {
        project: 'default-project',
        route: '/home'
      }
    ].map(async (item) => ({
      ...item,
      id: uuidv4() as RouteID,
      createdAt: await getDateTimeSql(),
      updatedAt: await getDateTimeSql()
    }))
  )

  if (forceRefresh || testEnabled) {
    // Deletes ALL existing entries
    await knex(routePath).del()

    // Inserts seed entries
    await knex(routePath).insert(seedData)
  } else {
    const existingData = await knex(routePath).count({ count: '*' })

    if (existingData.length === 0 || existingData[0].count === 0) {
      for (const item of seedData) {
        await knex(routePath).insert(item)
      }
    }
  }
}
