import { assertEquals, assertStringIncludes } from "@std/assert";
import { geminiSearchTool } from "./gemini-search.ts";

Deno.test("gemini search tool definition", () => {
  const toolDef = geminiSearchTool.getToolDefinition();
  
  assertEquals(toolDef.tool.name, "gemini_search");
  assertEquals(toolDef.tool.description, "Search the web and get a summary using Gemini CLI");
  assertEquals(toolDef.tool.inputSchema.type, "object");
  
  // Type assertion for inputSchema
  const schema = toolDef.tool.inputSchema as {
    type: string;
    properties: { query: { type: string; description: string } };
    required: string[];
  };
  
  assertEquals(schema.properties.query.type, "string");
  assertEquals(schema.required, ["query"]);
});

Deno.test("gemini search tool validation function", async () => {
  // validate function should check if Gemini CLI is available
  if (geminiSearchTool.validate) {
    const isValid = await geminiSearchTool.validate();
    
    // The result depends on whether Gemini CLI is installed
    // We just check that the function returns a boolean
    assertEquals(typeof isValid, "boolean");
    
    if (!isValid) {
      console.log("Note: Gemini CLI is not available on this system");
    }
  }
});

Deno.test("gemini search tool basic execution", async () => {
  const toolDef = geminiSearchTool.getToolDefinition();
  
  // Execute with a simple query
  const result = await toolDef.execute({ query: "test query" });
  
  // Check that result has the expected structure
  assertEquals(result.content.length, 1);
  assertEquals(result.content[0].type, "text");
  
  const textContent = result.content[0] as { type: string; text: string };
  assertEquals(typeof textContent.text, "string");
  
  // Check error handling
  if (textContent.text.includes("Error executing Gemini CLI")) {
    console.log("Gemini CLI error handling works correctly");
    
    // Common error scenarios
    if (textContent.text.includes("Please set an Auth method")) {
      console.log("- Auth error detected: Gemini CLI requires authentication");
    } else if (textContent.text.includes("command not found")) {
      console.log("- Gemini CLI is not installed");
    } else {
      console.log("- Other error:", textContent.text);
    }
  } else {
    console.log("Gemini CLI executed successfully");
    console.log("Response:", textContent.text.substring(0, 100) + "...");
  }
});

Deno.test("gemini search tool with actual API call", async () => {
  const toolDef = geminiSearchTool.getToolDefinition();
  
  // First check if authentication is configured
  const testResult = await toolDef.execute({ query: "What is 2+2?" });
  const testContent = testResult.content[0] as { type: string; text: string };
  
  // Skip this test if authentication is not configured
  if (testContent.text.includes("Error executing Gemini CLI") && 
      testContent.text.includes("Please set an Auth method")) {
    console.log("Skipping API test - authentication not configured");
    return;
  }
  
  // Execute with a real query that should return search results
  const result = await toolDef.execute({ 
    query: "What is Deno and what are its main features?" 
  });
  
  // Check that result has the expected structure
  assertEquals(result.content.length, 1);
  assertEquals(result.content[0].type, "text");
  
  const textContent = result.content[0] as { type: string; text: string };
  assertEquals(typeof textContent.text, "string");
  
  // If authenticated, the response should contain relevant information
  if (!textContent.text.includes("Error executing Gemini CLI")) {
    console.log("✓ Gemini API call successful");
    
    // Check that the response contains relevant content about Deno
    const lowerResponse = textContent.text.toLowerCase();
    const hasRelevantContent = 
      lowerResponse.includes("deno") || 
      lowerResponse.includes("javascript") ||
      lowerResponse.includes("typescript") ||
      lowerResponse.includes("runtime");
    
    if (hasRelevantContent) {
      console.log("✓ Response contains relevant information about Deno");
    } else {
      console.log("⚠ Response may not contain relevant search results");
    }
    
    // Log first 200 chars of response for debugging
    console.log("Response preview:", textContent.text.substring(0, 200) + "...");
  }
});