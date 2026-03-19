import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import kleur from "kleur";

export class HarborServer {
    private server: Server;
    private app: express.Express;
    private port: number;

    constructor(port: number = 42721) {
        this.port = port;
        this.app = express();

        this.server = new Server(
            {
                name: "skill-harbor",
                version: "0.1.1",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupRoutes();
        this.setupToolHandlers();
    }

    private setupRoutes() {
        let transport: SSEServerTransport;

        this.app.get("/sse", async (req, res) => {
            transport = new SSEServerTransport("/message", res);
            await this.server.connect(transport);
            console.log(kleur.green("🔌 Agent connected via SSE."));
        });

        this.app.post("/message", async (req, res) => {
            if (transport) {
                await transport.handlePostMessage(req, res);
            } else {
                res.status(400).send("No active SSE connection.");
            }
        });
    }

    private setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            // TODO: Read from harbor-manifest.json
            return {
                tools: [
                    {
                        name: "harbor_ping",
                        description: "Ping the local Skill Harbor server to check its status.",
                        inputSchema: {
                            type: "object",
                            properties: {},
                        },
                    },
                ],
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name === "harbor_ping") {
                return {
                    content: [
                        {
                            type: "text",
                            text: "⚓ Skill Harbor Port Authority is fully operational.",
                        },
                    ],
                };
            }

            throw new Error(`Tool not found: ${request.params.name}`);
        });
    }

    public async startStdio() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error(kleur.green("⚓ Skill Harbor started in STDIO mode."));
    }

    public async startHttp() {
        return new Promise<void>((resolve) => {
            this.app.listen(this.port, () => {
                console.log(kleur.bold().blue(`\n⚓ Skill Harbor Port Authority`));
                console.log(kleur.cyan(`Listening for Agent connections on http://localhost:${this.port}/sse\n`));
                resolve();
            });
        });
    }
}
