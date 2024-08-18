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

/**
 * @fileoverview
 * @todo Write the `fileoverview` for `ComponentFunctions.ts`
 */
import * as bitECS from 'bitecs'
import React, { startTransition, use } from 'react'
// tslint:disable:ordered-imports
import type from 'react/experimental'

import config from '@etherealengine/common/src/config'
import { DeepReadonly } from '@etherealengine/common/src/DeepReadonly'
import { HookableFunction } from '@etherealengine/common/src/utils/createHookableFunction'
import { getNestedObject } from '@etherealengine/common/src/utils/getNestedProperty'
import { HyperFlux, ReactorRoot, startReactor } from '@etherealengine/hyperflux'
import {
  hookstate,
  InferStateValueType,
  NO_PROXY,
  NO_PROXY_STEALTH,
  none,
  State,
  useHookstate
} from '@etherealengine/hyperflux/functions/StateFunctions'

import { Entity, UndefinedEntity } from './Entity'
import { EntityContext } from './EntityFunctions'
import { defineQuery } from './QueryFunctions'
import { useExecute } from './SystemFunctions'
import { PresentationSystemGroup } from './SystemGroups'

/**
 * @description
 * Initial Max amount of entries that buffers for a Component type will contain.
 * - `100_000` for 'test' client environment
 * - `5_000` otherwise
 */
export const INITIAL_COMPONENT_SIZE =
  config.client.appEnv === 'test' ? 100000 : 5000 /** @todo set to 0 after next bitECS update */
bitECS.setDefaultSize(INITIAL_COMPONENT_SIZE) // Send the INITIAL_COMPONENT_SIZE value to bitECS as its DefaultSize

export const ComponentMap = new Map<string, Component<any, any, any>>()
export const ComponentJSONIDMap = new Map<string, Component<any, any, any>>() // <jsonID, Component>
globalThis.ComponentMap = ComponentMap
globalThis.ComponentJSONIDMap = ComponentJSONIDMap

//::::: Helper and Validation generic types ::::://
/** @private Type that will become a [Typescript.Partial](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype) if T is extending an object, but will be just T otherwise. */
type PartialIfObject<T> = T extends object ? Partial<T> : T
/** @private Type used to validate that the type returned by {@link Component.onInit} is not a {@link State} object. */
type OnInitValidateNotState<T> = T extends State<any, object | unknown> ? 'onInit must not return a State object' : T
/** @private Just a dummy string literal union */
type SomeStringLiteral = 'a' | 'b' | 'c'
/** @private Type that will be a `string` when T is an extension of `string`, but will be a dummy string union otherwise. */
type StringLiteral<T> = string extends T ? SomeStringLiteral : string

/**
 * @description
 * Data used to create a Component with {@link defineComponent}.
 * @why
 * This type exists so that some of the properties of {@link Component}s are optional when defining them, but required during normal use.
 * See [Typescript.Partial](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype) for a reference of what Partials are.
 */
export interface ComponentPartial<
  ComponentType = any,
  Schema extends bitECS.ISchema = Record<string, never>,
  JSON = ComponentType,
  SetJSON = PartialIfObject<DeepReadonly<JSON>>,
  ErrorTypes = never
> {
  /** @description Human readable label for the component. Displayed in the editor and debugging tools. */
  name: string
  /** @description Internal ID used to reference this component in JSON data. */
  jsonID?: string
  /** @description A Component's Schema is the shape of its runtime data. */
  schema?: Schema
  /**
   * @description Called once when the component is added to an entity (ie: initialized).
   * @param this `@internal` The component partial itself.
   * @param entity The {@link Entity} to which this Component is being assigned.
   * @returns The schema (aka shape) of the component's runtime data.
   */
  onInit?: (this: SoAComponentType<Schema>, entity: Entity) => ComponentType & OnInitValidateNotState<ComponentType>
  /**
   * @description
   * Serializer function called when the component is saved to a snapshot or scene file.
   * Its logic must convert the component's runtime data into a JSON object.
   * @param entity The {@link Entity} to which this Component is assigned.
   * @param component The Component's global data (aka {@link State}).
   */
  toJSON?: (entity: Entity, component: State<ComponentType>) => JSON
  /**
   * @description
   * Called when the component's data is updated via the {@link setComponent} function.
   * This is where deserialization logic should happen.
   * @param entity The {@link Entity} to which this Component is assigned.
   * @param component The Component's global data (aka {@link State}).
   * @param json The JSON object that contains this component's serialized data.
   */
  onSet?: (entity: Entity, component: State<ComponentType>, json?: SetJSON) => void
  /** @todo Explain ComponentPartial.onRemove(...) */
  onRemove?: (entity: Entity, component: State<ComponentType>) => void | Promise<void>
  /**
   * @summary Defines the {@link React.FC} async logic of the {@link Component} type.
   * @notes Any side-effects that depend on the component's data should be defined here.
   * @description
   * {@link React}'s `Function Component` of the resulting ECS {@link Component} type.
   * `@todo` Explain what reactive is in this context
   * `@todo` Explain this function
   */
  reactor?: any // previously <React.FC> breaks types
  /**
   * @todo Explain ComponentPartial.errors[]
   */
  errors?: ErrorTypes[]
}

/**
 * @description
 * Defines the shape that all Engine's ECS Components will have.
 *
 * See {@link ComponentType} for the `type` version of this interface.
 * See {@link ComponentPartial} to find the data required to define a new Component with {@link defineComponent}.
 */
export interface Component<
  ComponentType = any,
  Schema extends bitECS.ISchema = Record<string, any>,
  JSON = ComponentType,
  SetJSON = PartialIfObject<DeepReadonly<JSON>>,
  ErrorTypes = string
> {
  isComponent: true
  name: string
  jsonID?: string
  schema?: Schema
  onInit: (this: SoAComponentType<Schema>, entity: Entity) => ComponentType & OnInitValidateNotState<ComponentType>
  toJSON: (entity: Entity, component: State<ComponentType>) => JSON
  onSet: (entity: Entity, component: State<ComponentType>, json?: SetJSON) => void
  onRemove: (entity: Entity, component: State<ComponentType>) => void
  reactor?: any
  reactorMap: Map<Entity, ReactorRoot>
  stateMap: Record<Entity, State<ComponentType> | undefined>
  errors: ErrorTypes[]
}

/** @todo Describe this type */
export type SoAComponentType<S extends bitECS.ISchema> = bitECS.ComponentType<S>
/** @description Generic `type` for all Engine's ECS {@link Component}s. All of its fields are required to not be `null`. */
export type ComponentType<C extends Component> = InferStateValueType<NonNullable<C['stateMap'][Entity]>>
/** @description Generic `type` for {@link Component}s, that takes the shape of the type returned by the its serialization function {@link Component.toJSON}. */
export type SerializedComponentType<C extends Component> = ReturnType<C['toJSON']>
/** @description Generic `type` for {@link Component}s, that takes the shape of the type returned by its {@link Component.onSet} function. */
export type SetComponentType<C extends Component> = Parameters<C['onSet']>[2]
/** @description Generic `type` for {@link Component}s, that takes the shape of the type used by its {@link Component.errors} field. */
export type ComponentErrorsType<C extends Component> =
  C['errors'][number] /** @todo What is C[...][number] doing here? */

/**
 * @description
 * Defines a new Component type.
 * Takes a {@link ComponentPartial}, fills in all of the missing information, and returns a complete {@link Component} type containing all of the required fields.
 * @param def Parameters required to initialize a Component, as seen at {@link ComponentPartial}
 * @returns A new fully setup Component type, with all data and callbacks required for it to be used by the engine.
 * @example
 * ```ts
 * export const MyComponent = defineComponent({
 *   name: 'MyComponent',
 *   schema: {
 *     id: Types.ui32
 *   },
 *   onInit: (entity) => {
 *     return {
 *       myProp: 'My Value'
 *     }
 *   },
 *   toJSON: (entity, component) => {
 *     return {
 *       myProp: component.myProp.value
 *     }
 *   },
 *   onSet: (entity, component, json) => {
 *     if (typeof json?.myProp === 'string') component.myProp.set(json.myProp)
 *   },
 *   onRemove: (entity, component) => {},
 *   reactor: undefined,
 *   errors: []
 * })
 * ```
 */
export const defineComponent = <
  ComponentType = true,
  Schema extends bitECS.ISchema = Record<string, never>,
  JSON = ComponentType,
  ComponentExtras = Record<string, any>,
  SetJSON = PartialIfObject<DeepReadonly<JSON>>,
  Error extends StringLiteral<Error> = ''
>(
  def: ComponentPartial<ComponentType, Schema, JSON, SetJSON, Error> & ComponentExtras
) => {
  const Component = (
    def.schema ? bitECS.defineComponent(def.schema, INITIAL_COMPONENT_SIZE) : {}
  ) as SoAComponentType<Schema> & Component<ComponentType, Schema, JSON, SetJSON, Error>
  Component.isComponent = true
  Component.onInit = (entity) => true as any
  Component.onSet = (entity, component, json) => {}
  Component.onRemove = () => {}
  Component.toJSON = (entity, component) => null!

  Component.errors = []
  Object.assign(Component, def)
  if (Component.reactor) Object.defineProperty(Component.reactor, 'name', { value: `Internal${Component.name}Reactor` })
  Component.reactorMap = new Map()
  // We have to create an stateful existence map in order to reactively track which entities have a given component.
  // Unfortunately, we can't simply use a single shared state because hookstate will (incorrectly) invalidate other nested states when a single component
  // instance is added/removed, so each component instance has to be isolated from the others.
  Component.stateMap = {}
  if (Component.jsonID) {
    ComponentJSONIDMap.set(Component.jsonID, Component)
    console.log(`Registered component ${Component.name} with jsonID ${Component.jsonID}`)
  } else if (def.toJSON) {
    console.warn(
      `Component ${Component.name} has toJson defined, but no jsonID defined. This will cause serialization issues.`
    )
  }
  ComponentMap.set(Component.name, Component)

  return Component as typeof Component & { _TYPE: ComponentType } & ComponentExtras

  // const ExternalComponentReactor = (props: SetJSON) => {
  //   const entity = useEntityContext()

  //   useLayoutEffect(() => {
  //     setComponent(entity, Component, props)
  //     return () => {
  //       removeComponent(entity, Component)
  //     }
  //   }, [props])

  //   return null
  // }
  // Object.setPrototypeOf(ExternalComponentReactor, Component)
  // Object.defineProperty(ExternalComponentReactor, 'name', { value: `${Component.name}Reactor` })

  // return ExternalComponentReactor as typeof Component & { _TYPE: ComponentType } & typeof ExternalComponentReactor
}

export const getOptionalMutableComponent = <ComponentType>(
  entity: Entity,
  component: Component<ComponentType, Record<string, any>, unknown>
): State<ComponentType> | undefined => {
  if (!component.stateMap[entity]) component.stateMap[entity] = hookstate(none) as State<ComponentType>
  const componentState = component.stateMap[entity]!
  return componentState.promised ? undefined : componentState
}

export const getMutableComponent = <ComponentType>(
  entity: Entity,
  component: Component<ComponentType, Record<string, any>, unknown>
): State<ComponentType> => {
  const componentState = getOptionalMutableComponent(entity, component)
  if (!componentState || componentState.promised) {
    console.warn(
      `[getMutableComponent]: entity ${entity} does not have ${component.name}. This will be an error in the future. Use getOptionalMutableComponent if there is uncertainty over whether or not an entity has the specified component.`
    )
    return undefined as any
  }
  return componentState
}

export const getOptionalComponent = <ComponentType>(
  entity: Entity,
  component: Component<ComponentType, Record<string, any>, unknown>
): ComponentType | undefined => {
  const componentState = component.stateMap[entity]!
  return componentState?.promised ? undefined : (componentState?.get(NO_PROXY_STEALTH) as ComponentType | undefined)
}

export const getComponent = <ComponentType>(
  entity: Entity,
  component: Component<ComponentType, Record<string, any>, unknown>
): ComponentType => {
  if (!bitECS.hasComponent(HyperFlux.store, component, entity)) {
    console.warn(
      `[getComponent]: entity ${entity} does not have ${component.name}. This will be an error in the future. Use getOptionalComponent if there is uncertainty over whether or not an entity has the specified component.`
    )
    return undefined as any
  }
  const componentState = component.stateMap[entity]!
  return componentState.get(NO_PROXY_STEALTH) as ComponentType
}

/**
 * @description
 * Assigns the given component to the given entity, and returns the component.
 * @notes
 * - If the component already exists, it will be overwritten.
 * - Unlike calling {@link removeComponent} followed by {@link addComponent}, the entry queue will not be rerun.
 *
 * @param entity The entity to which the Component will be attached.
 * @param Component The Component that will be attached.
 * @param args `@todo` Explain what `setComponent(   args)` is
 * @returns The component that was attached.
 */
export const setComponent = <C extends Component>(
  entity: Entity,
  Component: C,
  args: SetComponentType<C> | undefined = undefined
) => {
  if (!entity) {
    throw new Error('[setComponent]: entity is undefined')
  }
  if (!bitECS.entityExists(HyperFlux.store, entity)) {
    throw new Error('[setComponent]: entity does not exist')
  }
  const componentExists = hasComponent(entity, Component)
  if (!componentExists) {
    const value = Component.onInit(entity)

    if (!Component.stateMap[entity]) {
      Component.stateMap[entity] = hookstate(value)
    } else {
      Component.stateMap[entity]!.set(value)
    }

    bitECS.addComponent(HyperFlux.store, Component, entity, false) // don't clear data on-add
  }

  Component.onSet(entity, Component.stateMap[entity]!, args as Readonly<SerializedComponentType<C>>)

  if (!componentExists && Component.reactor && !Component.reactorMap.has(entity)) {
    const root = startReactor(() => {
      return React.createElement(EntityContext.Provider, { value: entity }, React.createElement(Component.reactor!, {}))
    }) as ReactorRoot
    root['entity'] = entity
    root['component'] = Component.name
    Component.reactorMap.set(entity, root)
    return getComponent(entity, Component) as ComponentType<C>
  } else {
    const root = Component.reactorMap.get(entity)
    root?.run()
  }

  return getComponent(entity, Component) as ComponentType<C>
}

/**
 * @experimental
 * @description `@todo` Explain how `updateComponent` works.
 */
export const updateComponent = <C extends Component>(
  entity: Entity,
  Component: C,
  props: Partial<SerializedComponentType<C>>
) => {
  if (typeof props === 'undefined') return

  const comp = getMutableComponent(entity, Component)
  if (!comp) {
    throw new Error('[updateComponent]: component does not exist ' + Component.name)
  }

  startTransition(() => {
    if (typeof props !== 'object') {
      // component has top level value (eg NameComponent)
      comp.set(props)
    } else {
      for (const propertyName of Object.keys(props as any)) {
        const value = props[propertyName]
        const { result, finalProp } = getNestedObject(comp, propertyName)
        if (
          typeof value !== 'undefined' &&
          typeof result[finalProp] === 'object' &&
          typeof result[finalProp].set === 'function'
        ) {
          result[finalProp].set(value)
        } else {
          result[finalProp] = value
        }
      }
    }
    const root = Component.reactorMap.get(entity)
    if (!root?.isRunning) root?.run()
  })
}

export const hasComponent = <C extends Component>(entity: Entity, component: C) => {
  if (!component) throw new Error('[hasComponent]: component is undefined')
  if (!entity) return false
  return bitECS.hasComponent(HyperFlux.store, component, entity)
}

export const removeComponent = <C extends Component>(entity: Entity, component: C) => {
  if (!hasComponent(entity, component)) return
  component.onRemove(entity, component.stateMap[entity]!)
  bitECS.removeComponent(HyperFlux.store, component, entity, false)
  const root = component.reactorMap.get(entity)
  component.reactorMap.delete(entity)
  if (root?.isRunning) root.stop()
  /** clear state data after reactor stops, to ensure hookstate is still referenceable */
  component.stateMap[entity]?.set(none)
}

/**
 * @description
 * Initializes a temporary Component of the same type that the given Component, using its {@link Component.onInit} function, and returns its serialized JSON data.
 * @notes The temporary Component won't be inserted into the ECS system, and its data will be GC'ed at the end of this function.
 * @param component The desired Component.
 * @returns JSON object containing the requested data.
 */
export const componentJsonDefaults = <C extends Component>(component: C) => {
  const initial = component.onInit(UndefinedEntity)
  const pseudoState: Record<string, { value: any; get: () => any }> = {}
  for (const key of Object.keys(initial)) {
    pseudoState[key] = {
      value: initial[key],
      get: () => initial[key]
    }
  }
  return component.toJSON(UndefinedEntity, pseudoState as any)
}

/**
 * @description Returns a array of all {@link Component}s associated with the given {@link Entity}.
 * @param entity The desired Entity.
 * @returns An array containing all of the Entity's associated components.
 */
export const getAllComponents = (entity: Entity): Component[] => {
  if (!bitECS.entityExists(HyperFlux.store, entity)) return []
  return bitECS.getEntityComponents(HyperFlux.store, entity) as Component[]
}

/**
 * @description Returns an {@link Object} containing the data of all {@link Component}s of the given {@link Entity}.
 * @param entity The desired Entity.
 * @returns An {@link Object} where each component of the given {@link Entity} has its own field.
 */
export const getAllComponentData = (entity: Entity): { [name: string]: ComponentType<any> } => {
  return Object.fromEntries(getAllComponents(entity).map((C) => [C.name, getComponent(entity, C)]))
}

export const removeAllComponents = (entity: Entity) => {
  try {
    for (const component of bitECS.getEntityComponents(HyperFlux.store, entity)) {
      try {
        removeComponent(entity, component as Component)
      } catch (e) {
        console.error(e)
      }
    }
  } catch (e) {
    console.error(e)
  }
}

export const serializeComponent = <C extends Component<any, any, any>>(entity: Entity, Component: C) => {
  const component = getMutableComponent(entity, Component)
  return JSON.parse(JSON.stringify(Component.toJSON(entity, component))) as ReturnType<C['toJSON']>
}

// use seems to be unavailable in the server environment
export function _use(promise) {
  if (promise.status === 'fulfilled') {
    return promise.value
  } else if (promise.status === 'rejected') {
    throw promise.reason
  } else if (promise.status === 'pending') {
    throw promise
  } else {
    promise.status = 'pending'
    promise.then(
      (result) => {
        promise.status = 'fulfilled'
        promise.value = result
      },
      (reason) => {
        promise.status = 'rejected'
        promise.reason = reason
      }
    )
    throw promise
  }
}

/**
 * Use a component in a reactive context (a React component)
 */
export function useComponent<C extends Component<any>>(entity: Entity, Component: C) {
  if (entity === UndefinedEntity) throw new Error('InvalidUsage: useComponent called with UndefinedEntity')
  if (!Component.stateMap[entity]) Component.stateMap[entity] = hookstate(none)
  const componentState = Component.stateMap[entity]!
  // use() will suspend the component (by throwing a promise) and resume when the promise is resolved
  if (componentState.promise) {
    ;(use ?? _use)(componentState.promise)
  }
  return useHookstate(componentState) as any as State<ComponentType<C>> // todo fix any cast
}

/**
 * Use a component in a reactive context (a React component)
 */
export function useOptionalComponent<C extends Component<any>>(entity: Entity, Component: C) {
  if (!Component.stateMap[entity]) Component.stateMap[entity] = hookstate(none)
  const component = useHookstate(Component.stateMap[entity]) as any as State<ComponentType<C>> // todo fix any cast
  return component.promised ? undefined : component
}

export const getComponentCountOfType = <C extends Component>(component: C): number => {
  const query = defineQuery([component])
  const length = query().length
  bitECS.removeQuery(HyperFlux.store, query._query)
  return length
}

export const getAllComponentsOfType = <C extends Component<any>>(component: C): ComponentType<C>[] => {
  const query = defineQuery([component])
  const entities = query()
  bitECS.removeQuery(HyperFlux.store, query._query)
  return entities.map((e) => {
    return getComponent(e, component)!
  })
}
