import express from "express";
import ViteExpress from "vite-express";
import dotenv from 'dotenv';

// configure dotenv 
dotenv.config() 

const app = express();

app.get("/hello", async(req, res) => {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({                                                                                                                                                   
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,                                                                                                                                                      
      messages: [{ role: "user", content: "hello" }]
    })
  })

  const data = await response.json();   //parse the JSON response
  
  res.send(data);
});

ViteExpress.listen(app, 3000, () =>
  console.log("Server is listening on port 3000..."),
);
