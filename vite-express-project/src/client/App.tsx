import "./App.css";
import { useState } from "react";

function App() {
  const [userMsg, setUserMsg] = useState("");   // state to keep track of user's current message
  // state to hold all the messages of both user and Claude
  const [conversation, setConversation] = useState<{role:string, content:string}[]>([])      // have generic to set type to be array of message objects in the following format

  // Event listener to update the user's current message whenever they change it
  const handleUserMsgChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserMsg(event.target.value)    
  }

  const createMessage = async (userMessage: string) => {
    const userMsgObject = {role: "user", content: userMessage}
    setUserMsg("")                                                // clear the user's old text in the textarea
    setConversation(conversation => [...conversation, userMsgObject])   // update conversation state to include new user message
    
    // Send a request to the chat endpoint in the server to send a message to claude and get back the response object from that
    const claudeResponse = await fetch('/chat', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: userMessage})
    });

    const claudeResponseMsg = await claudeResponse.text()   // actual text claude replied with
    const claudeMsgObject = {role:"assistant", content: claudeResponseMsg}    // create message object of claude's response
    setConversation(conversation => [...conversation, claudeMsgObject])     // update state with claude's message appended to array
  }

  const resetConvo = async() => {
    const response = await fetch('/reset', {
      method: 'DELETE'
    })

    // if response back from server is 200-299
    if(response.ok){
      setConversation([])   // clear conversation history 
    }
  }

  return (
    <div className="App">
      <div className="Conversation">
        {conversation.map((message, index) => (
          <div key={index}>
            <p>Role: {message.role}</p>
            <p>Message: {message.content}</p>
          </div>
        ))}
      </div>
      <textarea className="UserMsg" value={userMsg} onChange={handleUserMsgChange}></textarea>
      <button className="ChatBtn" onClick={() => createMessage(userMsg)}>chat</button>
      <button onClick={() => resetConvo()}>Reset</button>
    </div>
  );
}

export default App;
