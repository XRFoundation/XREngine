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
import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'
import { StaticResourceType } from '@etherealengine/common/src/schema.type.module'
import { timeAgo } from '@etherealengine/common/src/utils/datetime-sql'
import { useClickOutside } from '@etherealengine/common/src/utils/useClickOutside'
import { deleteScene } from '@etherealengine/editor/src/functions/sceneFunctions'
import { EditorState } from '@etherealengine/editor/src/services/EditorServices'
import { useHookstate, useMutableState } from '@etherealengine/hyperflux'
import RenameSceneModal from '@etherealengine/ui/src/components/editor/panels/Scenes/modals/RenameScene'
import ConfirmDialog from '@etherealengine/ui/src/components/tailwind/ConfirmDialog'
import Tooltip from '@etherealengine/ui/src/primitives/mui/Tooltip'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import Text from '@etherealengine/ui/src/primitives/tailwind/Text'
import { default as React, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BsThreeDotsVertical } from 'react-icons/bs'
import { LuTrash } from 'react-icons/lu'
import { MdOutlineEdit } from 'react-icons/md'
import { twMerge } from 'tailwind-merge'

type SceneItemProps = {
  scene: StaticResourceType
  updateEditorState?: boolean
  moveMenuUp?: boolean
  handleOpenScene: () => void
  refetchProjectsData: () => void
}

export const SceneItem = ({
  scene,
  updateEditorState,
  moveMenuUp,
  handleOpenScene,
  refetchProjectsData
}: SceneItemProps) => {
  const { t } = useTranslation()
  const editorState = useMutableState(EditorState)

  const sceneName = scene.key.split('/').pop()!.replace('.gltf', '')

  const deleteSelectedScene = async (scene: StaticResourceType) => {
    if (scene) {
      await deleteScene(scene.key)

      if (updateEditorState) {
        if (editorState.sceneAssetID.value === scene.id) {
          editorState.sceneName.set(null)
          editorState.sceneAssetID.set(null)
        }
      } else {
        refetchProjectsData()
      }
    }
    PopoverState.hidePopupover()
  }

  const showContentMenu = useHookstate(false)
  const menuPosition = useHookstate({ top: 0, left: 0 })

  const threeDotsContainRef = useRef<HTMLDivElement>(null)

  useClickOutside(threeDotsContainRef, () => showContentMenu.set(false))

  useEffect(() => {
    if (!threeDotsContainRef.current) return

    let animationFrameId: number

    const updatePosition = () => {
      if (!threeDotsContainRef.current) return
      const rect = threeDotsContainRef.current.getBoundingClientRect()
      menuPosition.set({ top: rect.bottom, left: rect.left })
      animationFrameId = requestAnimationFrame(updatePosition)
    }

    updatePosition()

    return () => cancelAnimationFrame(animationFrameId)
  }, [threeDotsContainRef])

  return (
    <div className="col-span-2 inline-flex h-64 w-64 min-w-64 max-w-64 cursor-pointer flex-col items-start justify-start gap-3 rounded-lg bg-theme-highlight p-3 lg:col-span-1">
      <img className="shrink grow basis-0 self-stretch rounded" src={scene.thumbnailURL} onClick={handleOpenScene} />
      <div className="inline-flex items-start justify-between self-stretch">
        <div className="inline-flex w-full flex-col items-start justify-start">
          <div className="space-between flex w-full flex-row">
            <Text component="h3" fontWeight="light" className="leading-6 text-neutral-100">
              <Tooltip title={sceneName}>
                <div className="min-w-52 max-w-52 truncate">{sceneName}</div>
              </Tooltip>
            </Text>
          </div>
          <Text component="h3" fontSize="xs" fontWeight="light" className="h-3.5 w-40 leading-5 text-neutral-100">
            {t('editor:hierarchy.lbl-edited')} {t('common:timeAgo', { time: timeAgo(new Date(scene.updatedAt)) })}
          </Text>
        </div>
        <div className="relative h-6 w-6" ref={threeDotsContainRef}>
          <Button
            variant="transparent"
            size="small"
            className="px-2 py-1.5"
            startIcon={<BsThreeDotsVertical className="text-neutral-100" />}
            onClick={() => showContentMenu.set((v) => !v)}
          />
          <ul
            className={twMerge(
              'fixed z-10 block w-max translate-x-5 rounded-lg bg-theme-primary px-4 py-3 pr-10',
              showContentMenu.value ? 'visible' : 'hidden',
              moveMenuUp ? '-translate-y-10' : ''
            )}
            style={{
              top: menuPosition.top.value,
              left: menuPosition.left.value
            }}
          >
            <li className="h-8">
              <Button
                variant="transparent"
                size="medium"
                className="h-full p-0 text-zinc-400 hover:text-[var(--text-primary)]"
                startIcon={<MdOutlineEdit />}
                onClick={() => {
                  showContentMenu.set(false)
                  PopoverState.showPopupover(
                    <RenameSceneModal
                      sceneName={sceneName}
                      scene={scene}
                      updateEditorState={updateEditorState}
                      refetchProjectsData={refetchProjectsData}
                    />
                  )
                }}
              >
                {t('editor:hierarchy.lbl-rename')}
              </Button>
            </li>
            <li className="h-8">
              <Button
                variant="transparent"
                size="medium"
                className="h-full p-0 text-zinc-400 hover:text-[var(--text-primary)]"
                startIcon={<LuTrash />}
                onClick={() => {
                  showContentMenu.set(false)
                  PopoverState.showPopupover(
                    <ConfirmDialog
                      title={t('editor:hierarchy.lbl-deleteScene')}
                      text={t('editor:hierarchy.lbl-deleteSceneDescription', { sceneName })}
                      onSubmit={async () => deleteSelectedScene(scene)}
                    />
                  )
                }}
              >
                {t('editor:hierarchy.lbl-delete')}
              </Button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
