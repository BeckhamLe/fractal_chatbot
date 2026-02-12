import { Message } from "@anthropic-ai/sdk/resources"

const createConvo = async () => {
    const response = await fetch('/create')   // send request to create and get the new conversation made
    const newConvo = await response.json()        // wait for full body of response to arrive --> deserialize (convert object data structure from string -> object)

    return newConvo
}

const getConvo = async(convoId: string) => {
    const response = await fetch(`/convo/${convoId}`)   // pass conversation id in endpoint url
    const returnedConvo = await response.json()     // retrieved conversation server sends back

    return returnedConvo
}

const getConvos = async() => {
    const response = await fetch('/convos')
    const convoIdsTitles = await response.json()    // array of objects with conversation id and title of all convos

    return convoIdsTitles
}

const sendMsg = async(convoId: string, userMsg: string) => {
    // Send a request to the chat endpoint in the server to send a message to claude and get back the response object from that
    const response = await fetch('/chat', {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: userMsg, id: convoId })
    });

    const updatedConvo = await response.json()  // retrieve updated convo object server sends back
    return updatedConvo     // send to front end
}

export default { createConvo, getConvo, getConvos, sendMsg }