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

import { OpaqueType } from '@etherealengine/common/src/interfaces/OpaqueType'

import { TypedString } from '../../types/TypeboxUtils'
import { InstanceID } from '../networking/instance.schema'
import { UserID } from '../user/user.schema'
import { dataValidator, queryValidator } from '../validators'
import { channelUserSchema } from './channel-user.schema'
import { messageSchema } from './message.schema'

export const channelPath = 'channel'

export const channelMethods = ['get', 'create', 'find', 'patch', 'remove'] as const

export type ChannelID = OpaqueType<'ChannelID'> & string

// Main data model schema
export const channelSchema = Type.Object(
  {
    id: TypedString<ChannelID>({
      format: 'uuid'
    }),
    name: Type.String(),
    instanceId: Type.Optional(
      TypedString<InstanceID>({
        format: 'uuid'
      })
    ),
    channelUsers: Type.Array(Type.Ref(channelUserSchema)),
    messages: Type.Array(Type.Ref(messageSchema)),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'Channel', additionalProperties: false }
)
export interface ChannelType extends Static<typeof channelSchema> {}

// Schema for creating new entries
export const channelDataProperties = Type.Partial(Type.Pick(channelSchema, ['name', 'instanceId']))

export const channelDataSchema = Type.Intersect(
  [
    channelDataProperties,
    Type.Object({
      users: Type.Optional(
        Type.Array(
          TypedString<UserID>({
            format: 'uuid'
          })
        )
      )
    })
  ],
  {
    $id: 'ChannelData',
    additionalProperties: false
  }
)
export interface ChannelData extends Static<typeof channelDataSchema> {}

// Schema for updating existing entries
export const channelPatchSchema = Type.Partial(channelSchema, {
  $id: 'ChannelPatch'
})
export interface ChannelPatch extends Static<typeof channelPatchSchema> {}

// Schema for allowed query properties
export const channelQueryProperties = Type.Pick(channelSchema, ['id', 'name', 'instanceId'])
export const channelQuerySchema = Type.Intersect(
  [
    querySyntax(channelQueryProperties, {
      name: {
        $like: Type.String()
      }
    }),
    // Add additional query properties here
    Type.Object(
      {
        action: Type.Optional(Type.String()),
        paginate: Type.Optional(Type.Boolean())
      },
      { additionalProperties: false }
    )
  ],
  { additionalProperties: false }
)
export interface ChannelQuery extends Static<typeof channelQuerySchema> {}

export const channelValidator = /* @__PURE__ */ getValidator(channelSchema, dataValidator)
export const channelDataValidator = /* @__PURE__ */ getValidator(channelDataSchema, dataValidator)
export const channelPatchValidator = /* @__PURE__ */ getValidator(channelPatchSchema, dataValidator)
export const channelQueryValidator = /* @__PURE__ */ getValidator(channelQuerySchema, queryValidator)
