import {Message, Conversation} from '../shared/types.js'

export interface Storage {
    // ADDING MESSAGE TO CONVERSATION IN DATA STORAGE SOURCE
    // takes in conversation id and message object as parameters and returns a Conversation object
    // uses id to find the conversation in storage, add new message to array of messages in convo, then return the updated conversation to server
    addMessageToConversation(convoId: string, message: Message): Conversation

    // returns the title and conversation id of all conversations currently in storage
    getConversations(): {convoId: string, convoTitle: string}[]

    getConversation(convoId: string): Conversation
    createConversation(): Conversation
}