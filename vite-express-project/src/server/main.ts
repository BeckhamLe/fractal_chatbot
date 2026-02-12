import express from "express";
import ViteExpress from "vite-express";
import dotenv from 'dotenv';
import Anthropic from "@anthropic-ai/sdk";  // import anthropic sdk
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

  getConversations(): {convoId: string, convoTitle: string}[] {
    // Check if there's no convos in memory (new user)
    if(this.conversationHistory.size === 0){
      return []         // return empty array 
    }

    // this.conversationHistory.values() = iterator to only go through list of conversations once
    // Array.from() = converts iterator passed to it into an array so can use map method
    // use map() to transform the array into an array of only conversation id and title for each conversation in the list
    return Array.from(this.conversationHistory.values()).map((convo) => ({convoId: convo.id, convoTitle: convo.title}))
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

// Create inMemoryStorage instance
const storage = new inMemoryStorage()

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
