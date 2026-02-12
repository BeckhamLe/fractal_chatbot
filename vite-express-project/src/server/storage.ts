import {Message, Conversation} from '../shared/types.js'

export interface Storage {
    // ADDING MESSAGE TO CONVERSATION IN DATA STORAGE SOURCE
    // takes in conversation id and message object as parameters and returns a Conversation object
    // uses id to find the conversation in storage, add new message to array of messages in convo, then return the updated conversation to server
    addMessageToConversation(convoId: string, message: Message): Conversation

    // returns copy of map of all conversations currently in storage
    getConversations(): Map<string, Conversation>

    getConversation(convoId: string): Conversation
    createConversation(): Conversation
}