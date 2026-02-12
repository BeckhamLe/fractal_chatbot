import express from "express";
import ViteExpress from "vite-express";
import dotenv from 'dotenv';
import Anthropic from "@anthropic-ai/sdk";  // import anthropic sdk
import { MessageParam } from "@anthropic-ai/sdk/resources";
import { Storage } from "./storage.js"    // import storage interface and its methods
import { Conversation, Message } from "src/shared/types.js";

// configure dotenv 
dotenv.config() 

// Create new anthropic client
const anthropic = new Anthropic()

const app = express();  // create express app server
app.use(express.json())   // have this to parse request body and be able to access it

class inMemoryStorage implements Storage {
  private conversationHistory = new Map<string, Conversation>()   // where all the conversation sessions are stored

  addMessageToConversation(convoId: string, message: Message): Conversation {
    const selectedConvo = this.conversationHistory.get(convoId)   // search for the conversation using convoId and setting that found conversation to a variable

    // Check if conversation found actually exists
    if(selectedConvo){
      selectedConvo.messages.push(message)  // if so, add the new message to the array of current messages
      return selectedConvo              // return conversation object updated to server to send to frontend
    } else {
      throw new Error("Conversation doesn't exist")
    }
  }

  getConversation(convoId: string): Conversation {
    const selectedConvo = this.conversationHistory.get(convoId)    // search for the conversation using convoId and setting that found conversation to a variable
    
    // check if conversation found exists
    if(selectedConvo){
      return selectedConvo    // if found then return conversation object for server to send to frontend
    } else {
      throw new Error("Conversation not found")   // if not then throw an error
    }
  }

  getConversations(): Map<string, Conversation> {
    return this.conversationHistory   // return map of all conversations for server to send to frontend
  }

  createConversation(): Conversation {
    const newId = crypto.randomUUID()   // generate a random unique id for new conversation object
    
    // create a new conversation object
    const newConvo: Conversation = {
      id: newId,
      title: newId,
      messages: []
    }

    this.conversationHistory.set(newId, newConvo)   // add the newly created conversation object to the map of conversations
    return newConvo   // return new convo for server to send to frontend
  }
}

let message_history: MessageParam[] = []    // array to store all chat logs user made with claude

//Endpoint: Get Hello
app.get("/hello", async(req, res) => {
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,                                                                                                                                                      
    messages: [{ role: "user", content: "hello" }]
  });

  const claude_response = msg.content[0];   // content block anthropic api sends back
  if(claude_response.type === "text"){
    res.send(claude_response.text);       // send to front end claude's text response
  } else{
    res.status(400).json({error: "Bad prompt"})
  }
});

// Chat Endpoint
app.post('/chat', async(req, res) => {
  const user_msg = req.body.message   // user's message string from request
  message_history.push({ role: "user", content: user_msg})    // create message object of user and their message and push to message history
  
  // create the message and send to anthropic api
  const api_msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,                                                                                                                                                      
    messages: message_history
  })

  const claude_response = api_msg.content[0];   // content block of msg sent back from Claude

  // check if the content of claude's response is of type text
  if(claude_response.type === "text"){
    res.send(claude_response.text);             // send to front end Claude's text response
    message_history.push({role: api_msg.role, content: claude_response.text})  // create message object of claude and their message and push to message history

  } else{
    res.status(400).json({error: "Bad prompt"})
  }
})

// Endpoint to reset chat history
app.delete('/reset', (req, res) => {
  message_history = []  // clear message history
  res.status(200).end()
})

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
