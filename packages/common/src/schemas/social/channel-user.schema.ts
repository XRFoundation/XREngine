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
import type { Static } from '@feathersjs/typebox'
import { getValidator, querySyntax, Type } from '@feathersjs/typebox'

import { TypedString } from '../../types/TypeboxUtils'
import { UserID, userSchema } from '../user/user.schema'
import { dataValidator, queryValidator } from '../validators'
import { ChannelID } from './channel.schema'

export const channelUserPath = 'channel-user'

export const channelUserMethods = ['find', 'create', 'patch', 'remove'] as const

// Main data model schema
export const channelUserSchema = Type.Object(
  {
    id: Type.String({
      format: 'uuid'
    }),
    isOwner: Type.Boolean(),
    channelId: TypedString<ChannelID>({
      format: 'uuid'
    }),
    userId: TypedString<UserID>({
      format: 'uuid'
    }),
    user: Type.Optional(Type.Ref(userSchema)),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'ChannelUser', additionalProperties: false }
)
export interface ChannelUserType extends Static<typeof channelUserSchema> {}

// Schema for creating new entries
export const channelUserDataSchema = Type.Partial(
  Type.Intersect([
    Type.Pick(channelUserSchema, ['channelId', 'userId']),
    Type.Object(
      {
        isOwner: Type.Optional(Type.Boolean())
      },
      { additionalProperties: false }
    )
  ]),
  { $id: 'ChannelUserData' }
)
export interface ChannelUserData extends Static<typeof channelUserDataSchema> {}

// Schema for updating existing entries
export const channelUserPatchSchema = Type.Partial(channelUserSchema, {
  $id: 'ChannelUserPatch'
})
export interface ChannelUserPatch extends Static<typeof channelUserPatchSchema> {}

// Schema for allowed query properties
export const channelUserQueryProperties = Type.Pick(channelUserSchema, ['id', 'userId', 'isOwner', 'channelId'])
export const channelUserQuerySchema = Type.Intersect(
  [
    querySyntax(channelUserQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export interface ChannelUserQuery extends Static<typeof channelUserQuerySchema> {}

export const channelUserValidator = /* @__PURE__ */ getValidator(channelUserSchema, dataValidator)
export const channelUserDataValidator = /* @__PURE__ */ getValidator(channelUserDataSchema, dataValidator)
export const channelUserPatchValidator = /* @__PURE__ */ getValidator(channelUserPatchSchema, dataValidator)
export const channelUserQueryValidator = /* @__PURE__ */ getValidator(channelUserQuerySchema, queryValidator)
