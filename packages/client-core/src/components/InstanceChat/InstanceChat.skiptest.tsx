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

import { act } from '@testing-library/react'
import assert from 'assert'
import React from 'react'
import { createRoot } from 'react-dom/client'

import { ChannelID, MessageID, UserID } from '@etherealengine/common/src/schema.type.module'
import { createEngine } from '@etherealengine/ecs'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { getMutableState } from '@etherealengine/hyperflux'

import { InstanceChat } from '.'
import { createDOM } from '../../../tests/createDOM'
import { createMockAPI } from '../../../tests/createMockAPI'
import { ChannelState } from '../../social/services/ChannelService'

describe('Instance Chat Component', () => {
  let rootContainer: HTMLDivElement

  beforeEach(() => {
    createDOM()
    rootContainer = document.createElement('div')
    document.body.appendChild(rootContainer)
    createEngine()
    Engine.instance.api = createMockAPI()
  })

  afterEach(() => {
    document.body.removeChild(rootContainer)
    rootContainer = null!
  })

  it('displays chat message', async () => {
    getMutableState(ChannelState).channels.channels.set([
      {
        id: 'id',
        messages: [
          {
            id: 'message id' as MessageID,
            senderId: 'senderId' as UserID,
            channelId: 'channelId' as ChannelID,
            text: 'message text'
          }
        ]
      } as any
    ])
    act(() => {
      const root = createRoot(rootContainer!)
      root.render(<InstanceChat />)
    })
    const openButton = document.getElementById('openMessagesButton')!
    openButton.addEventListener('click', (e) => console.log(e))
    act(() => {
      openButton.dispatchEvent(new window.CustomEvent('click', { bubbles: true, cancelable: false }))
    })
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const message = rootContainer.querySelector('p')!
    // const message = document.getElementById('message-message id')!
    assert.equal(message.textContent, 'message text')
  })
})
