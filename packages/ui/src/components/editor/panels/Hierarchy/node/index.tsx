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

import React, { KeyboardEvent, StyleHTMLAttributes, useEffect } from 'react'
import { DropTargetMonitor, useDrag, useDrop } from 'react-dnd'
import { getEmptyImage } from 'react-dnd-html5-backend'

import {
  getAllComponents,
  getComponent,
  getOptionalComponent,
  hasComponent,
  useComponent,
  useOptionalComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity } from '@etherealengine/ecs/src/Entity'
import { entityExists } from '@etherealengine/ecs/src/EntityFunctions'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { EntityTreeComponent, isAncestor } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { PiEyeBold, PiEyeClosedBold } from 'react-icons/pi'

import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md'

import { getMutableState, getState, useHookstate } from '@etherealengine/hyperflux'

import { UUIDComponent } from '@etherealengine/ecs'
import { FileDataType } from '@etherealengine/editor/src/components/assets/FileBrowser/FileDataType'
import useUpload from '@etherealengine/editor/src/components/assets/useUpload'
import { HierarchyTreeNodeType } from '@etherealengine/editor/src/components/hierarchy/HierarchyTreeWalker'
import { ItemTypes, SupportedFileTypes } from '@etherealengine/editor/src/constants/AssetTypes'
import { EditorControlFunctions } from '@etherealengine/editor/src/functions/EditorControlFunctions'
import { addMediaNode } from '@etherealengine/editor/src/functions/addMediaNode'
import { ComponentEditorsState } from '@etherealengine/editor/src/services/ComponentEditors'
import { SelectionState } from '@etherealengine/editor/src/services/SelectionServices'
import { VisibleComponent, setVisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import { twMerge } from 'tailwind-merge'
import TransformPropertyGroup from '../../../properties/transform'
import { DnDFileType } from '../../Files/container'

/**
 * getNodeElId function provides id for node.
 */
export const getNodeElId = (node: HierarchyTreeNodeType) => {
  return 'hierarchy-node-' + node.entity
}

export type RenameNodeData = {
  entity: Entity
  name: string
}

type DragItemType = {
  type: (typeof ItemTypes)[keyof typeof ItemTypes]
  value: Entity | Entity[]
  multiple: boolean
}

export type HierarchyTreeNodeData = {
  nodes: HierarchyTreeNodeType[]
  renamingNode: RenameNodeData
  onToggle: (e: React.MouseEvent, node: Entity) => void
  onKeyDown: (e: Event, node: Entity) => void
  onClick: (e: React.MouseEvent, node: Entity) => void
  onChangeName: (node: Entity, name: string) => void
  onRenameSubmit: (node: Entity, name: string) => void
  onUpload: ReturnType<typeof useUpload>
}

export type HierarchyTreeNodeProps = {
  index: number
  data: HierarchyTreeNodeData
  style: StyleHTMLAttributes<HTMLLIElement>
  onContextMenu: (event: React.MouseEvent<HTMLElement>, item: Entity) => void
}

export const HierarchyTreeNode = (props: HierarchyTreeNodeProps) => {
  const node = props.data.nodes[props.index]
  const entity = node.entity
  const data = props.data
  const fixedSizeListStyles = props.style

  const uuid = useComponent(entity, UUIDComponent)

  const selected = useHookstate(getMutableState(SelectionState).selectedEntities).value.includes(uuid.value)

  const nodeName = useOptionalComponent(entity, NameComponent)?.value

  const visible = useOptionalComponent(entity, VisibleComponent)

  const toggleVisible = () => {
    if (visible) {
      EditorControlFunctions.addOrRemoveComponent([entity], VisibleComponent, false)
    } else {
      EditorControlFunctions.addOrRemoveComponent([entity], VisibleComponent, true)
    }
    setVisibleComponent(entity, !hasComponent(entity, VisibleComponent))
  }

  const onClickToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (data.onToggle) data.onToggle(e, entity)
  }
  const onNodeKeyDown = (e: KeyboardEvent) => {
    if (data.onKeyDown) data.onKeyDown(e as any, entity)
  }
  const onKeyDownNameInput = (e: KeyboardEvent) => {
    if (e.key === 'Escape') data.onRenameSubmit(entity, null!)
    else if (e.key === 'Enter') data.onRenameSubmit(entity, (e.target as any).value)
  }
  const onClickNode = (e: React.MouseEvent) => data.onClick(e, entity)
  const onChangeNodeName = (e: React.ChangeEvent<HTMLInputElement>) => data.onChangeName(entity, e.target.value)

  const [, drag, preview] = useDrag({
    type: ItemTypes.Node,
    item: (): DragItemType => {
      const selectedEntities = SelectionState.getSelectedEntities()

      if (selectedEntities.includes(node.entity)) {
        const multiple = selectedEntities.length > 1
        return {
          type: ItemTypes.Node,
          multiple,
          value: multiple ? selectedEntities : selectedEntities[0]
        }
      }
      return {
        type: ItemTypes.Node,
        multiple: false,
        value: node.entity
      }
    },
    canDrag: () =>
      !SelectionState.getSelectedEntities().some(
        (entity) => !getOptionalComponent(entity, EntityTreeComponent)?.parentEntity
      ),
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  })

  const dropItem = (node: HierarchyTreeNodeType, place: 'On' | 'Before' | 'After') => {
    let parentNode: Entity | undefined
    let beforeNode: Entity

    if (place === 'Before') {
      const entityTreeComponent = getOptionalComponent(node.entity, EntityTreeComponent)
      parentNode = entityTreeComponent?.parentEntity
      beforeNode = node.entity
    } else if (place === 'After') {
      const entityTreeComponent = getOptionalComponent(node.entity, EntityTreeComponent)
      parentNode = entityTreeComponent?.parentEntity
      const parentTreeComponent = getOptionalComponent(entityTreeComponent?.parentEntity!, EntityTreeComponent)
      if (
        parentTreeComponent &&
        !node.lastChild &&
        parentNode &&
        parentTreeComponent?.children.length > node.childIndex + 1
      ) {
        beforeNode = parentTreeComponent.children[node.childIndex + 1]
      }
    } else {
      parentNode = node.entity
    }

    if (!parentNode)
      return () => {
        console.warn('parent is not defined')
      }

    return (item: FileDataType | DnDFileType | DragItemType, monitor: DropTargetMonitor): void => {
      if (parentNode) {
        if ('files' in item) {
          const dndItem: any = monitor.getItem()
          const entries = Array.from(dndItem.items).map((item: any) => item.webkitGetAsEntry())

          //uploading files then adding as media to the editor
          data.onUpload(entries).then((assets) => {
            if (!assets) return
            for (const asset of assets) {
              addMediaNode(asset, parentNode, beforeNode)
            }
          })
          return
        }

        if ('url' in item) {
          addMediaNode(item.url, parentNode, beforeNode)
          return
        }

        if ('type' in item && item.type === ItemTypes.Component) {
          EditorControlFunctions.createObjectFromSceneElement(
            [{ name: (item as any).componentJsonID }],
            parentNode,
            beforeNode
          )
          return
        }
      }

      EditorControlFunctions.reparentObject(
        Array.isArray((item as DragItemType).value)
          ? ((item as DragItemType).value as Entity[])
          : [(item as DragItemType).value as Entity],
        beforeNode,
        parentNode === null ? undefined : parentNode
      )
    }
  }

  const canDropItem = (entityNode: Entity, dropOn?: boolean) => {
    return (item: DragItemType, monitor: DropTargetMonitor): boolean => {
      if (!monitor.isOver()) {
        return false
      }

      if (!dropOn) {
        const entityTreeComponent = getComponent(entityNode, EntityTreeComponent)
        if (!entityTreeComponent) {
          return false
        }
      }
      if (item.type === ItemTypes.Node) {
        const entityTreeComponent = getComponent(entityNode, EntityTreeComponent)

        return (
          (dropOn || !!entityTreeComponent.parentEntity) &&
          !(item.multiple
            ? (item.value as Entity[]).some((otherObject) => isAncestor(otherObject, entityNode))
            : isAncestor(item.value as Entity, entityNode))
        )
      }
      return true
    }
  }

  const [{ canDropBefore, isOverBefore }, beforeDropTarget] = useDrop({
    accept: [ItemTypes.Node, ItemTypes.File, ItemTypes.Component, ...SupportedFileTypes],
    drop: dropItem(node, 'Before'),
    canDrop: canDropItem(node.entity),
    collect: (monitor) => ({
      canDropBefore: monitor.canDrop(),
      isOverBefore: monitor.isOver()
    })
  })

  const [{ canDropAfter, isOverAfter }, afterDropTarget] = useDrop({
    accept: [ItemTypes.Node, ItemTypes.File, ItemTypes.Component, ...SupportedFileTypes],
    drop: dropItem(node, 'After'),
    canDrop: canDropItem(node.entity),
    collect: (monitor) => ({
      canDropAfter: monitor.canDrop(),
      isOverAfter: monitor.isOver()
    })
  })

  const [{ canDropOn, isOverOn }, onDropTarget] = useDrop({
    accept: [ItemTypes.Node, ItemTypes.File, ItemTypes.Component, ...SupportedFileTypes],
    drop: dropItem(node, 'On'),
    canDrop: canDropItem(node.entity, true),
    collect: (monitor) => ({
      canDropOn: monitor.canDrop(),
      isOverOn: monitor.isOver()
    })
  })

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true })
  }, [preview])

  const icons = entityExists(node.entity)
    ? getAllComponents(node.entity)
        .map((c) => getState(ComponentEditorsState)[c.name]?.iconComponent)
        .filter((icon) => !!icon)
    : []
  const IconComponent = icons.length > 0 ? icons[0] : TransformPropertyGroup.iconComponent
  const renaming = data.renamingNode && data.renamingNode.entity === node.entity

  return (
    <li
      style={fixedSizeListStyles}
      className={twMerge(
        'cursor-pointer',
        selected ? 'text-white' : 'text-[#b2b5bd]',
        selected && (props.index % 2 ? 'bg-[#1d1f23]' : 'bg-zinc-900'),
        !selected && (props.index % 2 ? 'bg-[#141619] hover:bg-[#1d1f23]' : 'bg-[#080808] hover:bg-zinc-900'),
        !visible && (props.index % 2 ? 'bg-[#191B1F]' : 'bg-[#0e0f11]'),
        !visible && 'text-[#42454d]',
        'hover:text-white'
      )}
    >
      <div
        ref={drag}
        id={getNodeElId(node)}
        tabIndex={0}
        onKeyDown={onNodeKeyDown}
        onClick={onClickNode}
        onContextMenu={(event) => props.onContextMenu(event, entity)}
        className="py-.5 ml-3.5 h-9 justify-between bg-inherit pr-2"
      >
        <div
          className={twMerge('h-1', isOverBefore && canDropBefore && 'bg-white')}
          style={{ marginLeft: `${node.depth * 1.25}em` }}
          ref={beforeDropTarget}
        />

        <div
          className="flex items-center bg-inherit pr-2"
          style={{ paddingLeft: `${node.depth * 1.25}em` }}
          ref={onDropTarget}
        >
          {node.isLeaf ? (
            <div className="w-5 shrink-0" />
          ) : (
            <button
              type="button"
              className="m-0 h-5 w-5 border-[none] bg-inherit p-0 hover:opacity-80"
              onClick={onClickToggle}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {node.isCollapsed ? (
                <MdKeyboardArrowRight className="font-small text-white" />
              ) : (
                <MdKeyboardArrowDown className="font-small text-white" />
              )}
            </button>
          )}

          <div className="flex flex-1 items-center gap-2 bg-inherit py-0.5 pl-0 pr-1 text-inherit ">
            {IconComponent && <IconComponent className="h-5 w-5 flex-shrink-0 text-inherit" />}
            <div className="flex flex-1 items-center">
              {renaming ? (
                <div className="relative h-[15px] w-full bg-inherit px-1 text-inherit">
                  <input
                    type="text"
                    className="absolute top-[-3px] m-0 w-full rounded-none bg-inherit py-0.5 pl-0.5 text-sm"
                    onChange={onChangeNodeName}
                    onKeyDown={onKeyDownNameInput}
                    value={data.renamingNode.name}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="ml-2 min-w-0 flex-1 text-nowrap rounded bg-transparent px-0.5 py-0 text-inherit ">
                  <span className="text-nowrap text-sm leading-4">{nodeName}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              className="m-0 h-5 w-5 flex-shrink-0 border-none p-0 hover:opacity-80"
              onClick={toggleVisible}
            >
              {visible ? (
                <PiEyeBold className="font-small text-[#6B7280]" />
              ) : (
                <PiEyeClosedBold className="font-small text-[#42454d]" />
              )}
            </button>
          </div>
        </div>

        <div
          className={twMerge('h-1', isOverAfter && canDropAfter && 'bg-white')}
          style={{ marginLeft: `${node.depth * 1.25}em` }}
          ref={afterDropTarget}
        />
      </div>
    </li>
  )
}

export default HierarchyTreeNode
