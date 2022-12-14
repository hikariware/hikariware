import { Client } from "../Clients/Client";
import { Command } from "./Command";
import { ICategory, ICommand, ICommandInfo } from "./Interfaces";
import { promisify } from "util";
import glob1 from "glob";
import { Cog } from "./Cog/Cog";
import { Message } from "../DiscordTypes/Message";
const glob = promisify(glob1);

export class CommandManager<T extends Client> {
	public commandsCollection = new Map<string, ICommand | Command>();
	public aliasesCollection = new Map<string, string>();
	public commandCategories = new Map<string, string[]>();
	public categoryInfo = new Map<string, ICategory>();
	public client: T;
	public directory: string;

	public constructor(client: T) {
		this.client = client;
	}

	public async loadCommands() {
		return glob(`${this.directory}/**/*.{ts,js}`).then(files => {
			this.commandCategories.set("No Categories", []);
			for (const file of files) {
				const cmdOrCog = require(file).default ?? require(file);
				const cmdOrCogClass = new cmdOrCog(this.client);
				if (cmdOrCogClass instanceof Cog) {
					const propertyNames = Object.getOwnPropertyNames(
						cmdOrCog.prototype
					);
					const commandMethodKeys = propertyNames.filter(e =>
						e.startsWith("cmd")
					);
					const eventMethodKeys = propertyNames.filter(e =>
						e.startsWith("onEvent")
					);
					this.commandCategories.set(
						cmdOrCogClass.cogInfo.name ?? cmdOrCog.name,
						[]
					);
					if (cmdOrCogClass.cogInfo) {
						this.categoryInfo.set(
							cmdOrCogClass.cogInfo.name,
							cmdOrCogClass.cogInfo
						);
					}
					for (const command of commandMethodKeys) {
						const cmdInfo = cmdOrCogClass[command]();
						const bindedMethod = cmdInfo.run.bind(cmdOrCogClass);
						const toPush: ICommand = {
							getInfo(): ICommandInfo {
								return {
									name: cmdInfo.name,
									description: cmdInfo.description,
									alias: cmdInfo.alias,
									usage: cmdInfo.usage
								};
							},
							async handle(message, args) {
								bindedMethod(message, args);
							}
						};
						this.commandsCollection.set(cmdInfo.name, toPush);
						this.commandCategories
							.get(cmdOrCog.name)
							.push(cmdInfo.name);
					}
					for (const event of eventMethodKeys) {
						const eventInfo = cmdOrCogClass[event]();
						const binedMethod = eventInfo.run.bind(cmdOrCogClass);
						this.client[eventInfo.type](
							eventInfo.event,
							(...args) => binedMethod(...args)
						);
					}
				} else if (cmdOrCogClass instanceof Command) {
					const cmdInfo = cmdOrCogClass.getInfo();
					if (cmdInfo.category) {
						if (typeof cmdInfo.category === "string") {
							if (!this.commandCategories.has(cmdInfo.category)) {
								this.commandCategories.set(cmdInfo.category, [
									cmdInfo.name
								]);
							} else {
								this.commandCategories
									.get(cmdInfo.category)
									.push(cmdInfo.name);
							}
						} else {
							if (
								!this.commandCategories.has(
									cmdInfo.category.name
								)
							) {
								this.commandCategories.set(
									cmdInfo.category.name,
									[cmdInfo.name]
								);
							} else {
								this.commandCategories
									.get(cmdInfo.category.name)
									.push(cmdInfo.name);
							}
							this.categoryInfo.set(
								cmdInfo.category.name,
								cmdInfo.category
							);
						}
					}
					this.commandsCollection.set(cmdInfo.name, cmdOrCogClass);
					if (cmdInfo.alias) {
						for (const aliase of cmdInfo.alias) {
							this.aliasesCollection.set(aliase, cmdInfo.name);
						}
					}
				} else {
					if (!this.isCommand(cmdOrCog))
						throw new Error("This class is not a command or cog!");
					const cmdInfo: ICommandInfo = cmdOrCogClass.getInfo();
					if (cmdInfo.category) {
						if (typeof cmdInfo.category === "string") {
							if (!this.commandCategories.has(cmdInfo.category)) {
								this.commandCategories.set(cmdInfo.category, [
									cmdInfo.name
								]);
							} else {
								this.commandCategories
									.get(cmdInfo.category)
									.push(cmdInfo.name);
							}
						} else {
							if (
								!this.commandCategories.has(
									cmdInfo.category.name
								)
							) {
								this.commandCategories.set(
									cmdInfo.category.name,
									[cmdInfo.name]
								);
							} else {
								this.commandCategories
									.get(cmdInfo.category.name)
									.push(cmdInfo.name);
							}
							this.categoryInfo.set(
								cmdInfo.category.name,
								cmdInfo.category
							);
						}
					}
					this.commandsCollection.set(cmdInfo.name, cmdOrCogClass);
					if (cmdInfo.alias) {
						for (const aliase of cmdInfo.alias) {
							this.aliasesCollection.set(aliase, cmdInfo.name);
						}
					}
				}
			}
		});
	}

	public isCommand(obj: any): boolean {
		const keys = Object.getOwnPropertyNames(obj.prototype);
		return keys.includes("handle") && keys.includes("getInfo");
	}

	public getCommand(cmd: string) {
		return (
			this.commandsCollection.get(cmd) ??
			this.commandsCollection.get(this.aliasesCollection.get(cmd))
		);
	}

	public async handle(message: Message, prefix: string) {
		const [cmd, ...args] = message.content
			.slice(prefix.length)
			.split(/ +/g);
		const cmdObj = this.getCommand(cmd);
		cmdObj?.handle(message, args);
	}
}
