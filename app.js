require("dotenv").config();

const { App, LogLevel } = require("@slack/bolt");
const { Mention, Reaction } = require("./plugins/index");
const { AskPlugin } = require('./plugins/ask/ask');
// const { SummarizePlugin } = require('../summarize'); // Import the SummarizePlugin


const cohere = require("cohere-ai");
/**
 * a co:here-flavoured @slack/bolt app
 *
 * register plugins on creation and expects callers to invoke `serve()`
 */
class CohereSlackApp {
  constructor() {
    const cfg = {
      token: process.env.SLACK_BOT_TOKEN,
      appToken: process.env.SLACK_APP_TOKEN,
      socketMode: true,
    };
    this.app = new App(cfg);

    this.mentionPlugins = {};
    this.registerMentionPlugins();

    this.reactionPlugins = {};
    this.registerReactionPlugins();

    this.registerSlashCommands();

    this.registerInteractiveComponents();

    this.registerMessageReplies();
  }

  registerSlashCommands() {
    this.app.command('/ask', async ({ command, ack, say, client }) => {
      try {
        // Acknowledge the command request
        await ack();
  
        // Extract the question from the command text
        const question = command.text;
  
        const formattedQuestion = `*Question:*\n${question}`;

        // Start a thread with the initial question formatted with markdown
        const messageResponse = await say({
          text: formattedQuestion,
          thread_ts: command.ts,
          mrkdwn: true, // Enable markdown
        });


        // Verify the thread_ts is returned correctly
        if (!messageResponse.ts) {
          console.error('Error: thread_ts not returned from say method');
          return;
        }
  
        // Use the AskPlugin to handle the conversation logic and Cohere API call
        await AskPlugin.handle(command, client, messageResponse.ts);
      } catch (error) {
        console.error(error);
      }
    });
  }

  // Register interactive components like buttons
  registerInteractiveComponents() {
    this.app.action('regenerate_response', async ({ ack, body, client }) => {
      await ack();
  
      const { channel, message } = body;
  
      // Find the timestamp of the AI's response message
      const originalResponseTs = message.ts;
  
      const pseudoCommand = {
        channel_id: channel.id,
        text: message.blocks[0].text.text, // This assumes the first block contains the user's question
        user_id: body.user.id,
      };
  
      const thread_ts = message.thread_ts || message.ts;
  
      // Pass the timestamp of the original AI response to handle method
      await AskPlugin.handle(pseudoCommand, client, thread_ts, true, originalResponseTs);
    });

      // Add a new action listener for the view_document_details action
      this.app.action('view_document_details', async ({ ack, body, client }) => {
        await ack();
      
        if (!AskPlugin.searchResults || AskPlugin.searchResults.length === 0) {
          console.error('Error: searchResults is not populated.');
          return;
        }
      
        const action = body.actions[0];
        if (!action || !action.selected_option) {
          console.error('Error: No selected option found.');
          return;
        }
      
        const selectedDocumentValue = action.selected_option.value;
        const docIndex = parseInt(selectedDocumentValue.replace('document_', ''));
        const document = AskPlugin.searchResults[docIndex];
      
        const user = body.user.id;
        const channel = body.channel.id;
        const thread_ts = body.message.thread_ts || body.message.ts; // Use the thread_ts from the original message
      
        // Create blocks for the ephemeral message
        const blocks = [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: document.url ? `:mag: *<${document.url}|${document.title}>*` : `:mag: *${document.title}*`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: document.snippet
            },
          },
        ];
      
        // Send an ephemeral message with the details of the selected document
        await client.chat.postEphemeral({
          channel: channel,
          thread_ts: thread_ts, // Post in the thread
          user: user,
          blocks: blocks,
          mrkdwn: true,
        });
      });
  }



  

  async handleConversation(command, client, thread_ts) {
    // Initialize the Cohere client
    cohere.init(process.env.COHERE_API_TOKEN);
  
    // Get the conversation history for the thread
    const history = await this.getThreadHistory(client, command.channel_id, thread_ts);
  
    // Format the chat_history for the Cohere API
    const chat_history = history.map((msg) => ({
      role: msg.user === command.user_id ? 'USER' : 'ASSISTANT',
      message: msg.text
    }));
  
    // Call the Cohere chat endpoint
    const cohereResponse = await cohere.chat({
      model: 'command', // Use the appropriate model
      chat_history,
      message: command.text
    });
  
    // Check for errors in the Cohere response
    if (cohereResponse.statusCode !== 200) {
      throw new Error(`${cohereResponse.statusCode} received from Cohere API`);
    }
  
    // Post the Cohere response in the thread
    await client.chat.postMessage({
      channel: command.channel_id,
      thread_ts: thread_ts,
      text: cohereResponse.body.message // Use the message from the response
    });
  }
  
  async getThreadHistory(client, channel, thread_ts) {
    // Fetch the history of messages in the thread
    const result = await client.conversations.replies({
      channel: channel,
      ts: thread_ts
    });
  
    // Return an array of messages
    return result.messages;
  }


// Add this method to register an event listener for messages in a thread
registerMessageReplies() {
  this.app.message(async ({ message, say, client, event }) => {
    // Ignore messages from the bot itself to prevent an infinite loop
    if (message.subtype === 'bot_message') {
      return;
    }
 
    // Check if the message is in a thread
    if (message.thread_ts) {
      // Construct a pseudo-command object to match the expected structure in AskPlugin.handle
      const pseudoCommand = {
        channel_id: event.channel,
        text: message.text,
        user_id: message.user,
      };
      
      // Use the AskPlugin to handle the conversation logic and Cohere API call
      await AskPlugin.handle(pseudoCommand, client, message.thread_ts);
    }
  });
}



  /**
   * start an http server configured with handlers supplied by
   * registered plugins
   */
  async serve() {
    await this.app.start(process.env.PORT || 3000);
    console.log("⚡️ Bolt app is running!", process.env.PORT);
  }

  /**
   * register plugins from ./plugins/mentions
   *
   * 🔧 require a plugin and add it to `mentionPlugins`
   */
  registerMentionPlugins() {
    const { PingPlugin } = require("./plugins/mentions/ping");
    // const { SummarizePlugin } = require("./plugins/mentions/summarize");
    const mentionPlugins = [PingPlugin];

    mentionPlugins.forEach((plugin) => {
      const { name, exec } = plugin;
      this.mentionPlugins[name] = exec;
    });

    this.app.event("app_mention", async ({ event, context, client, say }) => {
      console.info(event);

      const mention = new Mention(event);
      const subcommand = mention.subcommand();
      const func = this.mentionPlugins[subcommand];

      try {
        const response = await func(event);

        // threaded response
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.ts,
          text: response,
        });
      } catch (error) {
        console.error(error);
      }
    });
  }

  /**
   * register plugins from ./plugins/reactions
   *
   * 🔧 require a plugin and add it to `reactionPlugins`
   */
  registerReactionPlugins() {
    const { SummarizePlugin } = require("./plugins/reactions/summarize");
  
    this.app.event("reaction_added", async ({ event, client }) => {
      console.info(event);
  
      if (event.reaction === SummarizePlugin.name) {
        await SummarizePlugin.exec(event, client);
      }
    });
  }

  
}

module.exports = { CohereSlackApp };
