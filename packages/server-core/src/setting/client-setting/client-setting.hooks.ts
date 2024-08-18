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

import { BadRequest } from '@feathersjs/errors'
import { hooks as schemaHooks } from '@feathersjs/schema'
import { iff, isProvider } from 'feathers-hooks-common'
import path from 'path'

import { invalidationPath } from '@etherealengine/common/src/schemas/media/invalidation.schema'

import {
  ClientSettingData,
  clientSettingDataValidator,
  clientSettingPatchValidator,
  clientSettingPath,
  clientSettingQueryValidator
} from '@etherealengine/common/src/schemas/setting/client-setting.schema'

import { HookContext } from '../../../declarations'
import config from '../../appconfig'
import verifyScope from '../../hooks/verify-scope'
import { getStorageProvider } from '../../media/storageprovider/storageprovider'
import logger from '../../ServerLogger'
import { getContentType } from '../../util/fileUtils'
import { ClientSettingService } from './client-setting.class'
import {
  clientSettingDataResolver,
  clientSettingExternalResolver,
  clientSettingPatchResolver,
  clientSettingQueryResolver,
  clientSettingResolver
} from './client-setting.resolvers'

/**
 * Updates web manifest
 * @param context
 * @returns
 */
const updateWebManifest = async (context: HookContext<ClientSettingService>) => {
  if (!context.data || context.method !== 'patch') {
    throw new BadRequest(`${context.path} service only works for data in ${context.method}`)
  }

  const data: ClientSettingData[] = Array.isArray(context.data) ? context.data : [context.data]
  const webmanifestPath =
    process.env.SERVE_CLIENT_FROM_STORAGE_PROVIDER === 'true' ? `client/public/site.webmanifest` : 'site.webmanifest'
  const storageProvider = getStorageProvider()
  try {
    const webmanifestResponse = await storageProvider.getObject(webmanifestPath)
    const webmanifest = JSON.parse(webmanifestResponse.Body.toString('utf-8'))
    context.data![0].startPath = data![0].startPath?.replace('https://', '/')
    const icon192px = data![0].icon192px!.startsWith('https://')
      ? data![0].icon192px
      : path.join('client', data![0].icon192px!)
    const icon512px = data![0].icon512px!.startsWith('https://')
      ? data![0].icon512px
      : path.join('client', data![0].icon512px!)
    webmanifest.name = data![0].title
    webmanifest.short_name = data![0].shortTitle
    webmanifest.start_url =
      config.client.url[config.client.url.length - 1] === '/' && data![0].startPath![0] === '/'
        ? config.client.url + data![0].startPath!.slice(1)
        : config.client.url[config.client.url.length - 1] !== '/' && data![0].startPath![0] !== '/'
        ? config.client.url + '/' + data![0].startPath
        : config.client.url + data![0].startPath
    const cacheDomain = storageProvider.getCacheDomain()
    webmanifest.icons = [
      {
        src: icon192px!.startsWith('https://')
          ? icon192px
          : cacheDomain[cacheDomain.length - 1] === '/' && icon192px![0] === '/'
          ? `https://${cacheDomain}${icon192px?.slice(1)}`
          : cacheDomain[cacheDomain.length - 1] !== '/' && icon192px![0] !== '/'
          ? `https://${cacheDomain}/${icon192px}`
          : `https://${cacheDomain}${icon192px}`,
        sizes: '192x192',
        type: getContentType(icon192px!)
      },
      {
        src: icon512px!.startsWith('https://')
          ? icon512px
          : cacheDomain[cacheDomain.length - 1] === '/' && icon512px![0] === '/'
          ? `https://${cacheDomain}${icon512px?.slice(1)}`
          : cacheDomain[cacheDomain.length - 1] !== '/' && icon512px![0] !== '/'
          ? `https://${cacheDomain}/${icon512px}`
          : `https://${cacheDomain}${icon512px}`,
        sizes: '512x512',
        type: getContentType(icon512px!)
      }
    ]
    if (config.server.edgeCachingEnabled)
      await context.app.service(invalidationPath).create({
        path: webmanifestPath
      })

    await storageProvider.putObject({
      Body: Buffer.from(JSON.stringify(webmanifest)),
      ContentType: 'application/manifest+json',
      Key: 'client/public/site.webmanifest'
    })
  } catch (err) {
    logger.info('Error with manifest update', webmanifestPath)
    logger.error(err)
  }
}

export default {
  around: {
    all: [schemaHooks.resolveExternal(clientSettingExternalResolver), schemaHooks.resolveResult(clientSettingResolver)]
  },

  before: {
    all: [schemaHooks.validateQuery(clientSettingQueryValidator), schemaHooks.resolveQuery(clientSettingQueryResolver)],
    find: [],
    get: [],
    create: [
      iff(isProvider('external'), verifyScope(clientSettingPath, 'write')),
      schemaHooks.validateData(clientSettingDataValidator),
      schemaHooks.resolveData(clientSettingDataResolver)
    ],
    update: [iff(isProvider('external'), verifyScope(clientSettingPath, 'write'))],
    patch: [
      iff(isProvider('external'), verifyScope(clientSettingPath, 'write')),
      schemaHooks.validateData(clientSettingPatchValidator),
      schemaHooks.resolveData(clientSettingPatchResolver),
      updateWebManifest
    ],
    remove: [iff(isProvider('external'), verifyScope(clientSettingPath, 'write'))]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
} as any
