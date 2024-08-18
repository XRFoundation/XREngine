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

import appRootPath from 'app-root-path'
import cli from 'cli'
import dotenv from 'dotenv-flow'

import { apiJobPath, githubRepoAccessRefreshPath, userPath } from '@etherealengine/common/src/schema.type.module'
import { getDateTimeSql } from '@etherealengine/common/src/utils/datetime-sql'
import { ServerMode } from '@etherealengine/server-core/src/ServerState'
import { createFeathersKoaApp, serverJobPipe } from '@etherealengine/server-core/src/createApp'
import { updateAppConfig } from '@etherealengine/server-core/src/updateAppConfig'

dotenv.config({
  path: appRootPath.path,
  silent: true
})

const db = {
  username: process.env.MYSQL_USER ?? 'server',
  password: process.env.MYSQL_PASSWORD ?? 'password',
  database: process.env.MYSQL_DATABASE ?? 'etherealengine',
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: process.env.MYSQL_PORT ?? 3306,
  dialect: 'mysql',
  url: ''
}

db.url = process.env.MYSQL_URL ?? `mysql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`

cli.enable('status')

const options = cli.parse({
  userId: [false, 'ID of user updating project', 'string'],
  jobId: [false, 'ID of Job record', 'string']
})

cli.main(async () => {
  try {
    await updateAppConfig()
    const app = createFeathersKoaApp(ServerMode.API, serverJobPipe)
    await app.setup()
    const { userId, jobId } = options
    const user = await app.service(userPath).get(userId)
    await app.service(githubRepoAccessRefreshPath).find(Object.assign({}, {}, { user }))
    const date = await getDateTimeSql()
    await app.service(apiJobPath).patch(jobId, {
      status: 'succeeded',
      endTime: date
    })
    cli.exit(0)
  } catch (err) {
    console.log(err)
    cli.fatal(err)
  }
})
