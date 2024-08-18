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
import { disallow, discardQuery, iff, isProvider } from 'feathers-hooks-common'

import {
  InstanceData,
  instanceDataValidator,
  instancePatchValidator,
  instancePath,
  instanceQueryValidator,
  InstanceType
} from '@etherealengine/common/src/schemas/networking/instance.schema'
import { LocationID, locationPath, LocationType } from '@etherealengine/common/src/schemas/social/location.schema'

import { HookContext } from '../../../declarations'
import isAction from '../../hooks/is-action'
import verifyScope from '../../hooks/verify-scope'
import { generateRoomCode, InstanceService } from './instance.class'
import {
  instanceDataResolver,
  instanceExternalResolver,
  instancePatchResolver,
  instanceQueryResolver,
  instanceResolver
} from './instance.resolvers'

/**
 * Sort result by location name
 * @param context
 * @returns
 */
const sortByLocationName = async (context: HookContext<InstanceService>) => {
  if (context.params.query?.$sort?.['locationName']) {
    const sort = context.params.query.$sort['locationName']
    delete context.params.query.$sort['locationName']

    const query = context.service.createQuery(context.params)

    query.join(locationPath, `${locationPath}.id`, `${instancePath}.locationId`)
    query.orderBy(`${locationPath}.name`, sort === 1 ? 'asc' : 'desc')
    query.select(`${instancePath}.*`)

    context.params.knex = query
  }
}

/**
 * Add location search to query
 * @param context
 * @returns
 */
const addLocationSearchToQuery = async (context: HookContext<InstanceService>) => {
  const { action, search } = context.params.query || {}
  if (!search) return

  const foundLocations = (await context.app.service(locationPath)._find({
    query: { name: { $like: `%${search}%` } },
    paginate: false
  })) as any as LocationType[]

  /** @TODO we should add a filter property to filter ended instances */
  context.params.query = {
    ...context.params.query,
    ended: false,
    $or: [
      {
        ipAddress: {
          $like: `%${search}%`
        }
      },
      {
        locationId: {
          $in: foundLocations.map((item) => item.id as LocationID)
        }
      }
    ]
  }
}

/**
 * Ensure newly created instance has a unique room code
 * @param context
 * @returns
 */
const addRoomCode = async (context: HookContext<InstanceService>) => {
  if (!context.data || context.method !== 'create') {
    throw new BadRequest(`${context.path} service only works for data in ${context.method}`)
  }

  const data: InstanceData[] = Array.isArray(context.data) ? context.data : [context.data]

  for (const item of data) {
    let existingInstances: InstanceType[] = []

    do {
      item.roomCode = generateRoomCode()
      // We need to have unique room codes therefore checking if room code already exists
      existingInstances = (await context.service._find({
        query: {
          roomCode: item.roomCode,
          ended: false
        },
        paginate: false
      })) as any as InstanceType[]
    } while (existingInstances.length > 0)
  }

  return context
}

export default {
  around: {
    all: [schemaHooks.resolveExternal(instanceExternalResolver), schemaHooks.resolveResult(instanceResolver)]
  },

  before: {
    all: [schemaHooks.validateQuery(instanceQueryValidator), schemaHooks.resolveQuery(instanceQueryResolver)],
    find: [
      iff(isProvider('external') && isAction('admin'), verifyScope('instance', 'read'), addLocationSearchToQuery),
      discardQuery('search'),
      discardQuery('action'),
      sortByLocationName
    ],
    get: [],
    create: [
      iff(isProvider('external'), verifyScope('instance', 'write')),
      schemaHooks.validateData(instanceDataValidator),
      schemaHooks.resolveData(instanceDataResolver),
      addRoomCode
    ],
    update: [disallow()],
    patch: [
      iff(isProvider('external'), verifyScope('instance', 'write')),
      schemaHooks.validateData(instancePatchValidator),
      schemaHooks.resolveData(instancePatchResolver)
    ],
    remove: [iff(isProvider('external'), verifyScope('instance', 'write'))]
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
