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

import { Forbidden } from '@feathersjs/errors'
import { Paginated } from '@feathersjs/feathers'
import { hooks as schemaHooks } from '@feathersjs/schema'
import { disallow, iff, isProvider } from 'feathers-hooks-common'

import {
  channelUserDataValidator,
  channelUserPatchValidator,
  channelUserPath,
  channelUserQueryValidator,
  ChannelUserType
} from '@etherealengine/common/src/schemas/social/channel-user.schema'
import { channelPath } from '@etherealengine/common/src/schemas/social/channel.schema'
import { messagePath } from '@etherealengine/common/src/schemas/social/message.schema'
import { userPath } from '@etherealengine/common/src/schemas/user/user.schema'

import { HookContext } from '../../../declarations'
import disallowId from '../../hooks/disallow-id'
import verifyScope from '../../hooks/verify-scope'
import { ChannelUserService } from './channel-user.class'
import {
  channelUserDataResolver,
  channelUserExternalResolver,
  channelUserPatchResolver,
  channelUserQueryResolver,
  channelUserResolver
} from './channel-user.resolvers'

/**
 * Adds user joined message to channel
 * @param context
 * @returns
 */
const addJoinedChannelMessage = async (context: HookContext<ChannelUserService>) => {
  const { app, params } = context

  const result = (Array.isArray(context.result) ? context.result : [context.result]) as ChannelUserType[]

  for (const item of result) {
    const user = await app.service(userPath).get(item.userId, { ...params, query: {} })
    await app.service(messagePath).create({
      channelId: item.channelId,
      text: `${user.name} joined the channel`,
      isNotification: true
    })
  }

  return context
}

/**
 * Adds user left message to channel
 * @param context
 * @returns
 */
const addLeftChannelMessage = async (context: HookContext<ChannelUserService>) => {
  const { app, params } = context

  const result = (Array.isArray(context.result) ? context.result : [context.result]) as ChannelUserType[]

  for (const item of result) {
    const user = await app.service(userPath).get(item.userId, { ...params, query: {} })
    await app.service(messagePath).create({
      channelId: item.channelId,
      text: `${user.name} left the channel`,
      isNotification: true
    })
  }

  return context
}

/**
 * Removes a channel if there is not user in it.
 * @param context
 * @returns
 */
const removeEmptyNonInstanceChannel = async (context: HookContext<ChannelUserService>) => {
  const { app } = context

  const result = (Array.isArray(context.result) ? context.result : [context.result]) as ChannelUserType[]

  for (const item of result) {
    const channel = await app.service(channelPath).get(item.channelId)
    if (channel.instanceId) return context

    const channelUserCount = (await app.service(channelUserPath).find({
      query: {
        channelId: item.channelId
      }
    })) as Paginated<ChannelUserType>

    if (channelUserCount.data.length === 0) {
      await app.service(channelPath).remove(item.channelId)
    }
  }

  return context
}

/**
 * Ensure user is owner of the channel in channel-user
 * @param context
 * @returns
 */
const ensureUserIsOwner = async (context: HookContext<ChannelUserService>) => {
  const userId = context.params.user!.id
  const channelId = context.params.query!.channelId

  const loggedInChannelUser = (await context.app.service(channelUserPath).find({
    query: {
      userId,
      channelId,
      $limit: 1
    }
  })) as Paginated<ChannelUserType>

  if (!loggedInChannelUser.data.length || !loggedInChannelUser.data[0].isOwner) {
    throw new Forbidden('Only the owner of a channel can remove users')
  }

  return context
}

export default {
  around: {
    all: [schemaHooks.resolveExternal(channelUserExternalResolver), schemaHooks.resolveResult(channelUserResolver)]
  },

  before: {
    all: [schemaHooks.validateQuery(channelUserQueryValidator), schemaHooks.resolveQuery(channelUserQueryResolver)],
    find: [],
    get: [disallow('external')],
    create: [
      iff(isProvider('external'), verifyScope('channel', 'write')),
      schemaHooks.validateData(channelUserDataValidator),
      schemaHooks.resolveData(channelUserDataResolver)
    ],
    update: [disallow('external')],
    patch: [schemaHooks.validateData(channelUserPatchValidator), schemaHooks.resolveData(channelUserPatchResolver)],
    remove: [iff(isProvider('external'), disallowId, ensureUserIsOwner)]
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [addJoinedChannelMessage],
    update: [],
    patch: [],
    remove: [addLeftChannelMessage, removeEmptyNonInstanceChannel]
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
