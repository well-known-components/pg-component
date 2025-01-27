import { MigrationBuilder, PgType } from 'node-pg-migrate'

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('jobs', {
    id: { type: PgType.UUID, primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar', notNull: false }
  })
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('jobs')
}
