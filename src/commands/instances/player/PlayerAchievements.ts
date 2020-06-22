import Canvas from 'canvas';
import { MessageAttachment, MessageEmbed } from 'discord.js';
import { fetchPlayer, fetchPlayerAchievements } from '../../../api/modules/players';
import config from '../../../config';
import { CanvasAttachment, Command, ParsedMessage, Renderable } from '../../../types';
import { formatDate } from '../../../utils';
import { getScaledCanvas } from '../../../utils/rendering';
import CommandError from '../../CommandError';

const RENDER_WIDTH = 260;
const RENDER_HEIGHT = 165;
const RENDER_PADDING = 15;

class PlayerAchievements implements Command, Renderable {
  name: string;
  template: string;

  constructor() {
    this.name = 'View player recent achievements';
    this.template = '!achievements {username}';
  }

  activated(message: ParsedMessage) {
    return message.command === 'achievements';
  }

  async execute(message: ParsedMessage) {
    // Grab the username from the command's arguments
    const username = this.getUsername(message.args);

    try {
      const player = await fetchPlayer(username);
      const achievements = await fetchPlayerAchievements(username);

      if (!achievements || achievements.length === 0) {
        throw new Error(`${player.displayName} has no achievements.`);
      }

      const url = `https://wiseoldman.net/players/${player.id}/achievements/`;
      const { attachment, fileName } = await this.render({ player, achievements });

      const embed = new MessageEmbed()
        .setColor(config.visuals.blue)
        .setURL(url)
        .setTitle(`${player.displayName} - Recent achievements`)
        .setImage(`attachment://${fileName}`)
        .setFooter('Last updated')
        .setTimestamp(player.updatedAt)
        .attachFiles([attachment]);

      message.respond(embed);
    } catch (e) {
      if (e.message.includes('achievements')) {
        throw new CommandError(e.message);
      } else {
        const errorMessage = `**${username}** is not being tracked yet.`;
        const errorTip = `Try !update ${username}`;

        throw new CommandError(errorMessage, errorTip);
      }
    }
  }

  async render(props: any): Promise<CanvasAttachment> {
    const { player, achievements } = props;

    const calculatedHeight = Math.min(10 + achievements.length * 31, RENDER_HEIGHT);

    // Create a scaled empty canvas
    const { canvas, ctx, width, height } = getScaledCanvas(RENDER_WIDTH, calculatedHeight, 3);

    // Load images
    const badge = await Canvas.loadImage(`./public/x2/badge_long.png`);

    // Background fill
    ctx.fillStyle = '#1d1d1d';
    ctx.fillRect(0, 0, width, height);

    // Player achievements
    for (const [index, result] of achievements.entries()) {
      const originX = RENDER_PADDING - 7;
      const originY = RENDER_PADDING - 8 + index * 31;

      const icon = await Canvas.loadImage(`./public/x2/${result.metric}.png`);

      // Badge background and metric icon
      ctx.drawImage(badge, originX, originY, 199, 26);
      ctx.drawImage(icon, originX, originY, icon.width / 2, icon.height / 2);

      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.fillText(result.type, originX + 30, originY + 17);

      ctx.fillStyle = '#b3b3b3';
      ctx.font = '9px Arial';

      if (result.createdAt.getFullYear() > 2000) {
        ctx.fillText(formatDate(result.createdAt, 'Do MMM'), originX + 205, originY + 17);
      }
    }

    const fileName = `${Date.now()}-${player.username.replace(/ /g, '_')}-achievements.jpeg`;
    const attachment = new MessageAttachment(canvas.toBuffer(), fileName);

    return { attachment, fileName };
  }

  getUsername(args: string[]): string {
    return args.filter(a => !a.startsWith('--')).join(' ');
  }
}

export default new PlayerAchievements();
