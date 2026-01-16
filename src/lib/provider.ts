import { anthropic } from "@ai-sdk/anthropic";
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from "@ai-sdk/provider";

const MODEL = "claude-haiku-4-5";

export class MockLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]> = {};

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  async doGenerate(options: LanguageModelV2CallOptions) {
    return {
      content: [
        {
          type: "text" as const,
          text: "This is a mock response. Please add an ANTHROPIC_API_KEY to your .env file to use the real Claude API.",
        },
        {
          type: "tool-call" as const,
          toolCallId: "mock-call-1",
          toolName: "str_replace_editor",
          args: JSON.stringify({
            command: "create",
            path: "/App.jsx",
            file_text: `export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md">
        <h1 className="text-2xl font-bold mb-4">Mock Response</h1>
        <p className="text-gray-600">
          Add an ANTHROPIC_API_KEY to your .env file to use the real Claude API for component generation.
        </p>
      </div>
    </div>
  );
}`,
          }),
        },
      ],
      finishReason: "tool-calls" as const,
      usage: {
        promptTokens: 100,
        completionTokens: 200,
      },
      warnings: [],
    };
  }

  async doStream(options: LanguageModelV2CallOptions) {
    const self = this;

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        // Stream text
        const text =
          "This is a mock response. Please add an ANTHROPIC_API_KEY to your .env file. Let me create a sample component for you.";
        for (const char of text) {
          controller.enqueue({
            type: "text",
            text: char,
          });
          await new Promise((resolve) => setTimeout(resolve, 20));
        }

        // Stream tool call
        controller.enqueue({
          type: "tool-call",
          toolCallId: "mock-call-1",
          toolName: "str_replace_editor",
          args: JSON.stringify({
            command: "create",
            path: "/App.jsx",
            file_text: `export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-8">
      <div className="bg-white rounded-lg shadow-md p-6 max-w-md">
        <h1 className="text-2xl font-bold mb-4">Sample Component</h1>
        <p className="text-gray-600 mb-4">
          This is a mock response. Add an ANTHROPIC_API_KEY to enable real AI generation.
        </p>
        <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Click Me
        </button>
      </div>
    </div>
  );
}`,
          }),
        });

        // Finish
        controller.enqueue({
          type: "finish",
          finishReason: "tool-calls",
          usage: {
            promptTokens: 100,
            completionTokens: 200,
          },
        });

        controller.close();
      },
    });

    return {
      stream,
      warnings: [],
    };
  }
}

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.log("No ANTHROPIC_API_KEY found, using mock provider");
    return new MockLanguageModel("mock-claude");
  }

  return anthropic(MODEL);
}
