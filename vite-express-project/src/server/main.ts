import express from "express";
import ViteExpress from "vite-express";
import dotenv from 'dotenv';
import Anthropic from "@anthropic-ai/sdk";  // import anthropic sdk
import { Storage } from "./storage.js"    // import storage interface and its methods
import { Conversation, Message } from "src/shared/types.js";    // import Message and Conversation interfaces
import { eq } from 'drizzle-orm'      // import Drizzle's version of = in SQL
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js'  // imports drizzle function that creates drizzle ORM instance and type of database using drizzle/postgres
import postgres from 'postgres'      // the Postgres driver; establishes network connection to supabase database
import * as schema from './schema.js'   // imports everything from schema file

// configure dotenv 
// dotenv.config() 

// Create new anthropic client
const anthropic = new Anthropic()

const app = express();  // create express app server
app.use(express.json())   // have this to parse request body and be able to access it

// Supabase Storage Class using Drizzle/Postgres
class SupabaseStorage implements Storage {
  private db: PostgresJsDatabase<typeof schema>   // Drizzle ORM instance; object that lets server read/write to database

  // Constructor method: Sets up connection with remote database
  constructor(databaseUrl: string) {
    // connection object
    const client = postgres(databaseUrl)    // establish connection to supabase database
    
    // combines both the connection and schema 
    this.db = drizzle(client, {schema})     // gives typed methods to read and write data to database
  }

  async addMessageToConversation (convoId: string, message: Message): Promise<Conversation> {
    // insert new message object into messages table
    await this.db
      .insert(schema.messages)
      .values({conversationId: convoId, role: message.role, content: message.content})

    // Retrieve the updated conversation 
    const updatedConvo = await this.getConversation(convoId)
    
    return updatedConvo // give to server
  }

  async getConversation (convoId: string): Promise<Conversation> {
    // returns back an array even if only one conversation is found (which is what we want)
    // only returns Conversation object with id and title
    const convo = 
      await this.db
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, convoId))

    if(convo.length === 0){
      throw new Error("Conversation doesn't exists")
    }

    // returns back ordered array of messages associated with selected convo
    const convoMsgs = 
      await this.db 
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, convoId))
        .orderBy(schema.messages.id)

    // Array of message objects that only have role and content
    // transformed convoMsgs to exclude id and conversation_id fields
    // casted the role since role sent and stored in the database is only either user or assistant
    const roleContentMsgs: Message[] = convoMsgs.map<Message>((msg) => ({role: msg.role as "user" | "assistant", content: msg.content}))

    // Create new conversation object to put all data info retrieved from database into
    const returnedConvo: Conversation = {
      id: convo[0].id,
      title: convo[0].title,
      messages: roleContentMsgs
    }

    return returnedConvo
  }

  async getConversations (): Promise<{ convoId: string; convoTitle: string; }[]> {
   
    // array of all existing conversation objects with their id and title
    const convoIdTitleList = 
      await this.db
        .select()
        .from(schema.conversations)

    // Transformed array to switch aliases to match type name of interface
    const formattedList = convoIdTitleList.map<{ convoId: string; convoTitle: string; }>((convo) => ({convoId: convo.id, convoTitle: convo.title}))
        
    return formattedList
  }

  async createConversation (): Promise<Conversation> {
    const newId = crypto.randomUUID()   // generate a random unique id for new conversation object
    
    await this.db
      .insert(schema.conversations)
      .values({id: newId, title: newId})

    // create a new conversation object
    const newConvo: Conversation = {
      id: newId,
      title: newId,
      messages: []
    }

    return newConvo   // return new convo for server to send to frontend
  }
}

// Create SupabaseStorage instance and pass url of database for postgres driver
const storage = new SupabaseStorage(process.env.DATABASE_URL!)

// Chat Endpoint
app.post('/chat', async(req, res) => {
  const userMsg = req.body.message   // user's message object from request
  const convoId = req.body.id       // conversation id from request

  // create message object of user and their message
  //pass object and conversation id to storage function to update convo with new msg in the memory instanace
  const updatedConvoUser = await storage.addMessageToConversation(convoId, { role: "user", content: userMsg}) 
  
  // create the message and send to anthropic api
  const apiMsg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,                                                                                                                                                      
    messages: updatedConvoUser.messages
  })

  const claudeResponse = apiMsg.content[0];   // content block of msg sent back from Claude

  // check if the content of claude's response is of type text
  if(claudeResponse.type === "text"){
    // create message object of claude and their message
    //pass object and conversation id to storage function to update convo with new msg in the memory instanace
    const updatedConvoClaude = await storage.addMessageToConversation(convoId, {role: apiMsg.role, content: claudeResponse.text})
    res.json(updatedConvoClaude);             // send to front end conversation updated with new user and claude msg in json format

  } else{
    res.status(400).json({error: "Bad prompt"})
  }
})

// Get Conversation Endpoint
app.get('/convo/:id', async (req, res) => {
  const convoId = req.params.id   // conversation id in request
  const convo = await storage.getConversation(convoId)

  res.json(convo)    // send conversation that has same id in request to front end
})

// Get All Conversations Endpoint
app.get('/convos', async (req, res) => {
  const allConvos = await storage.getConversations()
  
  res.json(allConvos)    // send array of objects that have conversation id and title of all convos
})

// Create Conversation Endpoint
app.get('/create', async (req, res) => {
  const newConvo = await storage.createConversation()   // run storage function to create a new conversation and store it in memory
  res.json(newConvo)                            // return that newly created convo to frontend
})

// Endpoint to reset chat history
/*
app.delete('/reset', (req, res) => {
  const convoId = req.body.id
  
  storage. = []  // clear message history
  res.status(200).end()
})
*/

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
