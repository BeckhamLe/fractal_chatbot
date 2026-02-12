import "./App.css";
import requestServices from './services/requests'       // service layer to handle creating requests and parsing server responses for frontend
import { Message, Conversation} from '../shared/types'  // import Message and Conversation type interfaces
import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function App() {
  const [userMsg, setUserMsg] = useState("");   // state to keep track of user's current message
  const [selectedConvoId, setSelectedConvoId] = useState("");   // state to hold id of conversation user is currently on 
  const [currConvo, setCurrConvo] = useState<Conversation | null>(null)    // state to hold current conversation; initialized to be null to handle new users with no conversation history in memory
  const [sidebarConvos, setSidebarConvos] = useState<{convoId: string, convoTitle: string}[]>()   // state to hold array of objects with id and title of existing convos

  // useEffect for initializing current conversation to be a new one if user has no prior ex
  useEffect(() => {
    // Use Service Layer method to create new convo and update currConvo state
    requestServices.createConvo().then((newConvo: Conversation) => {
      setCurrConvo(newConvo)
      setSelectedConvoId(newConvo.id)
    })

    // Use Service Layer method to set up sidebar of existing convos
    requestServices.getConvos().then((convoArray: {convoId: string, convoTitle: string}[]) => {
      setSidebarConvos(convoArray)    // set sidebar with array of id and title objects of all conversations or empty array if no convos in memory
    })

  }, [])

  // useRef creates a reference to a DOM element so we can interact with it directly
  // here we use it to target the bottom of the conversation for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // useEffect runs code after the component renders
  // this one triggers every time 'conversation' changes (new message added)
  // it auto-scrolls to the bottom so the user always sees the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    // Use Service Layer method to set up sidebar of existing convos
    requestServices.getConvos().then((convoArray: {convoId: string, convoTitle: string}[]) => {
      setSidebarConvos(convoArray)    // set sidebar with array of id and title objects of all conversations or empty array if no convos in memory
    })

  }, [currConvo]);

  // Handle edge case of currConvo being null in between first render and first useEffect()
  if(currConvo === null){
    return (<p>Loading...</p>)
  }

  // Event listener to update the user's current message whenever they change it
  const handleUserMsgChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserMsg(event.target.value);
  };

  const createMessage = (userMessage: string) => {
    // don't send empty messages
    if (!userMessage.trim()) return;

    setUserMsg("");                                                // clear the user's old text in the textarea
    requestServices.sendMsg(selectedConvoId, userMessage).then((updatedConvo) => {
      setCurrConvo(updatedConvo)
    })
  };

  const createNewConvo = () => {
    // Use Service Layer method to create new convo and update currConvo state
    requestServices.createConvo().then((newConvo: Conversation) => {
      setCurrConvo(newConvo)
      setSelectedConvoId(newConvo.id)
    })

    // Use Service Layer method to set up sidebar of existing convos
    requestServices.getConvos().then((convoArray: {convoId: string, convoTitle: string}[]) => {
      setSidebarConvos(convoArray)    // set sidebar with array of id and title objects of all conversations or empty array if no convos in memory
    })
  }

  const clickConvo = (convoId: string) => {
    requestServices.getConvo(convoId).then((returnedConvo) => {
      setCurrConvo(returnedConvo)
    })
  }

  /*
  const resetConvo = async () => {
    const response = await fetch('/reset', {
      method: 'DELETE'
    });

    // if response back from server is 200-299
    if (response.ok) {
      setConversation([]);   // clear conversation history
    }
  };
  */

  return (
    // h-screen = full viewport height, flex = flexbox layout for the whole page
    // bg-background and text-foreground use Shadcn's dark mode CSS variables
    <div className="h-screen flex bg-background text-foreground">

      {/* ===== LEFT SIDEBAR =====
          w-64 = fixed 256px width
          border-r = right border to separate from main area
          flex-shrink-0 = don't let the sidebar shrink when the window is small
          This is just a visual placeholder for now — no functionality yet */}
      <div className="w-64 border-r border-border flex-shrink-0 flex flex-col bg-card">
        {/* Sidebar header with title */}
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Chat History</h2>
        </div>

        {/* Placeholder area where chat session logs will go later
            flex-1 = take up all remaining vertical space
            overflow-y-auto = scrollable if content overflows */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* Example placeholder session items to show what it'll look like */}
          <div className="p-3 rounded-lg bg-accent/50 cursor-pointer hover:bg-accent transition-colors">
            {sidebarConvos?.map((convo) => (
              <p key={convo.convoId} onClick={() => clickConvo(convo.convoId)} className="text-sm font-medium truncate">{convo.convoTitle}</p>
            ))}
          </div>
          <Button onClick={() => createNewConvo()}>
            New Conversation
          </Button>
        </div>
      </div>

      {/* ===== MAIN CHAT AREA =====
          flex-1 = take up all remaining horizontal space after the sidebar
          flex flex-col = stack children vertically (conversation on top, input bar on bottom) */}
      <div className="flex-1 flex flex-col">

        {/* ===== CONVERSATION CONTAINER =====
            flex-1 = grow to fill all available vertical space (pushes input bar to bottom)
            overflow-hidden = hide overflow so ScrollArea handles scrolling internally */}
        <ScrollArea className="flex-1 overflow-hidden">
          {/* max-w-3xl = cap the conversation width for readability (like Claude desktop)
              mx-auto = center it horizontally
              p-6 = padding around the messages
              space-y-6 = vertical gap between each message */}
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            {currConvo.messages.map((message, index) => (
              // Each message row: flex layout to position avatar + speech bubble side by side
              // justify-end = push user messages to the right side
              // animate-in: fade-in-0 slide-in-from-bottom-2 = Shadcn animation that fades in
              // and slides up from below, giving each new message a smooth entrance
              <div
                key={index}
                className={`flex items-start gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {/* ===== CLAUDE'S AVATAR (left side) =====
                    Only show before the speech bubble when it's Claude's message
                    order-none keeps it on the left */}
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                    C
                  </div>
                )}

                {/* ===== SPEECH BUBBLE =====
                    Card component from Shadcn gives us the rounded container with border
                    max-w-[80%] = bubble won't take more than 80% of the conversation width
                    The background color changes based on who's speaking:
                    - User: primary color (lighter) to stand out on the right
                    - Claude: card color (darker) to sit on the left
                    relative + before:pseudo-element creates the little triangle "tail"
                    pointing toward the speaker's avatar, like a comic book speech bubble */}
                <Card className={`max-w-[80%] shadow-md py-0 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"      // user gets the accent color
                    : "bg-card border-border"                   // claude gets the card background
                }`}>
                  <CardContent className="p-3">
                    {/* whitespace-pre-wrap = preserve line breaks in the message text
                        text-sm = slightly smaller text for a chat feel */}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </CardContent>
                </Card>

                {/* ===== USER'S AVATAR (right side) =====
                    Only show after the speech bubble when it's the user's message */}
                {message.role === "user" && (
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                    U
                  </div>
                )}
              </div>
            ))}

            {/* Invisible div that sits at the very bottom of the message list.
                When a new message is added, useEffect scrolls this into view,
                bringing the user to the latest message automatically */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* ===== BOTTOM INPUT BAR =====
            sticky bottom-0 = stays fixed at the bottom of the main area even when scrolling
            border-t = top border to visually separate from conversation
            bg-background = solid background so messages don't show through when scrolling
            p-4 = padding around the input area */}
        <div className="sticky bottom-0 border-t border-border bg-background p-4">
          {/* max-w-3xl mx-auto = match the conversation width and centering
              flex gap-3 items-end = lay out textarea and buttons side by side, aligned to bottom
              items-end so the buttons align with the bottom of the textarea if it grows */}
          <div className="max-w-3xl mx-auto flex gap-3 items-end">
            {/* Shadcn Textarea component — styled version of the native textarea
                flex-1 = take up all available horizontal space
                resize-none = prevent manual resizing (keeps layout clean)
                min-h-[44px] max-h-[120px] = minimum and maximum height constraints */}
            <Textarea
              className="flex-1 resize-none min-h-[44px] max-h-[120px]"
              placeholder="Type a message..."
              value={userMsg}
              onChange={handleUserMsgChange}
              // onKeyDown listens for keyboard events on this element
              // When Enter is pressed WITHOUT Shift, it sends the message
              // Shift+Enter allows typing a new line instead
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();        // prevent the default newline behavior
                  createMessage(userMsg);     // send the message instead
                }
              }}
            />
            {/* Shadcn Button — "default" variant uses the primary color from our theme
                onClick sends the current message to the chat endpoint */}
            <Button onClick={() => createMessage(userMsg)}>
              Send
            </Button>
            {/* "outline" variant = bordered button with transparent background
                Visually less prominent than Send since reset is a less common action */}
            <Button variant="outline">
              Reset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
