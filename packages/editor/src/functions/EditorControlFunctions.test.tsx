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

import { GLTF } from '@gltf-transform/core'
import assert from 'assert'
import { Cache, Color, MathUtils } from 'three'

import { UserID } from '@etherealengine/common/src/schema.type.module'
import { createEntity, getComponent, setComponent, UUIDComponent } from '@etherealengine/ecs'
import { createEngine, destroyEngine, Engine } from '@etherealengine/ecs/src/Engine'
import { Entity, EntityUUID } from '@etherealengine/ecs/src/Entity'
import { GLTFSnapshotState, GLTFSourceState } from '@etherealengine/engine/src/gltf/GLTFState'
import { SourceComponent } from '@etherealengine/engine/src/scene/components/SourceComponent'
import { SplineComponent } from '@etherealengine/engine/src/scene/components/SplineComponent'
import { applyIncomingActions, getMutableState, getState } from '@etherealengine/hyperflux'
import { HemisphereLightComponent, TransformComponent } from '@etherealengine/spatial'
import { EngineState } from '@etherealengine/spatial/src/EngineState'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'

import { Physics } from '@etherealengine/spatial/src/physics/classes/Physics'
import { SceneComponent } from '@etherealengine/spatial/src/renderer/components/SceneComponents'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { EditorState } from '../services/EditorServices'
import { EditorControlFunctions } from './EditorControlFunctions'

describe('EditorControlFunctions', () => {
  let physicsWorldEntity: Entity

  beforeEach(async () => {
    createEngine()
    getMutableState(EngineState).isEditing.set(true)
    getMutableState(EngineState).isEditor.set(true)
    Engine.instance.store.userID = 'user' as UserID

    await Physics.load()
    physicsWorldEntity = createEntity()
    setComponent(physicsWorldEntity, UUIDComponent, UUIDComponent.generateUUID())
    setComponent(physicsWorldEntity, SceneComponent)
    setComponent(physicsWorldEntity, TransformComponent)
    setComponent(physicsWorldEntity, EntityTreeComponent)
    const physicsWorld = Physics.createWorld(getComponent(physicsWorldEntity, UUIDComponent))
    physicsWorld.timestep = 1 / 60
  })

  afterEach(() => {
    return destroyEngine()
  })

  describe('addOrRemoveComponent', () => {
    it('should add and remove component from root child', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.addOrRemoveComponent([nodeEntity], VisibleComponent, true)

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert(newSnapshot.nodes![0].extensions![VisibleComponent.jsonID])

      EditorControlFunctions.addOrRemoveComponent([nodeEntity], VisibleComponent, false)

      applyIncomingActions()

      const newSnapshot2 = getState(GLTFSnapshotState)[sourceID].snapshots[2]
      assert(!newSnapshot2.nodes![0].extensions![VisibleComponent.jsonID])
    })

    it('should add and remove component from root child', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID
      const childUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            children: [1],
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          },
          {
            name: 'child',
            extensions: {
              [UUIDComponent.jsonID]: childUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const childEntity = UUIDComponent.getEntityByUUID(childUUID)
      const sourceID = getComponent(childEntity, SourceComponent)

      EditorControlFunctions.addOrRemoveComponent([childEntity], VisibleComponent, true)

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert(newSnapshot.nodes![1].extensions![VisibleComponent.jsonID])

      EditorControlFunctions.addOrRemoveComponent([childEntity], VisibleComponent, false)

      applyIncomingActions()

      const newSnapshot2 = getState(GLTFSnapshotState)[sourceID].snapshots[2]
      assert(!newSnapshot2.nodes![1].extensions![VisibleComponent.jsonID])
    })
  })

  describe('modifyName', () => {
    it('should modify the name of a node', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.modifyName([nodeEntity], 'newName')

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert(newSnapshot.nodes![0].name === 'newName')
    })
  })

  describe('modifyProperty', () => {
    it('should modify the property of a node', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID,
              [HemisphereLightComponent.jsonID!]: {
                skyColor: new Color('green').getHex(),
                groundColor: new Color('purple').getHex(),
                intensity: 0.5
              }
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.modifyProperty([nodeEntity], HemisphereLightComponent, {
        skyColor: new Color('blue').getHex() as any,
        groundColor: new Color('red').getHex() as any,
        intensity: 0.7
      })

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      const extensionData = newSnapshot.nodes![0].extensions![HemisphereLightComponent.jsonID!] as any
      assert.equal(extensionData.skyColor, new Color('blue').getHex() as any)
    })
    it('should modify a nested property of a node', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID,
              [SplineComponent.jsonID!]: {
                elements: [
                  {
                    position: {
                      x: 0,
                      y: 0,
                      z: 0
                    }
                  },
                  {
                    position: {
                      x: 5,
                      y: 5,
                      z: 5
                    }
                  }
                ]
              }
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.modifyProperty([nodeEntity], SplineComponent, {
        [`elements.${1}.position` as string]: {
          x: 10,
          y: 10,
          z: 10
        }
      })

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      const extensionData = newSnapshot.nodes![0].extensions![SplineComponent.jsonID!] as any
      assert.equal(extensionData.elements[1].position.x, 10)
      assert.equal(extensionData.elements[1].position.y, 10)
      assert.equal(extensionData.elements[1].position.z, 10)
    })
  })

  describe('createObjectFromSceneElement', () => {
    it('should create a new object from a scene element to root', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.createObjectFromSceneElement([
        {
          name: HemisphereLightComponent.jsonID,
          props: {
            skyColor: new Color('blue').getHex(),
            groundColor: new Color('red').getHex(),
            intensity: 0.7
          }
        }
      ])

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert(newSnapshot.nodes![1])
      assert.equal(newSnapshot.nodes![1].name, 'New Object')
      assert(!newSnapshot.nodes![0].children)
      assert.equal(newSnapshot.scenes![0].nodes![0], 0)
      assert.equal(newSnapshot.scenes![0].nodes![1], 1)

      const extensionData = newSnapshot.nodes![1].extensions![HemisphereLightComponent.jsonID!] as any
      assert.equal(extensionData.skyColor, new Color('blue').getHex() as any)
      assert.equal(extensionData.groundColor, new Color('red').getHex() as any)
      assert.equal(extensionData.intensity, 0.7)
    })

    it('should create a new object from a scene element as child of node', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.createObjectFromSceneElement(
        [
          {
            name: HemisphereLightComponent.jsonID,
            props: {
              skyColor: new Color('blue').getHex(),
              groundColor: new Color('red').getHex(),
              intensity: 0.7
            }
          }
        ],
        nodeEntity
      )

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert(newSnapshot.nodes![1])
      assert.equal(newSnapshot.nodes![1].name, 'New Object')
      assert(newSnapshot.nodes![0].children![0] === 1)

      const extensionData = newSnapshot.nodes![1].extensions![HemisphereLightComponent.jsonID!] as any
      assert.equal(extensionData.skyColor, new Color('blue').getHex() as any)
      assert.equal(extensionData.groundColor, new Color('red').getHex() as any)
      assert.equal(extensionData.intensity, 0.7)
    })

    it('should create a new object from a scene element before node', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.createObjectFromSceneElement(
        [
          {
            name: HemisphereLightComponent.jsonID,
            props: {
              skyColor: new Color('blue').getHex(),
              groundColor: new Color('red').getHex(),
              intensity: 0.7
            }
          }
        ],
        rootEntity,
        nodeEntity
      )

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert(newSnapshot.nodes![1])
      assert.equal(newSnapshot.nodes![1].name, 'New Object')
      assert.equal(newSnapshot.scenes![0].nodes![1], 0)
      assert.equal(newSnapshot.scenes![0].nodes![0], 1)

      const extensionData = newSnapshot.nodes![1].extensions![HemisphereLightComponent.jsonID!] as any
      assert.equal(extensionData.skyColor, new Color('blue').getHex() as any)
      assert.equal(extensionData.groundColor, new Color('red').getHex() as any)
      assert.equal(extensionData.intensity, 0.7)
    })

    it('should create a new object from a scene element before child node', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID
      const childUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            children: [1],
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          },
          {
            name: 'child',
            extensions: {
              [UUIDComponent.jsonID]: childUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const childEntity = UUIDComponent.getEntityByUUID(childUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.createObjectFromSceneElement(
        [
          {
            name: HemisphereLightComponent.jsonID,
            props: {
              skyColor: new Color('blue').getHex(),
              groundColor: new Color('red').getHex(),
              intensity: 0.7
            }
          }
        ],
        nodeEntity,
        childEntity
      )

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert(newSnapshot.nodes![2])
      assert.equal(newSnapshot.nodes![2].name, 'New Object')
      assert.equal(newSnapshot.nodes![0].children![0], 2)
      assert.equal(newSnapshot.nodes![0].children![1], 1)

      const extensionData = newSnapshot.nodes![2].extensions![HemisphereLightComponent.jsonID!] as any
      assert.equal(extensionData.skyColor, new Color('blue').getHex() as any)
      assert.equal(extensionData.groundColor, new Color('red').getHex() as any)
      assert.equal(extensionData.intensity, 0.7)
    })
  })

  describe('duplicateObject', () => {
    it('should duplicate an object to root', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID,
              [HemisphereLightComponent.jsonID!]: {
                skyColor: new Color('green').getHex(),
                groundColor: new Color('purple').getHex(),
                intensity: 0.5
              }
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.duplicateObject([nodeEntity])

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert(newSnapshot.nodes![1])
      assert.equal(newSnapshot.nodes![1].name, 'node')
      assert.equal(newSnapshot.scenes![0].nodes![0], 0)
      assert.equal(newSnapshot.scenes![0].nodes![1], 1)
      const newNode = newSnapshot.nodes![1]
      const extensionData = newNode.extensions![HemisphereLightComponent.jsonID!] as any
      assert.equal(extensionData.skyColor, new Color('green').getHex() as any)
      assert.equal(extensionData.groundColor, new Color('purple').getHex() as any)
      assert.equal(extensionData.intensity, 0.5)
    })
  })

  describe('reparentObject', () => {
    it('should reparent a child node to root', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID
      const childUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            children: [1],
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          },
          {
            name: 'child',
            extensions: {
              [UUIDComponent.jsonID]: childUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const childEntity = UUIDComponent.getEntityByUUID(childUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.reparentObject([childEntity], null, rootEntity)

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert.equal(newSnapshot.scenes![0].nodes![0], 0)
      assert.equal(newSnapshot.scenes![0].nodes![1], 1)
      assert(!newSnapshot.nodes![0].children)
    })

    it('should reparent an object to another object', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID
      const node2UUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0, 1] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          },
          {
            name: 'node2',
            extensions: {
              [UUIDComponent.jsonID]: node2UUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const node2Entity = UUIDComponent.getEntityByUUID(node2UUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.reparentObject([node2Entity], null, nodeEntity)

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert.equal(newSnapshot.scenes![0].nodes![0], 0)
      assert.equal(newSnapshot.scenes![0].nodes.length, 1)
      assert.equal(newSnapshot.nodes![0].children![0], 1)
    })

    it('should reparent a child node to root before another node', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID
      const childUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            children: [1],
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          },
          {
            name: 'child',
            extensions: {
              [UUIDComponent.jsonID]: childUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const childEntity = UUIDComponent.getEntityByUUID(childUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.reparentObject([childEntity], nodeEntity, rootEntity)

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert.equal(newSnapshot.scenes![0].nodes![0], 1)
      assert.equal(newSnapshot.scenes![0].nodes![1], 0)
      assert(!newSnapshot.nodes![0].children)
    })

    it('should reparent an object to another object before other object', () => {
      const nodeUUID = MathUtils.generateUUID() as EntityUUID
      const node2UUID = MathUtils.generateUUID() as EntityUUID
      const childUUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0, 1] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            children: [2],
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          },
          {
            name: 'node2',
            extensions: {
              [UUIDComponent.jsonID]: node2UUID
            }
          },
          {
            name: 'child',
            extensions: {
              [UUIDComponent.jsonID]: childUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const node2Entity = UUIDComponent.getEntityByUUID(node2UUID)
      const childEntity = UUIDComponent.getEntityByUUID(childUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.reparentObject([node2Entity], childEntity, nodeEntity)

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert.equal(newSnapshot.scenes![0].nodes![0], 0)
      assert.equal(newSnapshot.scenes![0].nodes.length, 1)
      assert.equal(newSnapshot.nodes![0].children![0], 1)
      assert.equal(newSnapshot.nodes![0].children![1], 2)
    })

    it('should reparent inside root node', () => {
      const node1UUID = MathUtils.generateUUID() as EntityUUID
      const node2UUID = MathUtils.generateUUID() as EntityUUID
      const node3UUID = MathUtils.generateUUID() as EntityUUID
      const node4UUID = MathUtils.generateUUID() as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0, 1, 2, 3] }],
        scene: 0,
        nodes: [
          {
            name: 'node1',
            extensions: {
              [UUIDComponent.jsonID]: node1UUID
            }
          },
          {
            name: 'node2',
            extensions: {
              [UUIDComponent.jsonID]: node2UUID
            }
          },
          {
            name: 'node3',
            extensions: {
              [UUIDComponent.jsonID]: node3UUID
            }
          },
          {
            name: 'node4',
            extensions: {
              [UUIDComponent.jsonID]: node4UUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const node2Entity = UUIDComponent.getEntityByUUID(node2UUID)
      const node4Entity = UUIDComponent.getEntityByUUID(node4UUID)

      const sourceID = getComponent(rootEntity, SourceComponent)

      const currentSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[0]
      assert.equal(currentSnapshot.nodes?.length, 4)
      assert.equal(currentSnapshot.nodes?.[3].name, gltf.nodes![3].name)

      const targetNodeIndex = currentSnapshot.nodes!.findIndex(
        (n) => n.extensions?.[UUIDComponent.jsonID] === getComponent(node4Entity, UUIDComponent)
      )
      const targetNodeName = currentSnapshot.nodes![targetNodeIndex].name
      const beforeNodeIndex = currentSnapshot.nodes!.findIndex(
        (n) => n.extensions?.[UUIDComponent.jsonID] === getComponent(node2Entity, UUIDComponent)
      )

      EditorControlFunctions.reparentObject([node4Entity], node2Entity, rootEntity)
      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert.equal(newSnapshot.nodes?.length, 4)
      assert.equal(newSnapshot.nodes?.[beforeNodeIndex].name, targetNodeName)
    })
  })

  describe('groupObjects', () => {
    it('should group objects without affecting existing hierarchy relationships', () => {
      const nodeUUID = 'nodeUUID' as EntityUUID
      const node2UUID = 'node2UUID' as EntityUUID
      const childUUID = 'childUUID' as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0, 1] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            children: [2],
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          },
          {
            name: 'node2',
            extensions: {
              [UUIDComponent.jsonID]: node2UUID
            }
          },
          {
            name: 'child',
            extensions: {
              [UUIDComponent.jsonID]: childUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const node2Entity = UUIDComponent.getEntityByUUID(node2UUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.groupObjects([nodeEntity, node2Entity])

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert.equal(newSnapshot.scenes![0].nodes![0], 3)
      assert.equal(newSnapshot.scenes![0].nodes.length, 1)
      assert.equal(newSnapshot.nodes![3].name, 'New Group')
      assert(newSnapshot.nodes![3].extensions![UUIDComponent.jsonID])
      assert(newSnapshot.nodes![3].extensions![TransformComponent.jsonID])
      assert(newSnapshot.nodes![3].extensions![VisibleComponent.jsonID])
      assert.equal(newSnapshot.nodes![3].children![0], 0)
      assert.equal(newSnapshot.nodes![3].children![1], 1)
    })
  })

  describe('removeObject', () => {
    it('should remove an object and children from the scene', () => {
      const nodeUUID = 'nodeUUID' as EntityUUID
      const node2UUID = 'node2UUID' as EntityUUID
      const node3UUID = 'node3UUID' as EntityUUID
      const childUUID = 'childUUID' as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0, 1, 3] }],
        scene: 0,
        nodes: [
          {
            name: 'node',
            children: [2],
            extensions: {
              [UUIDComponent.jsonID]: nodeUUID
            }
          },
          {
            name: 'node2',
            extensions: {
              [UUIDComponent.jsonID]: node2UUID
            }
          },
          {
            name: 'child',
            extensions: {
              [UUIDComponent.jsonID]: childUUID
            }
          },
          {
            name: 'node3',
            extensions: {
              [UUIDComponent.jsonID]: node3UUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const nodeEntity = UUIDComponent.getEntityByUUID(nodeUUID)
      const sourceID = getComponent(nodeEntity, SourceComponent)

      EditorControlFunctions.removeObject([nodeEntity])

      applyIncomingActions()

      const newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]
      assert.equal(newSnapshot.scenes![0].nodes![0], 0)
      assert.equal(newSnapshot.scenes![0].nodes![1], 1)
      assert.equal(newSnapshot.scenes![0].nodes.length, 2)
      assert.equal(newSnapshot.nodes![0].name, 'node2')
      assert.equal(newSnapshot.nodes![1].name, 'node3')
    })

    it('should correctly update state when removing objects in hierarchy', () => {
      const rootUUID = 'rootUUID' as EntityUUID
      const parentUUID = 'parentUUID' as EntityUUID
      const child1UUID = 'child1UUID' as EntityUUID
      const child2UUID = 'child2UUID' as EntityUUID
      const grandchildUUID = 'grandchildUUID' as EntityUUID

      const gltf: GLTF.IGLTF = {
        asset: {
          version: '2.0'
        },
        scenes: [{ nodes: [0] }],
        scene: 0,
        nodes: [
          {
            name: 'root',
            children: [1],
            extensions: {
              [UUIDComponent.jsonID]: rootUUID
            }
          },
          {
            name: 'parent',
            children: [2, 3],
            extensions: {
              [UUIDComponent.jsonID]: parentUUID
            }
          },
          {
            name: 'child1',
            children: [4],
            extensions: {
              [UUIDComponent.jsonID]: child1UUID
            }
          },
          {
            name: 'child2',
            extensions: {
              [UUIDComponent.jsonID]: child2UUID
            }
          },
          {
            name: 'grandchild',
            extensions: {
              [UUIDComponent.jsonID]: grandchildUUID
            }
          }
        ]
      }

      Cache.add('/test.gltf', gltf)
      const rootEntity = GLTFSourceState.load('/test.gltf', undefined, physicsWorldEntity)
      getMutableState(EditorState).rootEntity.set(rootEntity)
      applyIncomingActions()

      const parentEntity = UUIDComponent.getEntityByUUID(parentUUID)
      const child1Entity = UUIDComponent.getEntityByUUID(child1UUID)
      const sourceID = getComponent(parentEntity, SourceComponent)

      // remove child1 (which also has a grandchild)
      EditorControlFunctions.removeObject([child1Entity])

      applyIncomingActions()

      let newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[1]

      // check that child1 and grandchild are removed, but child2 remains
      assert.equal(newSnapshot.nodes!.length, 3)
      assert.equal(newSnapshot.nodes![0].extensions![UUIDComponent.jsonID], rootUUID)
      assert.equal(newSnapshot.nodes![1].extensions![UUIDComponent.jsonID], parentUUID)
      assert.equal(newSnapshot.nodes![2].extensions![UUIDComponent.jsonID], child2UUID)
      assert.deepEqual(newSnapshot.nodes![1].children, [2])

      // now remove the parent
      EditorControlFunctions.removeObject([parentEntity])

      applyIncomingActions()

      newSnapshot = getState(GLTFSnapshotState)[sourceID].snapshots[2]

      // check that only the root remains
      assert.equal(newSnapshot.nodes!.length, 1)
      assert.equal(newSnapshot.nodes![0].extensions![UUIDComponent.jsonID], rootUUID)
      assert.equal(newSnapshot.nodes![0].children?.length, 0)
      assert.deepEqual(newSnapshot.scenes![0].nodes, [0])
    })
  })
})
