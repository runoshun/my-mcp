import { assertEquals } from "@std/assert";

Deno.test("main", async () => {
	const { add } = await import("./main.ts");
	const result = add(2, 3);
	assertEquals(result, 5);
});
