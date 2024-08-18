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

import { getMutableState, useHookstate } from '@etherealengine/hyperflux'
import { EngineState } from '@etherealengine/spatial/src/EngineState'
import { startPlayMode, tryStopPlayMode } from '@etherealengine/spatial/src/common/functions/PlayModeFunctions'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { HiOutlinePause, HiOutlinePlay } from 'react-icons/hi2'
import Button from '../../../../../primitives/tailwind/Button'
import Tooltip from '../../../../../primitives/tailwind/Tooltip'

const PlayModeTool = () => {
  const { t } = useTranslation()

  const isEditing = useHookstate(getMutableState(EngineState).isEditing)

  const onTogglePlayMode = () => {
    if (!tryStopPlayMode()) {
      startPlayMode()
    }
  }

  return (
    <div id="preview" className="flex items-center">
      <Tooltip
        title={
          isEditing.value ? t('editor:toolbar.command.lbl-playPreview') : t('editor:toolbar.command.lbl-stopPreview')
        }
        content={
          isEditing.value ? t('editor:toolbar.command.info-playPreview') : t('editor:toolbar.command.info-stopPreview')
        }
      >
        <Button
          variant="transparent"
          startIcon={
            isEditing.value ? (
              <HiOutlinePlay className="text-theme-input" />
            ) : (
              <HiOutlinePause className="text-theme-input" />
            )
          }
          className="p-0"
          onClick={onTogglePlayMode}
        />
      </Tooltip>
    </div>
  )
}

export default PlayModeTool
