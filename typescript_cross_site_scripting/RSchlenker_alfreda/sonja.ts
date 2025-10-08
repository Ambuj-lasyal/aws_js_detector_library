import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts"
import { ChatMessageHistory } from "@langchain/community/stores/message/in_memory"
import { AIMessage, HumanMessage } from "@langchain/core/messages"
import {
  convertAllToAlfredFormat,
  convertToAlfredFormat,
} from "./utils/alfredaAdapter"
import { BufferWindowMemory } from "langchain/memory"
import { ChatBedrockConverse } from "@langchain/aws"
import { StringOutputParser } from "@langchain/core/output_parsers"
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables"

export default function addSonjaRoute(app) {
  const messageHistory = new ChatMessageHistory()

  app.get("/sonja", async (req, res) => {
    if (req.query.isFirstRun === "true") {
      const messages = await messageHistory.getMessages()
      const responseBody = convertAllToAlfredFormat(messages, "Sonja")
      res.send(JSON.stringify({ ...responseBody, rerun: 0.1 }))
    } else {
      const task = req.query.question
      const chain = await initializeAgent(task, req.query.raw === "true")
      const buffer = new BufferWindowMemory({
        k: 10,
        chatHistory: messageHistory,
        returnMessages: true,
      })
      const currentHistory = await buffer.loadMemoryVariables({ input: "" })
      const response = await chain.invoke({
        input: task,
        chat_history: currentHistory.history,
      })
      console.log("question was: ", task)
      console.log(response)
      await messageHistory.addMessage(new HumanMessage(task.toString()))
      await messageHistory.addMessage(new AIMessage(response.output))
      res.send(convertToAlfredFormat(response, "Sonja"))
    }
  })

  async function initializeAgent(question: string, isRawMode: boolean = false) {
    const model = new ChatBedrockConverse({
      model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_BEDROCK_KEY_ID,
        secretAccessKey: process.env.AWS_BEDROCK_SECRET_KEY,
      },
    })
    let prompt = await getMemoryPrompt()
    if (isRawMode) {
      prompt = ChatPromptTemplate.fromTemplate(question.replace(/[{}]/g, ""))
    }
    const newChain = RunnableSequence.from([
      prompt,
      model as any,
      new StringOutputParser(),
      {
        input: () => question,
        output: new RunnablePassthrough(),
      },
    ])
    return newChain
  }
}

const MEMORY_KEY = "chat_history"
async function getMemoryPrompt() {
  return ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are very powerful assistant and your name is Sonja.
      You are very friendly. 
      Try to use some emojis to make the conversation more fun. 
      Try to be precise and dont add too much information.
      You dont know the current time.
      `,
    ],
    new MessagesPlaceholder(MEMORY_KEY),
    ["user", "{input}"],
  ])
}
