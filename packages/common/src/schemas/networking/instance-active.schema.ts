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

import { dataValidator, queryValidator } from '../validators'
import { instanceSchema } from './instance.schema'

export const instanceActivePath = 'instance-active'

export const instanceActiveMethods = ['find'] as const

// Main data model schema
export const instanceActiveSchema = Type.Pick(
  instanceSchema,
  ['id', 'currentUsers', 'locationId'],

  { $id: 'InstanceActive', additionalProperties: false }
)
export interface InstanceActiveType extends Static<typeof instanceActiveSchema> {}

// Schema for allowed query properties
export const instanceActiveQueryProperties = Type.Pick(instanceActiveSchema, ['id', 'locationId', 'currentUsers'])
export const instanceActiveQuerySchema = Type.Intersect(
  [
    querySyntax(instanceActiveQueryProperties),
    // Add additional query properties here
    Type.Object(
      {
        sceneId: Type.String()
      },
      { additionalProperties: false }
    )
  ],
  { additionalProperties: false }
)
export interface InstanceActiveQuery extends Static<typeof instanceActiveQuerySchema> {}

export const instanceActiveValidator = /* @__PURE__ */ getValidator(instanceActiveSchema, dataValidator)
export const instanceActiveQueryValidator = /* @__PURE__ */ getValidator(instanceActiveQuerySchema, queryValidator)
