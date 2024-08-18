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
import { dataValidator, queryValidator } from '../validators'
import { ScopeType } from './scope.schema'

export const scopeTypePath = 'scope-type'

export const scopeTypeMethods = ['find', 'get'] as const

// Main data model schema
export const scopeTypeSchema = Type.Object(
  {
    type: TypedString<ScopeType>(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' })
  },
  { $id: 'ScopeType', additionalProperties: false }
)
export interface ScopeTypeType extends Static<typeof scopeTypeSchema> {}

// Schema for creating new entries
export const scopeTypeDataSchema = Type.Pick(scopeTypeSchema, ['type'], {
  $id: 'ScopeTypeData'
})
export interface ScopeTypeData extends Static<typeof scopeTypeDataSchema> {}

// Schema for updating existing entries
export const scopeTypePatchSchema = Type.Partial(scopeTypeSchema, {
  $id: 'ScopeTypePatch'
})
export interface ScopeTypePatch extends Static<typeof scopeTypePatchSchema> {}

// Schema for allowed query properties
export const scopeTypeQueryProperties = Type.Pick(scopeTypeSchema, ['type'])
export const scopeTypeQuerySchema = Type.Intersect(
  [
    querySyntax(scopeTypeQueryProperties),
    // Add additional query properties here
    Type.Object(
      {
        paginate: Type.Optional(Type.Boolean())
      },
      { additionalProperties: false }
    )
  ],
  { additionalProperties: false }
)
export interface ScopeTypeQuery extends Static<typeof scopeTypeQuerySchema> {}

export const scopeTypeValidator = /* @__PURE__ */ getValidator(scopeTypeSchema, dataValidator)
export const scopeTypeDataValidator = /* @__PURE__ */ getValidator(scopeTypeDataSchema, dataValidator)
export const scopeTypePatchValidator = /* @__PURE__ */ getValidator(scopeTypePatchSchema, dataValidator)
export const scopeTypeQueryValidator = /* @__PURE__ */ getValidator(scopeTypeQuerySchema, queryValidator)
