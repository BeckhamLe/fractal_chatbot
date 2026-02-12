import { UUID } from "crypto"

export interface Message {
    role: "user" | "assistant"
    content: string
}

export interface Conversation {
    id: string
    messages: Message[]
    title: string
}