// Importing Drizzle's building blocks for PostgreSQL tables
// pgTable = creates a table
// text, serial = define column types
import { pgTable, text, serial } from 'drizzle-orm/pg-core'

// Conversations table schema
export const conversations = pgTable('conversations', {
  // id column that takes type text (string)
  // title column that takes type text
  // .primaryKey() = unique identifier for each row
  
  //convo id
  id: text('id').primaryKey(),

  // convo title
  title: text('title').notNull(),   // notNull() = can't be empty
})

// Messages table schema
export const messages = pgTable('messages', {
  // serial() = auto-incrementing integer
  // .references(() => someTable.someColumn) = used for establishing foreign key connection between 2 tables

  // id for keeping track of the order of messages being sent to the database
  id: serial('id').primaryKey(),

  // convo id
  conversationId: text('conversation_id').notNull().references(() => conversations.id), // connects to the convo id column in conversations table

  // either user or assistant to tell who sent the message
  role: text('role').notNull(),

  // content of the message
  content: text('content').notNull(),
})
