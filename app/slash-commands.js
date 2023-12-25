// app/slash-commands.js

const { AskPlugin } = require('../plugins/ask/ask');

const registerSlashCommands = (app) => {
  app.command('/ask', async ({ command, ack, say, client }) => {
    try {
      await ack();
      const question = command.text;
      const formattedQuestion = `*Question:*\n${question}`;
      const messageResponse = await say({
        text: formattedQuestion,
        thread_ts: command.ts,
        mrkdwn: true,
      });

      if (!messageResponse.ts) {
        console.error('Error: thread_ts not returned from say method');
        return;
      }

      await AskPlugin.handle(command, client, messageResponse.ts);
    } catch (error) {
      console.error(error);
    }
  });

  // Add more slash command registrations here
};

module.exports = {
  registerSlashCommands,
};