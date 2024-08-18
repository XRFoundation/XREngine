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
import { dataValidator, queryValidator } from '@etherealengine/common/src/schemas/validators'
import type { Static } from '@feathersjs/typebox'
import { StringEnum, Type, getValidator, querySyntax } from '@feathersjs/typebox'
import { TypedString } from '../../types/TypeboxUtils'
import { UserID } from '../user/user.schema'

export const projectSettingPath = 'project-setting'

export const projectSettingMethods = ['find', 'create', 'patch', 'remove'] as const

// Main data model schema
export const projectSettingSchema = Type.Object(
  {
    id: Type.String({
      format: 'uuid'
    }),
    key: Type.String(),
    value: Type.String(),
    type: StringEnum(['private', 'public']),
    projectId: Type.String({
      format: 'uuid'
    }),
    userId: Type.Optional(
      TypedString<UserID>({
        format: 'uuid'
      })
    ),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'ProjectSetting', additionalProperties: false }
)
export interface ProjectSettingType extends Static<typeof projectSettingSchema> {}

// Schema for creating new entries
export const projectSettingDataSchema = Type.Pick(
  projectSettingSchema,
  ['key', 'value', 'type', 'projectId', 'userId'],
  {
    $id: 'ProjectSettingData'
  }
)
export interface ProjectSettingData extends Static<typeof projectSettingDataSchema> {}

// Schema for updating existing entries
export const projectSettingPatchSchema = Type.Partial(Type.Pick(projectSettingSchema, ['key', 'value', 'type']), {
  $id: 'ProjectSettingPatch'
})
export interface ProjectSettingPatch extends Static<typeof projectSettingPatchSchema> {}

// Schema for allowed query properties
export const projectSettingQueryProperties = Type.Pick(projectSettingSchema, ['id', 'key', 'value', 'projectId'])
export const projectSettingQuerySchema = Type.Intersect(
  [
    querySyntax(projectSettingQueryProperties),
    // Add additional query properties here
    Type.Object({}, { additionalProperties: false })
  ],
  { additionalProperties: false }
)
export interface ProjectSettingQuery extends Static<typeof projectSettingQuerySchema> {}

export const projectSettingValidator = /* @__PURE__ */ getValidator(projectSettingSchema, dataValidator)
export const projectSettingDataValidator = /* @__PURE__ */ getValidator(projectSettingDataSchema, dataValidator)
export const projectSettingPatchValidator = /* @__PURE__ */ getValidator(projectSettingPatchSchema, dataValidator)
export const projectSettingQueryValidator = /* @__PURE__ */ getValidator(projectSettingQuerySchema, queryValidator)
