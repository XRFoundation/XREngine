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

import React, { useEffect } from 'react'
import { FullScreen, useFullScreenHandle } from 'react-full-screen'

import { FullscreenContext } from '@etherealengine/client-core/src/components/useFullscreen'
import { iOS } from '@etherealengine/spatial/src/common/functions/isMobile'

type Props = { children: JSX.Element | JSX.Element[] }

export const FullscreenContainer = React.forwardRef((props: Props, ref: any) => {
  const handle = useFullScreenHandle()

  const renderEngineCanvas = () => {
    const canvas = document.getElementById('engine-renderer-canvas')
    if (!canvas) return
    canvas.parentElement?.removeChild(canvas)
    ref.current.appendChild(canvas)
  }

  useEffect(() => {
    renderEngineCanvas()
  }, [])

  const setFullScreen = (value: boolean) => {
    if (value) {
      handle.enter().catch((err) => console.log(err))
      renderEngineCanvas()
    } else {
      handle.exit().catch((err) => console.log(err))
    }
  }

  return iOS ? (
    <div id={'engine-container'} ref={ref}>
      {props.children}
    </div>
  ) : (
    <FullscreenContext.Provider value={[handle.active, setFullScreen]}>
      <FullScreen handle={handle}>
        <div id={'engine-container'} ref={ref}>
          {props.children}
        </div>
      </FullScreen>
    </FullscreenContext.Provider>
  )
})
