import express from "express";
import ViteExpress from "vite-express";
import dotenv from 'dotenv';
import Anthropic from "@anthropic-ai/sdk";  // import anthropic sdk
import { Storage } from "./storage.js"    // import storage interface and its methods
import { Conversation, Message } from "src/shared/types.js";
import Database from 'better-sqlite3'

// configure dotenv 
dotenv.config() 

// Create new anthropic client
const anthropic = new Anthropic()

const app = express();  // create express app server
app.use(express.json())   // have this to parse request body and be able to access it

// SQLite Storage Class
// functions setup here are for sending conversations to .db file
class SqliteStorage implements Storage {
  // declare database property for class with no value
  private db: Database.Database
  
  // Constructor method: Runs once to setup database
  constructor(db: Database.Database) {
    // assign database from what's passed in parameters when new instance of class is called
    this.db = db
    
    // Create and setup tables for conversation and message objects to be stored in database
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,                                                                                                                                             
        title TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      ); 
    `)
  }

  addMessageToConversation(convoId: string, message: Message): Conversation {
    // SQL Command to insert new message object into the table of messages 
    // .run() = runs the sql command with the following parameters passed into it
    this.db.prepare(`
        INSERT INTO messages (conversation_id, role, content) VALUES ( ?, ?, ?);
    `).run(
      convoId, message.role, message.content
    )

    // Run method to get the conversation object just added message to and return it
    const updatedConvo = this.getConversation(convoId);
    return updatedConvo;
  }

  getConversation(convoId: string): Conversation {
    // SQL command to get conversation row that just got updated
    // .get() to get single row
    const convoRow = this.db.prepare<string, {id: string, title: string}>(`
      SELECT id, title FROM conversations WHERE id = ?  
    `).get(convoId)

    if(convoRow){
      // SQL Command to get all ordered messages associated with conversation that got updated with new message
      // .all() to get multiple rows
      const convoMsgRows = this.db.prepare<string, {role: string, content: string}>(`
          SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id;  
      `).all(convoId)
      
      // form Conversation object to give to server
      const returnConvo: Conversation = {
        id: convoRow?.id as string,
        title: convoRow?.title as string,
        messages: convoMsgRows as Message[]
      }

      return returnConvo
    } else{
      throw new Error("Conversation doesn't exist")
    }
  }

  getConversations(): { convoId: string; convoTitle: string; }[] {
    // SQL command to get an array of objects with the conversation id and title of all conversation rows
    // used AS to assign aliases to id and title of each conversation row so no type mismatches
    const convoIdTitleList = this.db.prepare(` SELECT id AS convoId, title AS convoTitle FROM conversations;`).all()

    return convoIdTitleList as { convoId: string; convoTitle: string; }[]
  }

  createConversation(): Conversation {
    const newId = crypto.randomUUID()   // generate a random unique id for new conversation object

    // Insert a new conversation with new id and title to database
    this.db.prepare(`INSERT INTO conversations (id, title) VALUES (?, ?)`).run(newId, newId)

    // create a new conversation object
    const newConvo: Conversation = {
      id: newId,
      title: newId,
      messages: []
    }

    return newConvo   // return new convo for server to send to frontend
  }
}

// Create SqliteStorage instance to create database file
const storage = new SqliteStorage(new Database('./src/db/conversations.db'))

// Chat Endpoint
app.post('/chat', async(req, res) => {
  const userMsg = req.body.message   // user's message object from request
  const convoId = req.body.id       // conversation id from request

  // create message object of user and their message
  //pass object and conversation id to storage function to update convo with new msg in the memory instanace
  const updatedConvoUser = storage.addMessageToConversation(convoId, { role: "user", content: userMsg}) 
  
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
    const updatedConvoClaude = storage.addMessageToConversation(convoId, {role: apiMsg.role, content: claudeResponse.text})
    res.json(updatedConvoClaude);             // send to front end conversation updated with new user and claude msg in json format

  } else{
    res.status(400).json({error: "Bad prompt"})
  }
})

// Get Conversation Endpoint
app.get('/convo/:id', (req, res) => {
  const convoId = req.params.id   // conversation id in request
  res.json(storage.getConversation(convoId))    // send conversation that has same id in request to front end
})

// Get All Conversations Endpoint
app.get('/convos', (req, res) => {
  res.json(storage.getConversations())    // send array of objects that have conversation id and title of all convos
})

// Create Conversation Endpoint
app.get('/create', (req, res) => {
  const newConvo = storage.createConversation()   // run storage function to create a new conversation and store it in memory
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
