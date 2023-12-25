// app.js
const { App } = require("@slack/bolt");
const { slackConfig, port } = require("./config");
const { registerMentionPlugins, registerReactionPlugins } = require("./app/plugin-registration");
const { registerInteractiveComponents, registerMessageReplies } = require("./app//interaction-handlers");
const { registerSlashCommands } = require("./app/slash-commands");

class CohereSlackApp {
  constructor() {
    this.app = new App(slackConfig);

    this.mentionPlugins = registerMentionPlugins(this.app);
    this.reactionPlugins = registerReactionPlugins(this.app);
    registerSlashCommands(this.app);
    registerInteractiveComponents(this.app);
    registerMessageReplies(this.app);
  }

  async serve() {
    await this.app.start(port);
    console.log(`⚡️ Bolt app is running on port ${port}`);
  }
}

module.exports = { CohereSlackApp };