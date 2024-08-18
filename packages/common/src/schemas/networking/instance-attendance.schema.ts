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
import { UserID } from '../user/user.schema'
import { dataValidator, queryValidator } from '../validators'
import { InstanceID, instanceSchema } from './instance.schema'

export const instanceAttendancePath = 'instance-attendance'

export const instanceAttendanceMethods = ['find', 'create', 'patch', 'remove', 'get'] as const

// Main data model schema
export const instanceAttendanceSchema = Type.Object(
  {
    id: Type.String({
      format: 'uuid'
    }),
    sceneId: Type.Optional(Type.String()),
    isChannel: Type.Boolean(),
    ended: Type.Boolean(),
    instanceId: TypedString<InstanceID>({
      format: 'uuid'
    }),
    userId: TypedString<UserID>({
      format: 'uuid'
    }),
    instance: Type.Ref(instanceSchema),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'InstanceAttendance', additionalProperties: false }
)
export interface InstanceAttendanceType extends Static<typeof instanceAttendanceSchema> {}

// Schema for creating new entries
export const instanceAttendanceDataSchema = Type.Pick(
  instanceAttendanceSchema,
  ['isChannel', 'instanceId', 'userId', 'sceneId'],
  {
    $id: 'InstanceAttendanceData'
  }
)
export interface InstanceAttendanceData extends Static<typeof instanceAttendanceDataSchema> {}

// Schema for updating existing entries
export const instanceAttendancePatchSchema = Type.Partial(instanceAttendanceSchema, {
  $id: 'InstanceAttendancePatch'
})
export interface InstanceAttendancePatch extends Static<typeof instanceAttendancePatchSchema> {}

// Schema for allowed query properties
export const instanceAttendanceQueryProperties = Type.Pick(instanceAttendanceSchema, [
  'id',
  'sceneId',
  'isChannel',
  'ended',
  'instanceId',
  'userId'
])
export const instanceAttendanceQuerySchema = Type.Intersect(
  [
    querySyntax(instanceAttendanceQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export interface InstanceAttendanceQuery extends Static<typeof instanceAttendanceQuerySchema> {}

export const instanceAttendanceValidator = /* @__PURE__ */ getValidator(instanceAttendanceSchema, dataValidator)
export const instanceAttendanceDataValidator = /* @__PURE__ */ getValidator(instanceAttendanceDataSchema, dataValidator)
export const instanceAttendancePatchValidator = /* @__PURE__ */ getValidator(
  instanceAttendancePatchSchema,
  dataValidator
)
export const instanceAttendanceQueryValidator = /* @__PURE__ */ getValidator(
  instanceAttendanceQuerySchema,
  queryValidator
)
