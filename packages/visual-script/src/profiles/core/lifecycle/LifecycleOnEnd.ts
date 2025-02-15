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

import { Assert, makeEventNodeDefinition, NodeCategory } from '../../../VisualScriptModule'
import { ILifecycleEventEmitter } from '../abstractions/ILifecycleEventEmitter'

// inspired by: https://docs.unrealengine.com/4.27/en-US/ProgrammingAndScripting/Blueprints/UserGuide/Events/

type State = {
  onEndEvent?: (() => void) | undefined
}

const makeInitialState = (): State => ({
  onEndEvent: undefined
})

export const LifecycleOnEnd = makeEventNodeDefinition({
  typeName: 'flow/lifecycle/onEnd',
  label: 'On End',
  category: NodeCategory.Flow,
  in: {},
  out: {
    flow: 'flow'
  },
  initialState: makeInitialState(),
  init: ({ state, commit, graph: { getDependency } }) => {
    Assert.mustBeTrue(state.onEndEvent === undefined)
    const onEndEvent = () => {
      commit('flow')
    }

    const lifecycleEventEmitter = getDependency<ILifecycleEventEmitter>('ILifecycleEventEmitter')

    lifecycleEventEmitter?.endEvent.addListener(onEndEvent)

    return {
      onEndEvent
    }
  },
  dispose: ({ state: { onEndEvent }, graph: { getDependency } }) => {
    Assert.mustBeTrue(onEndEvent !== undefined)

    const lifecycleEventEmitter = getDependency<ILifecycleEventEmitter>('ILifecycleEventEmitter')

    if (onEndEvent) lifecycleEventEmitter?.endEvent.removeListener(onEndEvent)

    return {}
  }
})
