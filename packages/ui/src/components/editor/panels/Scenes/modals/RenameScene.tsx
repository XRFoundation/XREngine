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

import React from 'react'
import { useTranslation } from 'react-i18next'

import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'

import { StaticResourceType } from '@etherealengine/common/src/schema.type.module'
import isValidSceneName from '@etherealengine/common/src/utils/validateSceneName'
import { renameScene } from '@etherealengine/editor/src/functions/sceneFunctions'
import { EditorState } from '@etherealengine/editor/src/services/EditorServices'
import { getMutableState, useHookstate } from '@etherealengine/hyperflux'
import Input from '../../../../../primitives/tailwind/Input'
import Modal from '../../../../../primitives/tailwind/Modal'

type Props = {
  sceneName: string
  scene: StaticResourceType
  updateEditorState?: boolean
  refetchProjectsData: () => void
}

export default function RenameSceneModal({ sceneName, updateEditorState, scene, refetchProjectsData }: Props) {
  const { t } = useTranslation()
  const newSceneName = useHookstate(sceneName)
  const inputError = useHookstate('')

  const handleSubmit = async () => {
    if (!isValidSceneName(newSceneName.value)) {
      inputError.set(t('editor:errors.invalidSceneName'))
      return
    }
    const currentURL = scene.key
    const newURL = currentURL.replace(currentURL.split('/').pop()!, newSceneName.value + '.gltf')
    const newData = await renameScene(scene, newURL, scene.project!)
    refetchProjectsData()

    if (updateEditorState) {
      getMutableState(EditorState).scenePath.set(newData[0].key)
    }

    PopoverState.hidePopupover()
  }

  return (
    <Modal
      title={t('editor:hierarchy.lbl-renameScene')}
      className="w-[50vw] max-w-2xl"
      onSubmit={handleSubmit}
      onClose={PopoverState.hidePopupover}
      submitButtonDisabled={newSceneName.value === sceneName || inputError.value.length > 0}
    >
      <Input
        value={newSceneName.value}
        onChange={(event) => {
          inputError.set('')
          newSceneName.set(event.target.value)
        }}
        description={t('editor:dialog.saveNewScene.info-name')}
        error={inputError.value}
      />
    </Modal>
  )
}
