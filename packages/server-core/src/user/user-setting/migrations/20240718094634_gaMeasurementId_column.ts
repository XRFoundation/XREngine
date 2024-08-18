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

import { userSettingPath } from '@etherealengine/common/src/schemas/user/user-setting.schema'
import type { Knex } from 'knex'

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('SET FOREIGN_KEY_CHECKS=0')

  await addGaMeasurementIdColumn(knex, userSettingPath)

  await knex.raw('SET FOREIGN_KEY_CHECKS=1')
}

export async function addGaMeasurementIdColumn(knex: Knex, tableName: string) {
  const gaMeasurementIdColumnExists = await knex.schema.hasColumn(tableName, 'gaMeasurementId')

  if (gaMeasurementIdColumnExists === false) {
    await knex.schema.alterTable(tableName, async (table) => {
      table.string('gaMeasurementId').nullable()
    })
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw('SET FOREIGN_KEY_CHECKS=0')

  await dropGaMeasurementIdColumn(knex, userSettingPath)

  await knex.raw('SET FOREIGN_KEY_CHECKS=1')
}

export async function dropGaMeasurementIdColumn(knex: Knex, tableName: string) {
  const gaMeasurementIdColumnExists = await knex.schema.hasColumn(tableName, 'gaMeasurementId')

  if (gaMeasurementIdColumnExists === true) {
    await knex.schema.alterTable(tableName, async (table) => {
      table.dropColumn('gaMeasurementId')
    })
  }
}
