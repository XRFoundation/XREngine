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

import { staticResourcePath, StaticResourceType } from '@etherealengine/common/src/schema.type.module'
import type { Knex } from 'knex'

function getNameFromKey(key: string) {
  return key.split('/').at(-1) ?? key
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex: Knex): Promise<void> {
  const hasNameColumn = await knex.schema.hasColumn(staticResourcePath, 'name')

  if (!hasNameColumn) {
    await knex.schema.alterTable(staticResourcePath, (table) => {
      table.string('name', 255).defaultTo('')
    })

    const rows = (await knex<StaticResourceType>(staticResourcePath).select('id', 'key')) as Pick<
      StaticResourceType,
      'id' | 'key'
    >[]

    knex.transaction(async (trx) => {
      const queries: Knex.QueryBuilder[] = []
      for (const row of rows) {
        const query = knex<StaticResourceType>(staticResourcePath)
          .where({ id: row.id })
          .update({ name: getNameFromKey(row.key) })
          .transacting(trx)
        queries.push(query)
      }
      await Promise.all(queries)
        .then(() => trx.commit())
        .catch(() => trx.rollback())
    })

    await knex.schema.alterTable(staticResourcePath, (table) => {
      table.index(['name'])
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex: Knex): Promise<void> {
  const hasNameColumn = await knex.schema.hasColumn(staticResourcePath, 'name')

  if (hasNameColumn) {
    await knex.schema.alterTable(staticResourcePath, (table) => {
      table.dropIndex(['name'])
      table.dropColumn('name')
    })
  }
}
