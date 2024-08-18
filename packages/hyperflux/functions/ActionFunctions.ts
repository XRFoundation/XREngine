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

import { matches, Parser, Validator } from 'ts-matches'
import { v4 as uuidv4 } from 'uuid'

import { OpaqueType } from '@etherealengine/common/src/interfaces/OpaqueType'
import multiLogger from '@etherealengine/common/src/logger'
import { InstanceID } from '@etherealengine/common/src/schema.type.module'
import { createHookableFunction } from '@etherealengine/common/src/utils/createHookableFunction'
import { deepEqual } from '@etherealengine/common/src/utils/deepEqual'

import { ReactorRoot } from './ReactorFunctions'
import { getMutableState, setInitialState, StateDefinitions } from './StateFunctions'
import { HyperFlux } from './StoreFunctions'

const logger = multiLogger.child({ component: 'hyperflux:Action' })

export type PeerID = OpaqueType<'PeerID'> & string

const matchesPeerID = matches.string as Validator<unknown, PeerID>

export { matches, Validator } from 'ts-matches'
export { matchesPeerID }

export type Topic = OpaqueType<'Topic'> & string

export type Action = {
  /**
   * The type of action
   */
  type: string | string[]
} & ActionOptions

export type ActionRecipients = PeerID | PeerID[] | 'all' | 'others'

export type ActionCacheOptions =
  | boolean
  | {
      /**
       * If non-falsy, remove previous actions in the cache that match `$peer` and `type` fields,
       * and any specified fields
       */
      removePrevious?: boolean | string[]
      /**
       * If true, do not cache this action
       */
      disable?: boolean
    }

export type ActionOptions = {
  /**
   * The uuid of this action, uniquely identifying it
   */
  $uuid?: string

  /**
   * The id of the sender's socket
   * Will be undefined if dispatched locally or not in a network
   */
  $peer?: PeerID

  /**
   * The intended recipients
   */
  $to?: ActionRecipients

  /**
   * The intended time for this action to be applied
   * - If this option is missing, the action is applied the next time applyIncomingActions() is called.
   * - If this action is received late (after the desired tick has passed), it is dispatched on the next tick.
   */
  $time?: number | undefined

  /**
   * The network type for which to send this action to
   */
  $topic?: Topic

  /**
   * Optionally specify the network to send this action to.
   * Specifying this will not send the action to other networks, even as a cached action.
   */
  $network?: InstanceID | undefined // TODO make a type for NetworkID

  /**
   * Specifies how this action should be cached for newly joining clients.
   */
  $cache?: ActionCacheOptions

  /**
   * This action is being replayed from the cache
   */
  $fromCache?: true

  /**
   * The call stack at the time the action was dispatched
   */
  $stack?: string[]

  /**
   * An error that occurred while applying this action
   */
  $ERROR?: { message: string; stack: string[] }
}

export type ActionShape<ActionType extends Action> = {
  [key in keyof ActionType]: key extends 'type'
    ? ActionType[key]
    : ActionType[key] extends Validator<unknown, unknown>
    ? ActionType[key]
    : ActionType[key] extends string | number | boolean | any
    ? ActionType[key] | Validator<unknown, ActionType[key]>
    : ActionType[key] extends MatchesWithDefault<unknown>
    ? ActionType[key]
    : never
}

// type t = ActionShape<{store:'test', type:'hello', $cache: {removePrevious: true}, count: MatchesWithDefault<number>}>

export type ResolvedActionShape<Shape extends ActionShape<any>> = {
  [key in keyof Shape]: Shape[key] extends Validator<unknown, infer B>
    ? Validator<unknown, Exclude<B, Validator<any, any>>>
    : Shape[key] extends MatchesWithDefault<infer C>
    ? Validator<unknown, Exclude<C, Validator<any, any>>>
    : Shape[key] extends string | number | boolean | any
    ? Validator<unknown, Exclude<Shape[key], Validator<any, any>>>
    : never
}

// type t = ResolvedActionShape<{store:'test', type:'hello', $cache: {removePrevious: true}, count: MatchesWithDefault<number>}>

export type ResolvedActionShapeWithOptionals<Shape extends ActionShape<any>> = {
  [key in keyof Shape]: Shape[key] extends Validator<unknown, infer B>
    ? Validator<unknown, Exclude<B, Validator<any, any>>>
    : Shape[key] extends MatchesWithDefault<infer C>
    ? Validator<unknown, Exclude<C, Validator<any, any>> | undefined>
    : Shape[key] extends string | number | boolean | any
    ? Validator<unknown, Exclude<Shape[key], Validator<any, any>> | undefined>
    : never
}

// type t = PartialActionShape<{store:'test', type:'hello', param: number, count: MatchesWithDefault<number>}>

type ActionTypeFromShape<Shape extends ActionShape<any>> = {
  [key in keyof Shape]: Shape[key] extends Validator<unknown, infer A>
    ? Shape[key]['_TYPE'] | A
    : Shape[key] extends MatchesWithDefault<Shape[key]>
    ? Shape[key]['matches']
    : Exclude<Shape[key], Validator<any, any>>
}

// type x = ResolvedActionShape<ActionShape<any>>
// // type t = ResolvedActionType<ActionShape<any>>
// type z = ResolvedActionType
// type t = ResolvedActionType<{store:'test', type:Validator<unknown,'hello'>|'hello', name:string, param: Validator<unknown,number>, count: MatchesWithDefault<number>}>

type IsOptional<T> = null extends T ? true : undefined extends T ? true : false

type JustOptionalKeys<Shape extends ActionShape<any>> = {
  [key in keyof Shape]: Shape[key] extends Validator<unknown, infer B>
    ? true extends IsOptional<B>
      ? key
      : never
    : true extends IsOptional<Shape[key]>
    ? key
    : never
}[keyof Shape]

type JustRequiredKeys<Shape extends ActionShape<any>> = {
  [key in keyof Shape]: Shape[key] extends Validator<unknown, infer B>
    ? true extends IsOptional<B>
      ? never
      : key
    : true extends IsOptional<Shape[key]>
    ? never
    : key
}[keyof Shape]

type JustOptionals<S extends ActionShape<any>> = Pick<S, JustOptionalKeys<S>>
type JustRequired<S extends ActionShape<any>> = Pick<S, JustRequiredKeys<S>>

export type ResolvedActionType<Shape extends ActionShape<Action> = ActionShape<{ type: string | string[] }>> = Required<
  ActionTypeFromShape<ResolvedActionShape<Shape>> & ActionOptions
>
export type PartialActionType<Shape extends ActionShape<any>> = Omit<
  Partial<ActionTypeFromShape<JustOptionals<ResolvedActionShapeWithOptionals<Shape>>>> &
    ActionOptions &
    Required<ActionTypeFromShape<JustRequired<ResolvedActionShapeWithOptionals<Shape>>>>,
  'type' | 'store'
>

// type t = PartialActionType<{store:'TEST',type:'TEST',name:string, bla:Validator<unknown, any>}>
// type t2 = ResolvedActionShape<{type:'test', count:MatchesWithDefault<number>}>
// type t3 = ResolvedActionShapeWithOptionals<{type:'test', count:MatchesWithDefault<number>}>
// type t = PartialActionType<{type:'test', count:MatchesWithDefault<number>}>

/**
 * Defines an action
 * @param actionShape
 * @returns a function that creates an instance of the defined action
 */
export const ActionDefinitions = {} as Record<string, any>

export type ActionReceptor<A extends ActionShape<Action>> = ((
  action: A,
  state: ReturnType<typeof getMutableState>
) => void) & {
  matchesAction: Validator<A, any>
}

export function isActionReceptor<A extends ActionShape<Action>>(f: any): f is ActionReceptor<A> {
  return 'matchesAction' in f
}

export function defineAction<Shape extends Omit<ActionShape<Action>, keyof ActionOptions>>(
  shape: Shape & ActionOptions
) {
  type ResolvedAction = ResolvedActionType<Shape>
  type PartialAction = PartialActionType<Shape>

  const shapeEntries = Object.entries(shape)

  // handle default callback properties
  const defaultEntries = shapeEntries.filter(
    ([k, v]: [string, any]) =>
      typeof v === 'object' && ('defaultValue' in v || ('parser' in v && v.parser.description.name === 'Default'))
  ) as Array<[string, MatchesWithDefault<any> | Validator<unknown, unknown>]>
  const defaultValidators = Object.fromEntries(
    defaultEntries.map(([k, v]) => [k, v instanceof Validator ? v : v.matches])
  )

  // handle literal shape properties
  const literalEntries = shapeEntries.filter(([k, v]) => typeof v !== 'object') as Array<
    [string, string | number | boolean]
  >
  const literalValidators = Object.fromEntries(literalEntries.map(([k, v]) => [k, matches.literal(v)]))

  // handle option properties
  const optionEntries = shapeEntries.filter(([k, v]) => k.startsWith('$')) as Array<
    [string, ActionOptions[keyof ActionOptions]]
  >
  const optionValidators = Object.fromEntries(
    optionEntries.map(([k, v]) => [k, matches.guard<unknown, typeof v>((val): val is typeof v => deepEqual(val, v))])
  )

  const type = shape.type
  const primaryType = Array.isArray(type) ? type[0] : type

  // create resolved action shape
  const resolvedActionShape = Object.assign({}, shape, optionValidators, literalValidators, defaultValidators, {
    type: matches.some(
      matches.literal(primaryType),
      matches.guard<string, any>(function (val): val is any {
        return Array.isArray(val) ? val.includes(primaryType) : val === primaryType
      })
    )
  }) as any
  delete resolvedActionShape.$cache
  delete resolvedActionShape.$topic

  const allValuesNull = Object.fromEntries(Object.entries(resolvedActionShape).map(([k]) => [k, null]))

  const matchesShape = matches.shape(resolvedActionShape) as Validator<unknown, ResolvedAction>

  const actionCreator = (partialAction: PartialAction) => {
    const defaultValues = Object.fromEntries(
      defaultEntries.map(([k, v]) => [
        k,
        partialAction[k] ?? ('defaultValue' in v ? v.defaultValue() : v.parser['defaultValue'])
      ]) as [string, any]
    )
    const action = {
      ...allValuesNull,
      ...Object.fromEntries([...optionEntries, ...literalEntries]),
      ...defaultValues,
      ...partialAction,
      type
    }
    return matchesShape.unsafeCast(action) as ResolvedAction
  }

  actionCreator.actionShape = shape as Omit<typeof shape, keyof ActionOptions>
  actionCreator.resolvedActionShape = resolvedActionShape as ResolvedActionShape<Shape>
  actionCreator.type = shape.type as Shape['type']
  actionCreator.matches = matchesShape
  actionCreator.extend = <ExtendShape extends ActionShape<Action>>(extendShape: ExtendShape & ActionOptions) => {
    return { ...shape, ...extendShape, type: [extendShape.type, ...(Array.isArray(type) ? type : [type])] }
  }
  actionCreator.receive = (
    actionReceptor: (action: ResolvedAction, state: ReturnType<typeof getMutableState>) => void
  ) => {
    const hookableReceptor = createHookableFunction(actionReceptor)
    hookableReceptor['matchesAction'] = matchesShape
    return hookableReceptor as typeof hookableReceptor & ActionReceptor<Shape>
  }

  ActionDefinitions[actionCreator.type as string] = actionCreator
  return actionCreator
}

/**
 * Dispatch actions to the store.
 * @param action
 * @param topics @todo potentially in the future, support dispatching to multiple topics
 * @param store
 */
export const dispatchAction = <A extends Action>(_action: A) => {
  const action = JSON.parse(JSON.stringify(_action))

  const agentId = HyperFlux.store.peerID

  action.$peer = action.$peer ?? agentId
  action.$to = action.$to ?? 'all'
  action.$time = action.$time ?? HyperFlux.store.getDispatchTime() + HyperFlux.store.defaultDispatchDelay()
  action.$cache = action.$cache ?? false
  action.$uuid = action.$uuid ?? uuidv4()
  const topic = (action.$topic = action.$topic ?? HyperFlux.store.defaultTopic)

  if (process.env.APP_ENV === 'development' && !action.$stack) {
    const trace = { stack: '' }
    Error.captureStackTrace?.(trace, dispatchAction) // In firefox captureStackTrace is undefined
    const stack = trace.stack.split('\n')
    stack.shift()
    action.$stack = stack
  }

  HyperFlux.store.actions.incoming.push(action as Required<ResolvedActionType>)

  addOutgoingTopicIfNecessary(topic)
}

export function addOutgoingTopicIfNecessary(topic: Topic) {
  if (!HyperFlux.store.actions.outgoing[topic]) {
    logger.info(`Added topic ${topic}`)
    HyperFlux.store.actions.outgoing[topic] = {
      queue: [],
      history: [],
      forwardedUUIDs: new Set()
    }
  }
}

const _updateCachedActions = (incomingAction: Required<ResolvedActionType>) => {
  if (incomingAction.$cache) {
    const cachedActions = HyperFlux.store.actions.cached
    // see if we must remove any previous actions
    if (typeof incomingAction.$cache === 'boolean') {
      if (incomingAction.$cache) cachedActions.push(incomingAction)
    } else {
      const remove = incomingAction.$cache.removePrevious

      if (remove) {
        for (const a of [...cachedActions]) {
          if (a.$peer === incomingAction.$peer && a.type === incomingAction.type) {
            if (remove === true) {
              const idx = cachedActions.indexOf(a)
              cachedActions.splice(idx, 1)
            } else {
              let matches = true
              for (const key of remove) {
                if (!deepEqual(a[key], incomingAction[key])) {
                  matches = false
                  break
                }
              }
              if (matches) {
                const idx = cachedActions.indexOf(a)
                cachedActions.splice(idx, 1)
              }
            }
          }
        }
      }

      if (!incomingAction.$cache.disable) {
        cachedActions.push(incomingAction)
      }
    }
  }
}

const applyIncomingActionsToAllQueues = (action: Required<ResolvedActionType>) => {
  for (const [queueHandle, queue] of HyperFlux.store.actions.queues) {
    if (queueHandle.test(action)) {
      // if the action is out of order, mark the queue as needing resync
      if (queue.actions.length > 0 && queue.actions.at(-1)!.$time > action.$time) {
        queue.needsResync = true
      }
      queue.actions.push(action)
    }
  }
}

const createEventSourceQueues = (action: Required<ResolvedActionType>) => {
  for (const definition of StateDefinitions.values()) {
    if (!definition.receptors || HyperFlux.store.receptors[definition.name]) continue

    const matchedActions = Object.values(definition.receptors).map(
      (r: ActionReceptor<ResolvedActionType>) => r.matchesAction
    )
    if (!matchedActions.some((m) => m.test(action))) continue

    const receptorActionQueue = defineActionQueue(matchedActions)
    definition.receptorActionQueue = receptorActionQueue

    // set resync to true to ensure the queue exists immediately
    receptorActionQueue.needsResync = true

    if (!HyperFlux.store.stateMap[definition.name]) setInitialState(definition)

    const applyEventSourcing = () => {
      // queue may need to be reset when actions are recieved out of order
      // or when state needs to be rolled back
      if (receptorActionQueue.needsResync) {
        // reset the state to the initial value when the queue is reset
        setInitialState(definition)
        receptorActionQueue.resync()
      }

      let hasNewActions = false

      // apply each action to each matching receptor, in order
      for (const action of receptorActionQueue()) {
        for (const definitionReceptor of Object.values(definition.receptors!)) {
          try {
            const receptor = definitionReceptor as ActionReceptor<ResolvedActionType>
            if (receptor.matchesAction.test(action)) {
              receptor(action, getMutableState(definition))
              hasNewActions = true
            }
          } catch (e) {
            logger.error(e)
          }
        }
      }

      // if new actions were applied, synchronously run the reactor
      if (hasNewActions && HyperFlux.store.stateReactors[definition.name]) {
        HyperFlux.store.stateReactors[definition.name].run()
      }
    }

    HyperFlux.store.receptors[definition.name] = applyEventSourcing
  }
}

const _applyIncomingAction = (action: Required<ResolvedActionType>) => {
  // ensure actions are idempotent
  if (HyperFlux.store.actions.knownUUIDs.has(action.$uuid)) {
    //Certain actions were causing logger.info to throw errors since it JSON.stringifies inputs, and those
    //actions had circular references. Just try/catching the logger.info call was not catching them properly,
    //So the solution was to attempt to JSON.stringify them manually first to see if that would error.
    try {
      const jsonStringified = JSON.stringify(action)
      // logger.info('Repeat action %o', action)
    } catch (err) {
      console.log('error in logging action', action)
    }
    const idx = HyperFlux.store.actions.incoming.indexOf(action)
    HyperFlux.store.actions.incoming.splice(idx, 1)
    return
  }

  _updateCachedActions(action)

  createEventSourceQueues(action)

  applyIncomingActionsToAllQueues(action)

  try {
    //Certain actions were causing logger.info to throw errors since it JSON.stringifies inputs, and those
    //actions had circular references. Just try/catching the logger.info call was not catching them properly,
    //So the solution was to attempt to JSON.stringify them manually first to see if that would error.
    try {
      logger.info(`[Action]: ${action.type} %o`, action)
    } catch (err) {
      console.log('error in logging action', action)
    }
  } catch (e) {
    const message = (e as Error).message
    const stack = (e as Error).stack!.split('\n')
    stack.shift()
    action.$ERROR = { message, stack }
    logger.error(e)
  } finally {
    HyperFlux.store.actions.history.push(action)
    HyperFlux.store.actions.knownUUIDs.add(action.$uuid)
    const idx = HyperFlux.store.actions.incoming.indexOf(action)
    HyperFlux.store.actions.incoming.splice(idx, 1)
  }
}

const _forwardIfNecessary = (action: Required<ResolvedActionType>) => {
  addOutgoingTopicIfNecessary(action.$topic)
  if (HyperFlux.store.peerID === action.$peer || HyperFlux.store.forwardingTopics.has(action.$topic)) {
    const outgoingActions = HyperFlux.store.actions.outgoing[action.$topic]
    if (outgoingActions.forwardedUUIDs.has(action.$uuid)) return
    outgoingActions.queue.push(action)
    outgoingActions.forwardedUUIDs.add(action.$uuid)
  }
}

/** Drain event sourced queues and run receptors */
const applyEventSourcingToAllQueues = () => {
  for (const receptors of Object.values(HyperFlux.store.receptors)) receptors()
}

/**
 * Process incoming actions
 */
export const applyIncomingActions = () => {
  const { incoming } = HyperFlux.store.actions
  const now = HyperFlux.store.getDispatchTime()
  for (const action of [...incoming]) {
    _forwardIfNecessary(action)
    if (action.$time <= now) _applyIncomingAction(action)
  }

  applyEventSourcingToAllQueues()
}

/**
 * Clear the outgoing action queue
 * @param store
 */
export const clearOutgoingActions = (topic: Topic) => {
  if (!HyperFlux.store.actions.outgoing[topic]) return
  const { queue, history, forwardedUUIDs } = HyperFlux.store.actions.outgoing[topic]
  for (const action of queue) {
    history.push(action)
    forwardedUUIDs.add(action.$uuid)
  }
  queue.length = 0
}

export function defineActionQueue<V extends Validator<unknown, ResolvedActionType>>(validator: V[] | V) {
  const shapes = Array.isArray(validator) ? validator : [validator]
  const shapeHash = shapes.map(Parser.parserAsString).join('|')

  const getOrCreateInstance = () => {
    const queueMap = HyperFlux.store.actions.queues
    const reactorRoot = HyperFlux.store.getCurrentReactorRoot()
    let queueInstance = queueMap.get(actionQueueGetter)!

    if (!queueInstance) {
      queueInstance = {
        actions: [],
        nextIndex: 0,
        needsResync: false,
        reactorRoot
      }
      queueMap.set(actionQueueGetter, queueInstance)
      reactorRoot?.cleanupFunctions.add(() => {
        removeActionQueue(actionQueueGetter)
      })
    }
    /** @todo sometimes there is no reactor root, which throws this unnecessarily */
    //  else if (queueInstance.reactorRoot !== reactorRoot) {
    //   throw new Error('Action queue is being used by multiple reactors')
    // }

    return queueInstance
  }

  const actionQueueGetter = (): V['_TYPE'][] => {
    const queueInstance = getOrCreateInstance()
    const result = queueInstance.actions.slice(queueInstance.nextIndex) as V['_TYPE'][]
    queueInstance.nextIndex = queueInstance.actions.length
    return result
  }

  actionQueueGetter.test = (a: Action) => {
    return shapes.some((s) => s.test(a))
  }

  actionQueueGetter.shapeHash = shapeHash

  actionQueueGetter.instance = null! as ActionQueueInstance
  Object.defineProperty(actionQueueGetter, 'instance', {
    get: () => getOrCreateInstance()
  })

  actionQueueGetter.needsResync = false
  Object.defineProperty(actionQueueGetter, 'needsResync', {
    get: () => getOrCreateInstance().needsResync,
    set: (val) => {
      getOrCreateInstance().needsResync = val
    }
  })

  actionQueueGetter.resync = () => {
    // make sure actions are sorted by time, earliest first
    const queue = getOrCreateInstance()
    queue.actions = HyperFlux.store.actions.history.filter(actionQueueGetter.test).sort((a, b) => a.$time - b.$time)
    queue.nextIndex = 0
    actionQueueGetter.needsResync = false
  }

  return actionQueueGetter
}

/**
 * @deprecated use defineActionQueue instead
 */
export const createActionQueue = defineActionQueue

export type ActionQueueHandle = ReturnType<typeof defineActionQueue>
export type ActionQueueInstance = {
  actions: Required<ResolvedActionType>[]
  nextIndex: number
  needsResync: boolean
  reactorRoot: ReactorRoot | undefined
}

export const removeActionQueue = (queueHandle: ActionQueueHandle) => {
  HyperFlux.store.actions.queues.delete(queueHandle)
}

export type MatchesWithDefault<A> = { matches: Validator<unknown, A>; defaultValue: () => A }

export type ActionCreator<A extends ActionShape<Action>> = {
  (partialAction?: PartialActionType<A>): Required<ActionTypeFromShape<ResolvedActionShape<A>> & ActionOptions>
  actionShape: A
  resolvedActionShape: ResolvedActionShape<A>
  type: A['type']
  matches: Validator<unknown, ResolvedActionType<A>>
}

export const matchesWithDefault = <A>(matches: Validator<unknown, A>, defaultValue: () => A): MatchesWithDefault<A> => {
  return { matches, defaultValue }
}
