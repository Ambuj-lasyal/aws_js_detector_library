import express, { Express, Request, Response , Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AgentActionPublicType, DataSourceViewType, DustAPI, isRetrievalActionType } from '@dust-tt/client';
import { DustWorkSpaceID, DustApiKey, DustAssistantID } from './config/dust_secrets';

const CONVERSATION_CONTEXT = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    username: "xxxxxxxx", // FIXME
    email: "xxxxxxxx@hivebrite.com", // FIXME
    fullName: "xxxxxxxx", // FIXME
    profilePictureUrl: null,
    origin: null, //"web",
    //type: "super admin"
};

// see https://github.com/raycast/extensions/blob/main/extensions/dust-tt/src/utils.tsx
const DUST_AGENT = { // AgentType
    sId: "dust",
    name: "Dust",
    description: "An assistant with context on your company data.",
}

//For env File 
dotenv.config();

const app: Application = express();
const port = process.env.PORT || 5000;

interface RequestParams {}
interface ResponseBody {}
interface RequestBody {}
interface RequestQuery {
  q: string;
}

const ORIGIN = 'http://bellerophon.localhost.hvbrt.com'
const corsOptions = {
  credentials: true,
  //origin: true,
  origin: ORIGIN,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

app.use(cors(corsOptions))
app.use(function (req, res, next) {	
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);    
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');    
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');   
  res.setHeader('Access-Control-Allow-Credentials', "true");    
  next();
});

app.get('/', async (req: Request, res: Response) => {
    console.log("request", req);
    let msg = "Hello\n"
    msg += `you ask "${req.query['q']}"` 
    res.send(msg)
})

app.get('/test', async (
    req: Request<RequestParams, ResponseBody, RequestBody, RequestQuery>,
    res: Response
) => {
    let question = req.query.q || "" as string;
    // hard coded user name for demo purpose, should be passed in the call
    question = "You are replaying to 'John Doe' who is a client of Hivebrite." + question
    question = "Please tell me," + question + ". Also please format your response in markdown style, but don't mention the word markdown"
    const api = new DustAPI(
        {
            url: 'https://dust.tt',
            nodeEnv: 'production',
        },
        {
            apiKey: DustApiKey,
            workspaceId: DustWorkSpaceID,
        },
        console,
    )
    let answer = "";

    try {
        const r = await api.createConversation({
            title: null,
            visibility: "unlisted",
            message: {
              content: question,
              mentions: [
                {
                    configurationId: DustAssistantID, //DUST_AGENT.sId,
                },
              ],
              context: CONVERSATION_CONTEXT,
            },
        })
        if (r.isErr()) {
            throw(r);
        }
        const { conversation, message } = r.value;
        if (!conversation || !message) {
            throw("Dust API error: conversation or message is missing")
        }
        try {
            const r = await api.streamAgentAnswerEvents({
                conversation,
                userMessageId: message.sId
                //AbortSignal
            })

            if (r.isErr()) {
                throw new Error(r.error.message);
            }

            const { eventStream } = r.value;
            
            let action: AgentActionPublicType | undefined = undefined;
            const chainOfThought: {
                tokens: string;
                timestamp: number;
            }[] = [];

            for await (const event of eventStream) {
                if (!event) {
                  continue;
                }
                switch (event.type) {
                  case "user_message_error": {
                    console.error(`User message error: code: ${event.error.code} message: ${event.error.message}`);
                    throw(`**User message error** ${event.error.message}`);
                  }
                  case "agent_error": {
                    console.error(`Agent message error: code: ${event.error.code} message: ${event.error.message}`);
                    throw(`**Dust API error** ${event.error.message}`);
                  }
                  case "agent_action_success": {
                    console.log("agent_action_success");
                    action = event.action;
                    break;
                  }
    
                //   case "generation_tokens": {
                //     console.log("generation_tokens");
                //     if (event.classification === "tokens") {
                //         console.log("-> tokens", event.text);
                //         answer = (answer + event.text).trim();
                //         //const dustAnswer = processAction({ content: answer, action, setDustDocuments });
                //         //setDustAnswer(dustAnswer + "...");
                //     } else if (event.classification === "chain_of_thought") {
                //         console.log("-> chain_of_thought");
                //         // nothing to do here
                //     //   chainOfThought.push({ tokens: event.text, timestamp: event.created });
    
                //     //   const thinking = chainOfThought.map((c) => c.tokens).join("");
                //     //   const recent = thinking.slice(-60);
    
                //     //   showToast({
                //     //     style: Toast.Style.Animated,
                //     //     title: `@${agent.name} is thinking...`,
                //     //     message: recent,
                //     //   });
                //     }
                //     break;
                //   }
                  case "agent_message_success": {
                    console.log("agent_message_success", event.message.content);
                    answer = event.message.content || "";
                    // answer = processAction({ content: event.message.content ?? "", action, setDustDocuments });
                    // showToast({
                    //   style: Toast.Style.Success,
                    //   title: `@${agent.name} answered your question`,
                    //   message: question,
                    // });
                    // setDustAnswer(answer);
                    // await addDustHistory({
                    //   conversationId: conversation.sId,
                    //   question: question,
                    //   answer: answer,
                    //   date: new Date(),
                    //   agent: agent.name,
                    // });
                    break;
                  }
                  default:
                  // Nothing to do on unsupported events
                }
            }
        } catch(error) {
            console.log("streamAgentAnswerEvents error", error);
            throw(error)
        }
    } catch(error) {
        console.log("main error:", error)
        res.send('Err');
    }
    console.log("response sent");
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', 'application/json');
    res.json({ answer: answer});
});

app.listen(port, () => {
  console.log(`Server is Fire at http://localhost:${port}`);
});