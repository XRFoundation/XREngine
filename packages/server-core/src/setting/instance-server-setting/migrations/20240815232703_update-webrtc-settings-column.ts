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

import type { Knex } from 'knex'

import { defaultWebRTCSettings } from '@etherealengine/common/src/constants/DefaultWebRTCSettings'
import { instanceServerSettingPath } from '@etherealengine/common/src/schemas/setting/instance-server-setting.schema'
import {awsSettingPath} from "@etherealengine/common/src/schemas/setting/aws-setting.schema";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex: Knex): Promise<void> {
  const webRTCSettingsColumn = await knex.table(instanceServerSettingPath).first()
  const webRTCSettings = JSON.parse(webRTCSettingsColumn.webRTCSettings)
  const iceServers = webRTCSettings.iceServers
  if (iceServers.length > 0) {
    iceServers.forEach((iceServer, index) => {
      iceServer.useFixedCredentials = iceServer.username != null || iceServer.credential != null
      if (index === 0) {
        iceServer.useTimeLimitedCredentials = webRTCSettings.useTimeLimitedCredentials
        if (webRTCSettings.webRTCStaticAuthSecretKey) iceServer.webRTCStaticAuthSecretKey = webRTCSettings.webRTCStaticAuthSecretKey
      }
    })
  }
  delete webRTCSettings.webRTCStaticAuthSecretKey
  delete webRTCSettings.useTimeLimitedCredentials
  await knex.table(instanceServerSettingPath).update({
    webRTCSettings: JSON.stringify(webRTCSettings)
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex: Knex): Promise<void> {
  const webRTCSettingsColumn = await knex.table(instanceServerSettingPath).first()
  const webRTCSettings = JSON.parse(webRTCSettingsColumn.webRTCSettings)
  const iceServers = webRTCSettings.iceServers
  if (iceServers.length > 0) {
    iceServers.forEach((iceServer, index) => {
      delete iceServer.useFixedCredentials
      if (index === 0) {
         webRTCSettings.useTimeLimitedCredentials = iceServer.useTimeLimitedCredentials
        delete iceServer.useTimeLimitedCredentials
        if (iceServer.webRTCStaticAuthSecretKey) {
          webRTCSettings.webRTCStaticAuthSecretKey = iceServer.webRTCStaticAuthSecretKey
          delete iceServer.webRTCStaticAuthSecretKey
        }
      }
    })
  }
  await knex.table(instanceServerSettingPath).update({
    webRTCSettings: JSON.stringify(webRTCSettings)
  })
}
