// app/plugin-registration.js

const { PingPlugin } = require("../plugins/mentions/ping");
const { SummarizePlugin } = require("../plugins/reactions/summarize");

const registerMentionPlugins = (app) => {
  const mentionPlugins = {
    'ping': PingPlugin,
    // Add more mention plugins here
  };

  app.event("app_mention", async ({ event, client }) => {
    const mentionCommand = event.text.split(' ')[1]; // Assuming the command follows the mention
    const plugin = mentionPlugins[mentionCommand];
    if (plugin) {
      try {
        const response = await plugin.exec(event);
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.ts,
          text: response,
        });
      } catch (error) {
        console.error(error);
      }
    }
  });

  return mentionPlugins;
};

const registerReactionPlugins = (app) => {
  const reactionPlugins = {
    'summarize': SummarizePlugin,
    // Add more reaction plugins here
  };

  app.event("reaction_added", async ({ event, client }) => {
    const plugin = reactionPlugins[event.reaction];
    if (plugin) {
      await plugin.exec(event, client);
    }
  });

  return reactionPlugins;
};

module.exports = {
  registerMentionPlugins,
  registerReactionPlugins,
};