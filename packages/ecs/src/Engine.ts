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

import type { UserID } from '@etherealengine/common/src/schema.type.module'
import * as Hyperflux from '@etherealengine/hyperflux'
import { ReactorReconciler, createHyperStore, getState } from '@etherealengine/hyperflux'
import { HyperFlux, HyperStore, disposeStore } from '@etherealengine/hyperflux/functions/StoreFunctions'
import * as bitECS from 'bitecs'

import type { FeathersApplication } from '@feathersjs/feathers'

import type { ServiceTypes } from '@etherealengine/common/declarations'

import { getAllEntities } from 'bitecs'
import { Scene } from 'three'
import { ECSState } from './ECSState'
import { Entity, UndefinedEntity } from './Entity'
import { removeEntity } from './EntityFunctions'
import { removeQuery } from './QueryFunctions'
import { SystemState } from './SystemState'

export class Engine {
  static instance: Engine

  api: FeathersApplication<ServiceTypes>

  /** The uuid of the logged-in user */
  userID: UserID

  store: HyperStore

  /**
   * Reference to the three.js scene object.
   */
  scene = new Scene()

  /**
   * The xr origin reference space entity
   */
  localFloorEntity = UndefinedEntity

  /** @deprecated use localFloorEntity instead */
  get originEntity() {
    return this.localFloorEntity
  }

  /**
   * The viewer entity
   */
  viewerEntity = UndefinedEntity

  /** @deprecated use viewerEntity instead */
  get cameraEntity() {
    return this.viewerEntity
  }
}

globalThis.Engine = Engine
globalThis.Hyperflux = Hyperflux

export function startEngine() {
  if (Engine.instance) throw new Error('Store already exists')
  Engine.instance = new Engine()
  Engine.instance.store = bitECS.createWorld(
    createHyperStore({
      getDispatchTime: () => getState(ECSState).simulationTime,
      getCurrentReactorRoot: () =>
        getState(SystemState).activeSystemReactors.get(getState(SystemState).currentSystemUUID)
    })
  ) as HyperStore
  const UndefinedEntity = bitECS.addEntity(HyperFlux.store)
}

export async function destroyEngine() {
  getState(ECSState).timer?.clear()

  if (Engine.instance.api) {
    if ((Engine.instance.api as any).server) await Engine.instance.api.teardown()

    const knex = (Engine.instance.api as any).get?.('knexClient')
    if (knex) await knex.destroy()
  }

  /** Remove all entities */
  const entities = getAllEntities(HyperFlux.store) as Entity[]

  ReactorReconciler.flushSync(() => {
    for (const entity of entities) removeEntity(entity)
  })

  for (const query of getState(SystemState).reactiveQueryStates) {
    removeQuery(query.query)
  }

  disposeStore()

  /** @todo include in next bitecs update */
  // bitecs.deleteWorld(Engine.instance)
  Engine.instance = null!
}
