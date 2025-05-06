import zodToJsonSchema from "zod-to-json-schema";
import { MulmoScriptTemplate } from "../types";
import { mulmoScriptSchema } from "../types/schema";

export const MulmoScriptTemplateMethods = {
  getSystemPrompt(template: MulmoScriptTemplate): string {
    const schema = zodToJsonSchema(mulmoScriptSchema, {
      strictUnions: true,
    });

    return `
**${template.systemPrompt}**

The output should follow the JSON format specified below. Please provide your response as valid JSON within \`\`\`json code blocks for clarity.

${JSON.stringify(schema)}
`.trim();
  },
};
