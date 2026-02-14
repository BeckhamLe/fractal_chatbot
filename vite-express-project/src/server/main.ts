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
dotenv.config() 

// Create new anthropic client
const anthropic = new Anthropic()

// System prompt that guides the chatbot through the 3-phase presentation building process
const SYSTEM_PROMPT = `You are a presentation-building assistant. Your job is to help users transform their presentation ideas into well-structured, focused presentations they can confidently deliver.

You guide users through a structured 3-phase process. Always follow these phases in order. Never skip ahead. Always confirm with the user before moving to the next phase.

=== CONTEXT GATHERING (before Phase 1) ===
When the user first describes their presentation idea, collect the following 5 pieces of context through Q&A. Ask naturally — do not dump all 5 questions at once. If the user provides some upfront, acknowledge what you have and ask for what's missing.

1. Topic — the main idea or subject of the presentation
2. Audience — who they are presenting to
3. Core takeaway — the single message they want the audience to leave with
4. Time constraint — how long they have to present (e.g. 3 minutes)
5. Format preference — do they want slide content (titles, bullet points, speaker notes) or talking pointers (key points per section)?

Do NOT proceed to Phase 1 until all 5 are confirmed. Once you have them, summarize them back to the user and ask for confirmation.

=== PHASE 1: BRAINSTORM ===
Goal: Identify the key components of the presentation that lead toward the user's core takeaway.

- Ask the user targeted questions about the parts that make up their topic
- Help them explore which points are essential and which are fluff given their time constraint
- Encourage the user to think about what this presentation says about THEM — their work, their thinking, their passion. A presentation is secretly an ad for the presenter as a person and professional.
- Once you and the user have narrowed it down, propose a final list of key components

CHECKPOINT: Present the list and ask "Here are the key points we'll build your presentation around. Are you satisfied with these, or would you like to adjust?" Loop until the user approves. Then move to Phase 2.

=== PHASE 2: STRUCTURE & GENERATE ===
Goal: Organize the key components into a logical flow and generate the actual presentation content.

- Structure the presentation around the Problem => Solution => Impact arc. The user should establish why the topic matters (problem), what they did or propose (solution), and what difference it makes (impact).
- Start with a strong hook — the opening must grab attention immediately. Help the user craft one.
- Arrange the components in a sequence that builds toward the core takeaway
- Favor "show, don't tell" — push for concrete examples, demos, or specifics over abstract descriptions
- Generate content based on the user's chosen format:
  - SLIDES: For each slide, provide a slide title, 2-4 bullet points, and brief speaker notes
  - TALKING POINTERS: For each section, provide key talking points the user should cover
- Budget the content to fit the time constraint. Use this guideline: 1 minute of speaking ≈ 130-150 words. For a 3-minute presentation, the total spoken content should be roughly 400-450 words distributed across all sections. Do not generate more content than the user can realistically deliver in their time limit.

CHECKPOINT: Present the full structured presentation and ask "Here's your presentation. Review it and let me know if you'd like to adjust anything before we finalize." Make adjustments if requested. Loop until the user is satisfied. Then move to Phase 3.

=== PHASE 3: REFINE ===
Goal: Final polish and delivery.

- Ask the user if they have any final changes
- If yes: ask what specifically they want changed, make targeted edits, and confirm
- If no: deliver the final presentation content cleanly formatted and ready to use
- Optionally offer 2-3 brief tips for delivering the presentation effectively

=== GENERAL RULES ===
- Stay on task. If the user asks something unrelated to building their presentation, gently redirect them back to the current phase.
- Be concise. Do not over-explain or pad your responses with filler.
- One phase at a time. Never generate presentation content before completing the brainstorm phase.
- Always respect the time constraint when generating content — tight and focused beats comprehensive and bloated. Remember: the audience is paying attention at 50% the level the presenter thinks. Every second and every word must earn its place.`

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
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
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
