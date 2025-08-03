import { ToolDefinition, ToolModule } from "./tool-interface.ts";

// Types
interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
}

interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

interface ObservationInput {
  entityName: string;
  contents: string[];
}

interface ObservationResult {
  entityName: string;
  addedObservations: string[];
}

interface ObservationDeletion {
  entityName: string;
  observations: string[];
}

// KnowledgeGraphManager class
class KnowledgeGraphManager {
  private memoryFilePath: string;

  constructor(memoryFilePath?: string) {
    this.memoryFilePath = memoryFilePath || Deno.env.get("MEMORY_FILE_PATH") ||
      "./memory.json";
  }

  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await Deno.readTextFile(this.memoryFilePath);
      const lines = data.split("\n").filter((line) => line.trim() !== "");
      return lines.reduce(
        (graph: KnowledgeGraph, line) => {
          const item = JSON.parse(line);
          if (item.type === "entity") graph.entities.push(item as Entity);
          if (item.type === "relation") graph.relations.push(item as Relation);
          return graph;
        },
        { entities: [], relations: [] },
      );
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { entities: [], relations: [] };
      }
      throw error;
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map((e) => JSON.stringify({ type: "entity", ...e })),
      ...graph.relations.map((r) => JSON.stringify({ type: "relation", ...r })),
    ];
    await Deno.writeTextFile(this.memoryFilePath, lines.join("\n"));
  }

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    const graph = await this.loadGraph();
    const newEntities = entities.filter(
      (e) =>
        !graph.entities.some(
          (existingEntity) => existingEntity.name === e.name,
        ),
    );
    graph.entities.push(...newEntities);
    await this.saveGraph(graph);
    return newEntities;
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const graph = await this.loadGraph();
    const newRelations = relations.filter(
      (r) =>
        !graph.relations.some(
          (existingRelation) =>
            existingRelation.from === r.from &&
            existingRelation.to === r.to &&
            existingRelation.relationType === r.relationType,
        ),
    );
    graph.relations.push(...newRelations);
    await this.saveGraph(graph);
    return newRelations;
  }

  async addObservations(
    observations: ObservationInput[],
  ): Promise<ObservationResult[]> {
    const graph = await this.loadGraph();
    const results = observations.map((o) => {
      const entity = graph.entities.find((e) => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      const newObservations = o.contents.filter(
        (content) => !entity.observations.includes(content),
      );
      entity.observations.push(...newObservations);
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    await this.saveGraph(graph);
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.entities = graph.entities.filter(
      (e) => !entityNames.includes(e.name),
    );
    graph.relations = graph.relations.filter(
      (r) => !entityNames.includes(r.from) && !entityNames.includes(r.to),
    );
    await this.saveGraph(graph);
  }

  async deleteObservations(deletions: ObservationDeletion[]): Promise<void> {
    const graph = await this.loadGraph();
    deletions.forEach((d) => {
      const entity = graph.entities.find((e) => e.name === d.entityName);
      if (entity) {
        entity.observations = entity.observations.filter(
          (o) => !d.observations.includes(o),
        );
      }
    });
    await this.saveGraph(graph);
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.relations = graph.relations.filter(
      (r) =>
        !relations.some(
          (delRelation) =>
            r.from === delRelation.from &&
            r.to === delRelation.to &&
            r.relationType === delRelation.relationType,
        ),
    );
    await this.saveGraph(graph);
  }

  readGraph(): Promise<KnowledgeGraph> {
    return this.loadGraph();
  }

  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();

    const filteredEntities = graph.entities.filter(
      (e) =>
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.entityType.toLowerCase().includes(query.toLowerCase()) ||
        e.observations.some((o) =>
          o.toLowerCase().includes(query.toLowerCase())
        ),
    );

    const filteredEntityNames = new Set(filteredEntities.map((e) => e.name));

    const filteredRelations = graph.relations.filter(
      (r) => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to),
    );

    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();

    const filteredEntities = graph.entities.filter((e) =>
      names.includes(e.name)
    );

    const filteredEntityNames = new Set(filteredEntities.map((e) => e.name));

    const filteredRelations = graph.relations.filter(
      (r) => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to),
    );

    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }
}

// Factory function to get manager instance
function getKnowledgeGraphManager(): KnowledgeGraphManager {
  return new KnowledgeGraphManager();
}

// Tool definitions
export const createEntitiesToolDefinition: ToolDefinition = {
  tool: {
    name: "create_entities",
    description: "Create multiple new entities in the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "The name of the entity",
              },
              entityType: {
                type: "string",
                description: "The type of the entity",
              },
              observations: {
                type: "array",
                items: { type: "string" },
                description:
                  "An array of observation contents associated with the entity",
              },
            },
            required: ["name", "entityType", "observations"],
          },
        },
      },
      required: ["entities"],
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const entities = args.entities as Entity[];
    const result = await getKnowledgeGraphManager().createEntities(entities);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

export const createRelationsToolDefinition: ToolDefinition = {
  tool: {
    name: "create_relations",
    description:
      "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
    inputSchema: {
      type: "object",
      properties: {
        relations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: {
                type: "string",
                description: "The name of the entity where the relation starts",
              },
              to: {
                type: "string",
                description: "The name of the entity where the relation ends",
              },
              relationType: {
                type: "string",
                description: "The type of the relation",
              },
            },
            required: ["from", "to", "relationType"],
          },
        },
      },
      required: ["relations"],
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const relations = args.relations as Relation[];
    const result = await getKnowledgeGraphManager().createRelations(relations);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

export const addObservationsToolDefinition: ToolDefinition = {
  tool: {
    name: "add_observations",
    description:
      "Add new observations to existing entities in the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        observations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entityName: {
                type: "string",
                description:
                  "The name of the entity to add the observations to",
              },
              contents: {
                type: "array",
                items: { type: "string" },
                description: "An array of observation contents to add",
              },
            },
            required: ["entityName", "contents"],
          },
        },
      },
      required: ["observations"],
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const observations = args.observations as ObservationInput[];
    const result = await getKnowledgeGraphManager().addObservations(
      observations,
    );
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

export const deleteEntitiesToolDefinition: ToolDefinition = {
  tool: {
    name: "delete_entities",
    description:
      "Delete multiple entities and their associated relations from the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        entityNames: {
          type: "array",
          items: { type: "string" },
          description: "An array of entity names to delete",
        },
      },
      required: ["entityNames"],
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const entityNames = args.entityNames as string[];
    await getKnowledgeGraphManager().deleteEntities(entityNames);
    return {
      content: [
        {
          type: "text" as const,
          text: "Entities deleted successfully",
        },
      ],
    };
  },
};

export const deleteObservationsToolDefinition: ToolDefinition = {
  tool: {
    name: "delete_observations",
    description:
      "Delete specific observations from entities in the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        deletions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              entityName: {
                type: "string",
                description:
                  "The name of the entity containing the observations",
              },
              observations: {
                type: "array",
                items: { type: "string" },
                description: "An array of observations to delete",
              },
            },
            required: ["entityName", "observations"],
          },
        },
      },
      required: ["deletions"],
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const deletions = args.deletions as ObservationDeletion[];
    await getKnowledgeGraphManager().deleteObservations(deletions);
    return {
      content: [
        {
          type: "text" as const,
          text: "Observations deleted successfully",
        },
      ],
    };
  },
};

export const deleteRelationsToolDefinition: ToolDefinition = {
  tool: {
    name: "delete_relations",
    description: "Delete multiple relations from the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        relations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              from: {
                type: "string",
                description: "The name of the entity where the relation starts",
              },
              to: {
                type: "string",
                description: "The name of the entity where the relation ends",
              },
              relationType: {
                type: "string",
                description: "The type of the relation",
              },
            },
            required: ["from", "to", "relationType"],
          },
          description: "An array of relations to delete",
        },
      },
      required: ["relations"],
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const relations = args.relations as Relation[];
    await getKnowledgeGraphManager().deleteRelations(relations);
    return {
      content: [
        {
          type: "text" as const,
          text: "Relations deleted successfully",
        },
      ],
    };
  },
};

export const readGraphToolDefinition: ToolDefinition = {
  tool: {
    name: "read_graph",
    description: "Read the entire knowledge graph",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  execute: async () => {
    const result = await getKnowledgeGraphManager().readGraph();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

export const searchNodesToolDefinition: ToolDefinition = {
  tool: {
    name: "search_nodes",
    description: "Search for nodes in the knowledge graph based on a query",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The search query to match against entity names, types, and observation content",
        },
      },
      required: ["query"],
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const query = args.query as string;
    const result = await getKnowledgeGraphManager().searchNodes(query);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

export const openNodesToolDefinition: ToolDefinition = {
  tool: {
    name: "open_nodes",
    description: "Open specific nodes in the knowledge graph by their names",
    inputSchema: {
      type: "object",
      properties: {
        names: {
          type: "array",
          items: { type: "string" },
          description: "An array of entity names to retrieve",
        },
      },
      required: ["names"],
    },
  },
  execute: async (args: Record<string, unknown>) => {
    const names = args.names as string[];
    const result = await getKnowledgeGraphManager().openNodes(names);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

// Export individual tool modules
export const createEntitesTool: ToolModule = {
  getToolDefinition: () => createEntitiesToolDefinition,
};

export const createRelationsTool: ToolModule = {
  getToolDefinition: () => createRelationsToolDefinition,
};

export const addObservationsTool: ToolModule = {
  getToolDefinition: () => addObservationsToolDefinition,
};

export const deleteEntitiesTool: ToolModule = {
  getToolDefinition: () => deleteEntitiesToolDefinition,
};

export const deleteObservationsTool: ToolModule = {
  getToolDefinition: () => deleteObservationsToolDefinition,
};

export const deleteRelationsTool: ToolModule = {
  getToolDefinition: () => deleteRelationsToolDefinition,
};

export const readGraphTool: ToolModule = {
  getToolDefinition: () => readGraphToolDefinition,
};

export const searchNodesTool: ToolModule = {
  getToolDefinition: () => searchNodesToolDefinition,
};

export const openNodesTool: ToolModule = {
  getToolDefinition: () => openNodesToolDefinition,
};
