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
import { HiEye, HiTrash } from 'react-icons/hi2'

import { staticResourcePath, StaticResourceType } from '@etherealengine/common/src/schema.type.module'
import { useFind, useSearch } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import ConfirmDialog from '@etherealengine/ui/src/components/tailwind/ConfirmDialog'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'

import { Engine } from '@etherealengine/ecs'
import { PopoverState } from '../../../common/services/PopoverState'
import { resourceColumns } from '../../common/constants/resources'
import DataTable from '../../common/Table'
import AddEditResourceModal from './AddEditResourceModal'

const RESOURCE_PAGE_LIMIT = 25

export default function ResourceTable({ search }: { search: string }) {
  const { t } = useTranslation()
  const resourceQuery = useFind(staticResourcePath, {
    query: {
      action: 'admin',
      $limit: RESOURCE_PAGE_LIMIT,
      $sort: {
        key: 1
      }
    }
  })

  useSearch(
    resourceQuery,
    {
      key: {
        $like: `%${search}%`
      }
    },
    search
  )

  const createData = (el: StaticResourceType) => {
    return {
      id: el.id,
      name: el.name,
      key: el.key,
      mimeType: el.mimeType,
      project: el.project,
      action: (
        <div className="flex items-center justify-start gap-3">
          <Button
            onClick={() => {
              PopoverState.showPopupover(<AddEditResourceModal selectedResource={el} />)
            }}
            rounded="full"
            className="h-8 w-8 justify-center border border-theme-primary bg-transparent p-0"
          >
            <HiEye className="place-self-center text-theme-primary" />
          </Button>
          <Button
            rounded="full"
            className="h-8 w-8 justify-center border border-theme-primary bg-transparent p-0"
            onClick={() => {
              PopoverState.showPopupover(
                <ConfirmDialog
                  text={`${t('admin:components.resources.confirmResourceDelete')} '${el.key}'?`}
                  onSubmit={async () => {
                    await Engine.instance.api.service(staticResourcePath).remove(el.id)
                  }}
                />
              )
            }}
          >
            <HiTrash className="place-self-center text-theme-iconRed" />
          </Button>
        </div>
      )
    }
  }

  const createRows = () =>
    resourceQuery.data?.map((el: StaticResourceType) => {
      return createData(el)
    })

  return <DataTable query={resourceQuery} columns={resourceColumns} rows={createRows()} />
}
