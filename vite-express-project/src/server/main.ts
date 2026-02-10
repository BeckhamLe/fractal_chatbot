import express from "express";
import ViteExpress from "vite-express";
import dotenv from 'dotenv';
import Anthropic from "@anthropic-ai/sdk";  // import anthropic sdk
import { MessageParam } from "@anthropic-ai/sdk/resources";

// configure dotenv 
dotenv.config() 

// Create new anthropic client
const anthropic = new Anthropic()

const app = express();  // create express app server
app.use(express.json())   // have this to parse request body and be able to access it

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

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
