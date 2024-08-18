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

import {
  AuthenticationSettingDatabaseType,
  authenticationSettingPath
} from '@etherealengine/common/src/schemas/setting/authentication-setting.schema'
import { identityProviderPath } from '@etherealengine/common/src/schemas/user/identity-provider.schema'
import { getDateTimeSql } from '@etherealengine/common/src/utils/datetime-sql'
import appConfig from '@etherealengine/server-core/src/appconfig'

import config from '../../appconfig'

export const DISCORD_SCOPES = ['email', 'identify']
export const GITHUB_SCOPES = ['repo', 'user', 'workflow']
export const GOOGLE_SCOPES = ['profile', 'email']
export const LINKEDIN_SCOPES = ['profile', 'email']
export const APPLE_SCOPES = ['openid', 'email', 'name']

export async function seed(knex: Knex): Promise<void> {
  const { testEnabled } = appConfig
  const { forceRefresh } = appConfig.db
  const seedData: AuthenticationSettingDatabaseType[] = await Promise.all(
    [
      {
        service: identityProviderPath,
        entity: identityProviderPath,
        secret: process.env.AUTH_SECRET || 'test',
        jwtAlgorithm: process.env.JWT_ALGORITHM,
        jwtPublicKey: process.env.JWT_PUBLIC_KEY,
        authStrategies: JSON.stringify([
          { jwt: true },
          { smsMagicLink: true },
          { emailMagicLink: true },
          { apple: true },
          { discord: true },
          { facebook: true },
          { github: true },
          { google: true },
          { linkedin: true },
          { twitter: true },
          { didWallet: true }
        ]),
        jwtOptions: JSON.stringify({
          algorithm: process.env.JWT_ALGORITHM || 'HS256',
          expiresIn: '30 days'
        }),
        bearerToken: JSON.stringify({
          numBytes: 16
        }),
        callback: JSON.stringify({
          apple: process.env.APPLE_CALLBACK_URL || `${config.client.url}/auth/oauth/apple`,
          discord: process.env.DISCORD_CALLBACK_URL || `${config.client.url}/auth/oauth/discord`,
          facebook: process.env.FACEBOOK_CALLBACK_URL || `${config.client.url}/auth/oauth/facebook`,
          github: process.env.GITHUB_CALLBACK_URL || `${config.client.url}/auth/oauth/github`,
          google: process.env.GOOGLE_CALLBACK_URL || `${config.client.url}/auth/oauth/google`,
          linkedin: process.env.LINKEDIN_CALLBACK_URL || `${config.client.url}/auth/oauth/linkedin`,
          twitter: process.env.TWITTER_CALLBACK_URL || `${config.client.url}/auth/oauth/twitter`
        }),
        oauth: JSON.stringify({
          defaults: {
            host:
              config.server.hostname !== '127.0.0.1' && config.server.hostname !== 'localhost'
                ? config.server.hostname
                : config.server.hostname + ':' + config.server.port,
            protocol: 'https'
          },
          apple: {
            key: process.env.APPLE_CLIENT_ID,
            secret: process.env.APPLE_CLIENT_SECRET,
            scope: APPLE_SCOPES,
            response: ['raw', 'jwt'],
            nonce: true,
            custom_params: {
              response_type: 'code id_token',
              response_mode: 'form_post'
            }
          },
          discord: {
            key: process.env.DISCORD_CLIENT_ID,
            secret: process.env.DISCORD_CLIENT_SECRET,
            scope: DISCORD_SCOPES,
            custom_params: { prompt: 'none' }
          },
          facebook: {
            key: process.env.FACEBOOK_CLIENT_ID,
            secret: process.env.FACEBOOK_CLIENT_SECRET
          },
          github: {
            appId: process.env.GITHUB_APP_ID,
            key: process.env.GITHUB_CLIENT_ID,
            secret: process.env.GITHUB_CLIENT_SECRET,
            scope: GITHUB_SCOPES
          },
          google: {
            key: process.env.GOOGLE_CLIENT_ID,
            secret: process.env.GOOGLE_CLIENT_SECRET,
            scope: GOOGLE_SCOPES
          },
          linkedin: {
            key: process.env.LINKEDIN_CLIENT_ID,
            secret: process.env.LINKEDIN_CLIENT_SECRET,
            scope: LINKEDIN_SCOPES
          },
          twitter: {
            key: process.env.TWITTER_CLIENT_ID,
            secret: process.env.TWITTER_CLIENT_SECRET
          }
        })
      }
    ].map(async (item) => ({
      ...item,
      id: uuidv4(),
      createdAt: await getDateTimeSql(),
      updatedAt: await getDateTimeSql()
    }))
  )

  if (forceRefresh || testEnabled) {
    // Deletes ALL existing entries
    await knex(authenticationSettingPath).del()

    // Inserts seed entries
    await knex(authenticationSettingPath).insert(seedData)
  } else {
    const existingData = await knex(authenticationSettingPath).count({ count: '*' })

    if (existingData.length === 0 || existingData[0].count === 0) {
      for (const item of seedData) {
        await knex(authenticationSettingPath).insert(item)
      }
    }
  }
}
