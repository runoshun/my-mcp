import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  createEntitesTool,
  createRelationsTool,
  readGraphTool,
  searchNodesTool,
} from "./memory.ts";

Deno.test("memory tool definitions", () => {
  const createEntitiesDefinition = createEntitesTool.getToolDefinition();
  assertEquals(createEntitiesDefinition.tool.name, "create_entities");
  assertExists(createEntitiesDefinition.tool.inputSchema);

  const createRelationsDefinition = createRelationsTool.getToolDefinition();
  assertEquals(createRelationsDefinition.tool.name, "create_relations");
  assertExists(createRelationsDefinition.tool.inputSchema);

  const readGraphDefinition = readGraphTool.getToolDefinition();
  assertEquals(readGraphDefinition.tool.name, "read_graph");
  assertExists(readGraphDefinition.tool.inputSchema);

  const searchNodesDefinition = searchNodesTool.getToolDefinition();
  assertEquals(searchNodesDefinition.tool.name, "search_nodes");
  assertExists(searchNodesDefinition.tool.inputSchema);
});

Deno.test("memory tool integration test", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });

  // Override the default memory file path for testing
  Deno.env.set("MEMORY_FILE_PATH", tempFile);

  try {
    // Test create entities tool
    const createEntitiesDefinition = createEntitesTool.getToolDefinition();
    const createResult = await createEntitiesDefinition.execute({
      entities: [
        {
          name: "Alice",
          entityType: "Person",
          observations: ["Works at OpenAI", "Likes coffee"],
        },
        {
          name: "Bob",
          entityType: "Person",
          observations: ["Software engineer"],
        },
      ],
    });

    assertExists(createResult.content);
    assertEquals(createResult.content[0].type, "text");

    // Test create relations tool
    const createRelationsDefinition = createRelationsTool.getToolDefinition();
    const relationsResult = await createRelationsDefinition.execute({
      relations: [
        {
          from: "Alice",
          to: "Bob",
          relationType: "knows",
        },
      ],
    });

    assertExists(relationsResult.content);
    assertEquals(relationsResult.content[0].type, "text");

    // Test search functionality
    const searchDefinition = searchNodesTool.getToolDefinition();
    const searchResult = await searchDefinition.execute({
      query: "coffee",
    });

    assertExists(searchResult.content);
    assertEquals(searchResult.content[0].type, "text");

    const searchContent = searchResult.content[0];
    if (searchContent.type === "text") {
      const searchData = JSON.parse(searchContent.text);
      assertEquals(searchData.entities.length, 1);
      assertEquals(searchData.entities[0].name, "Alice");
    }

    console.log("✓ Memory tool integration test passed");
  } finally {
    try {
      await Deno.remove(tempFile);
    } catch {
      // Ignore cleanup errors
    }
    Deno.env.delete("MEMORY_FILE_PATH");
  }
});

Deno.test("memory tool execution", async () => {
  const tempFile = await Deno.makeTempFile({ suffix: ".json" });
  
  // Override the default memory file path for testing
  const originalPath = Deno.env.get("MEMORY_FILE_PATH");
  Deno.env.set("MEMORY_FILE_PATH", tempFile);

  try {
    // Test create entities tool
    const createEntitiesDefinition = createEntitesTool.getToolDefinition();
    const createResult = await createEntitiesDefinition.execute({
      entities: [
        {
          name: "TestEntity",
          entityType: "Test",
          observations: ["Test observation"],
        },
      ],
    });

    assertExists(createResult.content);
    assertEquals(createResult.content[0].type, "text");

    // Test read graph tool
    const readGraphDefinition = readGraphTool.getToolDefinition();
    const readResult = await readGraphDefinition.execute({});

    assertExists(readResult.content);
    assertEquals(readResult.content[0].type, "text");

    const textContent = readResult.content[0];
    if (textContent.type === "text") {
      const graphData = JSON.parse(textContent.text);
      assertEquals(graphData.entities.length, 1);
      assertEquals(graphData.entities[0].name, "TestEntity");
    }

    console.log("✓ Memory tool execution test passed");
  } finally {
    try {
      await Deno.remove(tempFile);
    } catch {
      // Ignore cleanup errors
    }
    // Restore original environment
    if (originalPath) {
      Deno.env.set("MEMORY_FILE_PATH", originalPath);
    } else {
      Deno.env.delete("MEMORY_FILE_PATH");
    }
  }
});
