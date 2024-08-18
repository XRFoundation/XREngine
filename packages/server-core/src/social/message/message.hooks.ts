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
import { Paginated } from '@feathersjs/feathers'
import { hooks as schemaHooks } from '@feathersjs/schema'
import { discard, iff, isProvider } from 'feathers-hooks-common'

import { instancePath } from '@etherealengine/common/src/schemas/networking/instance.schema'
import { channelPath, ChannelType } from '@etherealengine/common/src/schemas/social/channel.schema'
import {
  MessageData,
  messageDataValidator,
  messagePatchValidator,
  messageQueryValidator
} from '@etherealengine/common/src/schemas/social/message.schema'
import setLoggedInUser from '@etherealengine/server-core/src/hooks/set-loggedin-user-in-body'

import { HookContext } from '../../../declarations'
import channelPermissionAuthenticate from '../../hooks/channel-permission-authenticate'
import messagePermissionAuthenticate from '../../hooks/message-permission-authenticate'
import {
  messageDataResolver,
  messageExternalResolver,
  messagePatchResolver,
  messageQueryResolver,
  messageResolver
} from '../../social/message/message.resolvers'
import { MessageService } from './message.class'

/**
 * Restricts from creating empty messages
 * @param context
 * @returns
 */
const disallowEmptyMessage = async (context: HookContext<MessageService>) => {
  if (!context.data) {
    throw new BadRequest(`${context.path} service data is empty`)
  }

  const data = Array.isArray(context.data) ? context.data : [context.data]

  for (const item of data) {
    const { text } = item
    if (!text) throw new BadRequest('Make sure text is not empty')
  }

  return context
}

/**
 * Populates the channelId in request based on query's channelId or instanceId
 * @param context
 * @returns
 */
const ensureChannelId = async (context: HookContext<MessageService>) => {
  if (!context.data || context.method !== 'create') {
    throw new BadRequest(`${context.path} service only works for data in ${context.method}`)
  }

  const data: MessageData[] = Array.isArray(context.data) ? context.data : [context.data]

  for (const item of data) {
    let channel: ChannelType | undefined = undefined
    const { channelId, instanceId } = item

    if (channelId) {
      channel = await context.app.service(channelPath).get(channelId)
    }

    if (!channel && instanceId) {
      const targetInstance = await context.app.service(instancePath).get(instanceId)

      if (!targetInstance) {
        throw new BadRequest(`Invalid target instance ID: ${instanceId}`)
      }

      const channelResult = (await context.app.service(channelPath).find({
        query: {
          instanceId,
          $limit: 1
        }
      })) as Paginated<ChannelType>

      if (channelResult.data.length > 0) {
        channel = channelResult.data[0]
      } else {
        channel = await context.app.service(channelPath).create({
          instanceId
        })
      }
    }

    if (!channel) throw new BadRequest('Could not find or create channel')

    item.channelId = channel.id
  }

  return context
}

export default {
  around: {
    all: [schemaHooks.resolveExternal(messageExternalResolver), schemaHooks.resolveResult(messageResolver)]
  },

  before: {
    all: [schemaHooks.validateQuery(messageQueryValidator), schemaHooks.resolveQuery(messageQueryResolver)],
    find: [iff(isProvider('external'), channelPermissionAuthenticate())],
    get: [],
    create: [
      schemaHooks.validateData(messageDataValidator),
      schemaHooks.resolveData(messageDataResolver),
      disallowEmptyMessage,
      setLoggedInUser('senderId'),
      ensureChannelId,
      discard('instanceId')
    ],
    update: [messagePermissionAuthenticate(), disallowEmptyMessage],
    patch: [
      messagePermissionAuthenticate(),
      disallowEmptyMessage,
      schemaHooks.validateData(messagePatchValidator),
      schemaHooks.resolveData(messagePatchResolver)
    ],
    remove: [messagePermissionAuthenticate()]
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
