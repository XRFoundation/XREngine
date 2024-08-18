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

import { act, render } from '@testing-library/react'
import React, { useEffect } from 'react'
import { assert, describe, it } from 'vitest'

import { createHyperStore, defineState, getMutableState, NO_PROXY, NO_PROXY_STEALTH, none, useHookstate } from '..'

let testID = 0

describe('hookstate reactivity', () => {
  describe('value mutable state reactivity', () => {
    it('should not re-render a useEffect if value mutable state is set to its current value and proxy is used but .value is not called', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: 0
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        useEffect(() => {
          count++
        }, [state])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set(1)

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })

    it('should not re-render a useEffect if value mutable state is set to its current value and proxy is used, even with .value called', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: 0
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        // reference value
        state.value
        useEffect(() => {
          count++
        }, [state])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set(1)

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })

    it('should not re-render a useEffect if value mutable state is set to its current value and .value is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: 0
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        useEffect(() => {
          count++
        }, [state.value])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set(1)

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })

    it('should not re-render a useEffect if value mutable state is set to its current value and .get(NO_PROXY) is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: 0
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        useEffect(() => {
          count++
        }, [state.get(NO_PROXY)])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set(1)

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })

    it('should not re-render a useEffect if value mutable state is set to its current value or a different value and .get(NO_PROXY_STEALTH) is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: 0
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        useEffect(() => {
          count++
        }, [state.get(NO_PROXY_STEALTH)])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set(1)

      await act(() => rerender(tag))

      assert.equal(count, 1)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 1)

      unmount()
    })
  })

  describe('object mutable state reactivity', () => {
    it('should not re-render a useEffect if object mutable state is set to its current value and proxy is used but .value is not called', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        useEffect(() => {
          count++
        }, [state])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set({})

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 3)

      unmount()
    })

    it('should re-render a useEffect if object mutable state is set to its current value and proxy is used, even with .value called', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        // reference value
        state.value
        useEffect(() => {
          count++
        }, [state])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set({})

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 3)

      unmount()
    })

    it('should re-render a useEffect if object mutable state is set to its current value and .value is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        useEffect(() => {
          count++
        }, [state.value])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set({})

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 3)

      unmount()
    })

    it('should not re-render a useEffect if object mutable state is set to its current value and .get(NO_PROXY) is used, even if .value is used elsewhere', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        // reference value
        state.value
        useEffect(() => {
          count++
        }, [state.get(NO_PROXY)])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set({})

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })

    it('should not re-render a useEffect if object mutable state is set to its current value and .get(NO_PROXY_STEALTH) is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        useEffect(() => {
          count++
        }, [state.get(NO_PROXY_STEALTH)])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set({})

      await act(() => rerender(tag))

      assert.equal(count, 1)

      // update to same value
      getMutableState(TestState).test.set((val) => val)

      await act(() => rerender(tag))

      assert.equal(count, 1)

      unmount()
    })
  })

  describe('nested mutable state reactivity with set', () => {
    it('should re-render a useEffect if nested value mutable state is set to without value changing and proxy is used, even with .value called', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test['test'])
        // reference value
        state.value
        useEffect(() => {
          count++
        }, [state])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // delete parent object
      getMutableState(TestState).test.set(none)

      // update to same value
      getMutableState(TestState).test.set({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 3)

      unmount()
    })

    it('should not re-render a useEffect if nested value mutable state is set to without value changing and value is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test['test'])
        useEffect(() => {
          count++
        }, [state.value])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // delete parent object
      getMutableState(TestState).test.set(none)

      // update to same value
      getMutableState(TestState).test.set({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })

    it('should not re-render a useEffect if nested value mutable state is set to without value changing and .get(NO_PROXY) is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test['test'])
        useEffect(() => {
          count++
        }, [state.get(NO_PROXY)])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // delete parent object
      getMutableState(TestState).test.set(none)

      // update to same value
      getMutableState(TestState).test.set({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })

    it('should not re-render a useEffect if nested value mutable state is set to without value changing and .get(NO_PROXY_STEALTH) is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test['test'])
        useEffect(() => {
          count++
        }, [state.get(NO_PROXY_STEALTH)])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.set({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // delete parent object
      getMutableState(TestState).test.set(none)

      // update to same value
      getMutableState(TestState).test.set({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })
  })

  describe('nested mutable state reactivity with merge', () => {
    it('should re-render a useEffect if nested value mutable state is merged to without value changing and proxy is used, even with .value called', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test['test'])
        // reference value
        state.value
        useEffect(() => {
          count++
        }, [state])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.merge({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // delete parent object
      getMutableState(TestState).test.set(none)

      // update to same value
      getMutableState(TestState).test.merge({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 3)

      unmount()
    })

    it('should not re-render a useEffect if nested value mutable state is merged to without value changing and .value is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test['test'])
        useEffect(() => {
          count++
        }, [state.value])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.merge({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // delete parent object
      getMutableState(TestState).test.set(none)

      // update to same value
      getMutableState(TestState).test.merge({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })

    it('should not re-render a useEffect if nested value mutable state is merged to without value changing and .get(NO_PROXY) is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test['test'])
        useEffect(() => {
          count++
        }, [state.get(NO_PROXY)])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.merge({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // delete parent object
      getMutableState(TestState).test.set(none)

      // update to same value
      getMutableState(TestState).test.merge({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })

    it('should not re-render a useEffect if nested value mutable state is merged to without value changing and .get(NO_PROXY_STEALTH) is used', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {}
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let count = 0

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test['test'])
        useEffect(() => {
          count++
        }, [state.get(NO_PROXY_STEALTH)])
        return null
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // update to new value
      getMutableState(TestState).test.merge({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      // delete parent object
      getMutableState(TestState).test.set(none)

      // update to same value
      getMutableState(TestState).test.merge({ test: 'my value' })

      await act(() => rerender(tag))

      assert.equal(count, 2)

      unmount()
    })
  })
})

describe('hookstate nested reactivity', () => {
  describe('nested reactor mutable state reactivity', () => {
    it('should not re-render a sub reactor if a sibling state changes', async () => {
      const TestState = defineState({
        name: 'test.state.' + testID++,
        initial: () => ({
          test: {} as Record<string, { nestedObject: string }>
        })
      })

      const store = createHyperStore({
        getDispatchTime: () => Date.now()
      })

      let targetKeyCount = 0
      let otherKeyCount = 0

      const targetKey = 'targetKey'
      const otherKey = 'otherKey'

      const SubReactor = function ({ nestedKey }) {
        const state = useHookstate(getMutableState(TestState).test[nestedKey])
        // reference value
        state.value
        useEffect(() => {
          if (nestedKey === targetKey) targetKeyCount++
          if (nestedKey === otherKey) otherKeyCount++
        }, [state])
        return null
      }

      const Reactor = function () {
        const state = useHookstate(getMutableState(TestState).test)
        return (
          <>
            {state.keys.map((key) => (
              <SubReactor nestedKey={key} key={key} />
            ))}
          </>
        )
      }

      const tag = <Reactor />
      const { rerender, unmount } = render(tag)

      await act(() => rerender(tag))

      // add target sub state
      getMutableState(TestState).test[targetKey].set({ nestedObject: 'my value' })

      await act(() => rerender(tag))

      assert.equal(targetKeyCount, 1)

      // add other sub state
      getMutableState(TestState).test[otherKey].set({ nestedObject: 'my value' })

      await act(() => rerender(tag))

      // should not re-render target
      assert.equal(targetKeyCount, 1)

      // should re-render other
      assert.equal(otherKeyCount, 1)

      // update target to new reference
      getMutableState(TestState).test[targetKey].set({ nestedObject: 'my value' })

      await act(() => rerender(tag))

      // should re-render target
      assert.equal(targetKeyCount, 2)

      // should not re-render other
      assert.equal(otherKeyCount, 1)

      unmount()
    })
  })
})
