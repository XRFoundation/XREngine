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
import { ChannelID } from '../social/channel.schema'
import { LocationID, locationSchema, RoomCode } from '../social/location.schema'
import { dataValidator, queryValidator } from '../validators'

export const instancePath = 'instance'

export const instanceMethods = ['create', 'find', 'get', 'patch', 'remove'] as const

export type InstanceID = OpaqueType<'InstanceID'> & string

// Main data model schema
export const instanceSchema = Type.Object(
  {
    id: TypedString<InstanceID>({
      format: 'uuid'
    }),
    roomCode: TypedString<RoomCode>(),
    ipAddress: Type.Optional(Type.String()),
    channelId: Type.Optional(
      TypedString<ChannelID>({
        format: 'uuid'
      })
    ),
    projectId: Type.String({
      format: 'uuid'
    }),
    podName: Type.Optional(Type.String()),
    currentUsers: Type.Integer(),
    ended: Type.Optional(Type.Boolean()),
    assigned: Type.Optional(Type.Boolean()),
    locationId: Type.Optional(
      TypedString<LocationID>({
        format: 'uuid'
      })
    ),
    assignedAt: Type.Optional(Type.Union([Type.Null(), Type.String({ format: 'date-time' })])),
    location: Type.Ref(locationSchema),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'Instance', additionalProperties: false }
)
export interface InstanceType extends Static<typeof instanceSchema> {}

// Schema for creating new entries
export const instanceDataSchema = Type.Partial(
  Type.Pick(
    instanceSchema,
    ['roomCode', 'ipAddress', 'channelId', 'podName', 'currentUsers', 'ended', 'assigned', 'locationId', 'assignedAt'],
    {
      $id: 'InstanceData'
    }
  )
)
export interface InstanceData extends Static<typeof instanceDataSchema> {}

// Schema for updating existing entries
export const instancePatchSchema = Type.Partial(instanceSchema, {
  $id: 'InstancePatch'
})
export interface InstancePatch extends Static<typeof instancePatchSchema> {}

// Schema for allowed query properties
export const instanceQueryProperties = Type.Pick(instanceSchema, [
  'id',
  'roomCode',
  'ipAddress',
  'channelId',
  'projectId',
  'podName',
  'currentUsers',
  'ended',
  'assigned',
  'locationId',
  'assignedAt',
  'createdAt'
])
export const instanceQuerySchema = Type.Intersect(
  [
    querySyntax(instanceQueryProperties, {
      ipAddress: {
        $like: Type.String()
      },
      id: {
        $like: Type.String()
      },
      locationId: { $like: Type.String() },
      channelId: { $like: Type.String() }
    }),
    // Add additional query properties here
    Type.Object(
      { action: Type.Optional(Type.String()), search: Type.Optional(Type.String()) },
      { additionalProperties: false }
    )
  ],
  { additionalProperties: false }
)
export interface InstanceQuery extends Static<typeof instanceQuerySchema> {}

export const instanceValidator = /* @__PURE__ */ getValidator(instanceSchema, dataValidator)
export const instanceDataValidator = /* @__PURE__ */ getValidator(instanceDataSchema, dataValidator)
export const instancePatchValidator = /* @__PURE__ */ getValidator(instancePatchSchema, dataValidator)
export const instanceQueryValidator = /* @__PURE__ */ getValidator(instanceQuerySchema, queryValidator)
