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

import { VisualScriptComponent } from '@etherealengine/engine'
import { PositionalAudioComponent } from '@etherealengine/engine/src/audio/components/PositionalAudioComponent'
import { LoopAnimationComponent } from '@etherealengine/engine/src/avatar/components/LoopAnimationComponent'
import { GrabbableComponent } from '@etherealengine/engine/src/interaction/components/GrabbableComponent'
import { InteractableComponent } from '@etherealengine/engine/src/interaction/components/InteractableComponent'
import { AudioAnalysisComponent } from '@etherealengine/engine/src/scene/components/AudioAnalysisComponent'
import { CameraSettingsComponent } from '@etherealengine/engine/src/scene/components/CameraSettingsComponent'
import { EnvMapBakeComponent } from '@etherealengine/engine/src/scene/components/EnvMapBakeComponent'
import { EnvmapComponent } from '@etherealengine/engine/src/scene/components/EnvmapComponent'
import { GroundPlaneComponent } from '@etherealengine/engine/src/scene/components/GroundPlaneComponent'
import { ImageComponent } from '@etherealengine/engine/src/scene/components/ImageComponent'
import { InstancingComponent } from '@etherealengine/engine/src/scene/components/InstancingComponent'
import { LinkComponent } from '@etherealengine/engine/src/scene/components/LinkComponent'
import { MediaComponent } from '@etherealengine/engine/src/scene/components/MediaComponent'
import { MediaSettingsComponent } from '@etherealengine/engine/src/scene/components/MediaSettingsComponent'
import { ModelComponent } from '@etherealengine/engine/src/scene/components/ModelComponent'
import { MountPointComponent } from '@etherealengine/engine/src/scene/components/MountPointComponent'
import { NewVolumetricComponent } from '@etherealengine/engine/src/scene/components/NewVolumetricComponent'
import { ParticleSystemComponent } from '@etherealengine/engine/src/scene/components/ParticleSystemComponent'
import { PlaylistComponent } from '@etherealengine/engine/src/scene/components/PlaylistComponent'
import { PortalComponent } from '@etherealengine/engine/src/scene/components/PortalComponent'
import { PrimitiveGeometryComponent } from '@etherealengine/engine/src/scene/components/PrimitiveGeometryComponent'
import { ReflectionProbeComponent } from '@etherealengine/engine/src/scene/components/ReflectionProbeComponent'
import { RenderSettingsComponent } from '@etherealengine/engine/src/scene/components/RenderSettingsComponent'
import { SDFComponent } from '@etherealengine/engine/src/scene/components/SDFComponent'
import { ScenePreviewCameraComponent } from '@etherealengine/engine/src/scene/components/ScenePreviewCamera'
import { SceneSettingsComponent } from '@etherealengine/engine/src/scene/components/SceneSettingsComponent'
import { ScreenshareTargetComponent } from '@etherealengine/engine/src/scene/components/ScreenshareTargetComponent'
import { ShadowComponent } from '@etherealengine/engine/src/scene/components/ShadowComponent'
import { SkyboxComponent } from '@etherealengine/engine/src/scene/components/SkyboxComponent'
import { SpawnPointComponent } from '@etherealengine/engine/src/scene/components/SpawnPointComponent'
import { SplineComponent } from '@etherealengine/engine/src/scene/components/SplineComponent'
import { SplineTrackComponent } from '@etherealengine/engine/src/scene/components/SplineTrackComponent'
import { TextComponent } from '@etherealengine/engine/src/scene/components/TextComponent'
import { VariantComponent } from '@etherealengine/engine/src/scene/components/VariantComponent'
import { VideoComponent } from '@etherealengine/engine/src/scene/components/VideoComponent'
import { VolumetricComponent } from '@etherealengine/engine/src/scene/components/VolumetricComponent'
import { defineState } from '@etherealengine/hyperflux'
import {
  AmbientLightComponent,
  DirectionalLightComponent,
  HemisphereLightComponent,
  PointLightComponent,
  SpotLightComponent
} from '@etherealengine/spatial'
import { InputComponent } from '@etherealengine/spatial/src/input/components/InputComponent'
import { ColliderComponent } from '@etherealengine/spatial/src/physics/components/ColliderComponent'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'
import { TriggerComponent } from '@etherealengine/spatial/src/physics/components/TriggerComponent'
import { FogSettingsComponent } from '@etherealengine/spatial/src/renderer/components/FogSettingsComponent'
import { MeshComponent } from '@etherealengine/spatial/src/renderer/components/MeshComponent'
import { PostProcessingComponent } from '@etherealengine/spatial/src/renderer/components/PostProcessingComponent'
import { LookAtComponent } from '@etherealengine/spatial/src/transform/components/LookAtComponent'
import { PersistentAnchorComponent } from '@etherealengine/spatial/src/xr/XRAnchorComponents'

// everything above still needs to be built
import PersistentAnchorNodeEditor from '@etherealengine/ui/src/components/editor/properties/anchor'
import LoopAnimationNodeEditor from '@etherealengine/ui/src/components/editor/properties/animation'
import AudioAnalysisEditor from '@etherealengine/ui/src/components/editor/properties/audio/analysis'
import PositionalAudioNodeEditor from '@etherealengine/ui/src/components/editor/properties/audio/positional'
import CameraPropertiesNodeEditor from '@etherealengine/ui/src/components/editor/properties/camera'
import ColliderComponentEditor from '@etherealengine/ui/src/components/editor/properties/collider'
import EnvMapBakeNodeEditor from '@etherealengine/ui/src/components/editor/properties/envMapBake'
import EnvMapEditor from '@etherealengine/ui/src/components/editor/properties/envmap'
import FogSettingsEditor from '@etherealengine/ui/src/components/editor/properties/fog'
import PrimitiveGeometryNodeEditor from '@etherealengine/ui/src/components/editor/properties/geometry/primitive'
import GrabbableComponentNodeEditor from '@etherealengine/ui/src/components/editor/properties/grab'
import GroundPlaneNodeEditor from '@etherealengine/ui/src/components/editor/properties/groundPlane'
import ImageNodeEditor from '@etherealengine/ui/src/components/editor/properties/image'
import InstancingNodeEditor from '@etherealengine/ui/src/components/editor/properties/instance'
import InteractableComponentNodeEditor from '@etherealengine/ui/src/components/editor/properties/interact'
import AmbientLightNodeEditor from '@etherealengine/ui/src/components/editor/properties/light/ambient'
import DirectionalLightNodeEditor from '@etherealengine/ui/src/components/editor/properties/light/directional'
import HemisphereLightNodeEditor from '@etherealengine/ui/src/components/editor/properties/light/hemisphere'
import PointLightNodeEditor from '@etherealengine/ui/src/components/editor/properties/light/point'
import SpotLightNodeEditor from '@etherealengine/ui/src/components/editor/properties/light/spot'
import LinkNodeEditor from '@etherealengine/ui/src/components/editor/properties/link'
import LookAtNodeEditor from '@etherealengine/ui/src/components/editor/properties/lookAt'
import MediaNodeEditor from '@etherealengine/ui/src/components/editor/properties/media'
import MediaSettingsEditor from '@etherealengine/ui/src/components/editor/properties/media/settings'
import MeshNodeEditor from '@etherealengine/ui/src/components/editor/properties/mesh'
import ModelNodeEditor from '@etherealengine/ui/src/components/editor/properties/model'
import MountPointNodeEditor from '@etherealengine/ui/src/components/editor/properties/mountPoint'
import ParticleSystemNodeEditor from '@etherealengine/ui/src/components/editor/properties/particle'
import PortalNodeEditor from '@etherealengine/ui/src/components/editor/properties/portal'
import PostProcessingSettingsEditor from '@etherealengine/ui/src/components/editor/properties/postProcessing'
import ReflectionProbeNodeEditor from '@etherealengine/ui/src/components/editor/properties/reflectionProbe'
import RenderSettingsEditor from '@etherealengine/ui/src/components/editor/properties/render'
import RigidBodyComponentEditor from '@etherealengine/ui/src/components/editor/properties/rigidBody'
import ScenePreviewCameraNodeEditor from '@etherealengine/ui/src/components/editor/properties/scene/previewCamera'
import SceneSettingsEditor from '@etherealengine/ui/src/components/editor/properties/scene/settings'
import SceneDynamicLoadTagEditor from '@etherealengine/ui/src/components/editor/properties/sceneDynamicLoadTag'
import ScreenshareTargetNodeEditor from '@etherealengine/ui/src/components/editor/properties/screenShareTarget'
import SDFEditor from '@etherealengine/ui/src/components/editor/properties/sdf'
import ShadowNodeEditor from '@etherealengine/ui/src/components/editor/properties/shadow'
import SkyboxNodeEditor from '@etherealengine/ui/src/components/editor/properties/skybox'
import SpawnPointNodeEditor from '@etherealengine/ui/src/components/editor/properties/spawnPoint'
import SplineNodeEditor from '@etherealengine/ui/src/components/editor/properties/spline'

import { SceneDynamicLoadTagComponent } from '@etherealengine/engine/src/scene/components/SceneDynamicLoadTagComponent'
import InputComponentNodeEditor from '@etherealengine/ui/src/components/editor/properties/input'
import PlaylistNodeEditor from '@etherealengine/ui/src/components/editor/properties/playlist'
import SplineTrackNodeEditor from '@etherealengine/ui/src/components/editor/properties/spline/track'
import TextNodeEditor from '@etherealengine/ui/src/components/editor/properties/text'
import TriggerComponentEditor from '@etherealengine/ui/src/components/editor/properties/trigger'
import VariantNodeEditor from '@etherealengine/ui/src/components/editor/properties/variant'
import VideoNodeEditor from '@etherealengine/ui/src/components/editor/properties/video'
import VisualScriptNodeEditor from '@etherealengine/ui/src/components/editor/properties/visualScript'
import VolumetricNodeEditor from '@etherealengine/ui/src/components/editor/properties/volumetric'
import NewVolumetricNodeEditor from '@etherealengine/ui/src/components/editor/properties/volumetric/new'
import { EditorComponentType } from '../components/properties/Util'

export const ComponentEditorsState = defineState({
  name: 'ee.editor.ComponentEditorsState',
  initial: () => {
    return {
      [SceneSettingsComponent.name]: SceneSettingsEditor,
      [PostProcessingComponent.name]: PostProcessingSettingsEditor,
      [MediaSettingsComponent.name]: MediaSettingsEditor,
      [RenderSettingsComponent.name]: RenderSettingsEditor,
      [FogSettingsComponent.name]: FogSettingsEditor,
      [CameraSettingsComponent.name]: CameraPropertiesNodeEditor,
      [DirectionalLightComponent.name]: DirectionalLightNodeEditor,
      [HemisphereLightComponent.name]: HemisphereLightNodeEditor,
      [AmbientLightComponent.name]: AmbientLightNodeEditor,
      [PointLightComponent.name]: PointLightNodeEditor,
      [SpotLightComponent.name]: SpotLightNodeEditor,
      [SDFComponent.name]: SDFEditor,
      [GroundPlaneComponent.name]: GroundPlaneNodeEditor,
      [MeshComponent.name]: MeshNodeEditor,
      [ModelComponent.name]: ModelNodeEditor,
      [ShadowComponent.name]: ShadowNodeEditor,
      [LoopAnimationComponent.name]: LoopAnimationNodeEditor,
      [ParticleSystemComponent.name]: ParticleSystemNodeEditor,
      [PrimitiveGeometryComponent.name]: PrimitiveGeometryNodeEditor,
      [PortalComponent.name]: PortalNodeEditor,
      [MountPointComponent.name]: MountPointNodeEditor,
      [RigidBodyComponent.name]: RigidBodyComponentEditor,
      [ColliderComponent.name]: ColliderComponentEditor,
      [TriggerComponent.name]: TriggerComponentEditor,
      [ScenePreviewCameraComponent.name]: ScenePreviewCameraNodeEditor,
      [SkyboxComponent.name]: SkyboxNodeEditor,
      [SpawnPointComponent.name]: SpawnPointNodeEditor,
      [MediaComponent.name]: MediaNodeEditor,
      [ImageComponent.name]: ImageNodeEditor,
      [PositionalAudioComponent.name]: PositionalAudioNodeEditor,
      [AudioAnalysisComponent.name]: AudioAnalysisEditor,
      [VideoComponent.name]: VideoNodeEditor,
      [VolumetricComponent.name]: VolumetricNodeEditor,
      [NewVolumetricComponent.name]: NewVolumetricNodeEditor,
      [PlaylistComponent.name]: PlaylistNodeEditor,
      [EnvmapComponent.name]: EnvMapEditor,
      [EnvMapBakeComponent.name]: EnvMapBakeNodeEditor,
      [InstancingComponent.name]: InstancingNodeEditor,
      [PersistentAnchorComponent.name]: PersistentAnchorNodeEditor,
      [VariantComponent.name]: VariantNodeEditor,
      [SplineComponent.name]: SplineNodeEditor,
      [SplineTrackComponent.name]: SplineTrackNodeEditor,
      [VisualScriptComponent.name]: VisualScriptNodeEditor,
      [LinkComponent.name]: LinkNodeEditor,
      [InteractableComponent.name]: InteractableComponentNodeEditor,
      [InputComponent.name]: InputComponentNodeEditor,
      [GrabbableComponent.name]: GrabbableComponentNodeEditor,
      [ScreenshareTargetComponent.name]: ScreenshareTargetNodeEditor,
      [TextComponent.name]: TextNodeEditor,
      [LookAtComponent.name]: LookAtNodeEditor,
      [ReflectionProbeComponent.name]: ReflectionProbeNodeEditor,
      [SceneDynamicLoadTagComponent.name]: SceneDynamicLoadTagEditor
    } as Record<string, EditorComponentType>
  }
})
