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

import { SxProps, Theme } from '@mui/material/styles'
import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import commonStyles from '@etherealengine/client-core/src/common/components/common.module.scss'
import Text from '@etherealengine/client-core/src/common/components/Text'
import { useRender3DPanelSystem } from '@etherealengine/client-core/src/user/components/Panel3D/useRender3DPanelSystem'
import { createEntity, generateEntityUUID, setComponent, UndefinedEntity, UUIDComponent } from '@etherealengine/ecs'
import { defaultAnimationPath, preloadedAnimations } from '@etherealengine/engine/src/avatar/animation/Util'
import { LoopAnimationComponent } from '@etherealengine/engine/src/avatar/components/LoopAnimationComponent'
import { AssetPreviewCameraComponent } from '@etherealengine/engine/src/camera/components/AssetPreviewCameraComponent'
import { EnvmapComponent } from '@etherealengine/engine/src/scene/components/EnvmapComponent'
import { ModelComponent } from '@etherealengine/engine/src/scene/components/ModelComponent'
import { EnvMapSourceType } from '@etherealengine/engine/src/scene/constants/EnvMapEnum'
import { AmbientLightComponent, TransformComponent } from '@etherealengine/spatial'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import Box from '@etherealengine/ui/src/primitives/mui/Box'
import Icon from '@etherealengine/ui/src/primitives/mui/Icon'
import Tooltip from '@etherealengine/ui/src/primitives/mui/Tooltip'

import styles from './index.module.scss'

interface Props {
  fill?: boolean
  avatarUrl?: string
  sx?: SxProps<Theme>
  onAvatarError?: (error: string) => void
  onAvatarLoaded?: () => void
}

const AvatarPreview = ({ fill, avatarUrl, sx, onAvatarError, onAvatarLoaded }: Props) => {
  const { t } = useTranslation()
  const panelRef = useRef() as React.MutableRefObject<HTMLCanvasElement>
  const renderPanel = useRender3DPanelSystem(panelRef)

  useEffect(() => {
    if (!avatarUrl) return

    const { sceneEntity, cameraEntity } = renderPanel
    const uuid = generateEntityUUID()
    setComponent(sceneEntity, UUIDComponent, uuid)
    setComponent(sceneEntity, NameComponent, '3D Preview Entity')
    setComponent(sceneEntity, LoopAnimationComponent, {
      animationPack: defaultAnimationPath + preloadedAnimations.locomotion + '.glb',
      activeClipIndex: 5
    })
    setComponent(sceneEntity, ModelComponent, { src: avatarUrl, convertToVRM: true })
    setComponent(sceneEntity, EntityTreeComponent, { parentEntity: UndefinedEntity })
    setComponent(sceneEntity, VisibleComponent, true)
    setComponent(sceneEntity, EnvmapComponent, { type: EnvMapSourceType.Skybox })

    setComponent(cameraEntity, AssetPreviewCameraComponent, { targetModelEntity: sceneEntity })

    const lightEntity = createEntity()
    setComponent(lightEntity, AmbientLightComponent)
    setComponent(lightEntity, TransformComponent)
    setComponent(lightEntity, VisibleComponent)
    setComponent(lightEntity, NameComponent, 'Ambient Light')
    setComponent(lightEntity, EntityTreeComponent, { parentEntity: sceneEntity })
  }, [avatarUrl])

  return (
    <Box className={`${commonStyles.preview} ${fill ? styles.fill : ''}`} sx={sx}>
      <div id="stage" className={`${styles.stage} ${fill ? styles.fill : ''}`}>
        <canvas ref={panelRef} style={{ pointerEvents: 'all' }} />
      </div>

      {!avatarUrl && (
        <Text className={commonStyles.previewText} variant="body2">
          {t('admin:components.avatar.avatarPreview')}
        </Text>
      )}

      <Tooltip
        arrow
        title={
          <Box sx={{ width: 100 }}>
            <Text variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {t('user:avatar.rotate')}:
            </Text>
            <Text variant="body2" sx={{ display: 'flex', justifyContent: 'center' }}>
              {t('admin:components.avatar.leftClick')}
              <Icon type="Mouse" fontSize="small" />
            </Text>

            <br />

            <Text variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {t('user:avatar.pan')}:
            </Text>
            <Text variant="body2" sx={{ display: 'flex', justifyContent: 'center' }}>
              {t('admin:components.avatar.rightClick')} <Icon type="Mouse" fontSize="small" />
            </Text>

            <br />

            <Text variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              {t('admin:components.avatar.zoom')}:
            </Text>
            <Text variant="body2" sx={{ display: 'flex', justifyContent: 'center' }}>
              {t('admin:components.avatar.scroll')} <Icon type="Mouse" fontSize="small" />
            </Text>
          </Box>
        }
      >
        <Icon type="Help" sx={{ position: 'absolute', top: 0, right: 0, margin: 1 }} />
      </Tooltip>
    </Box>
  )
}

export default AvatarPreview
