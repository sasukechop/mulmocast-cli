import { MulmoData, ContentData, ContentNode } from "../src/typeV2";

import test from "node:test";
import assert from "node:assert";

export const sampleDoc: MulmoData = {
  type: "mulmo",
  children: [
    {
      type: "group",
      title: "はじめに",
      children: [
        {
          type: "chat",
          text: ["この文書は再帰的な構造で書かれています。"],
          speaker: "me",
        },
      ],
    },
    {
      type: "group",
      title: "第1章",
      children: [
        {
          type: "group",
          title: "第1節",
          children: [
            {
              type: "group",
              title: "第1項",
              children: [
                {
                  type: "chat",
                  text: ["これはチャットの内容です。"],
                  speaker: "me",
                },
                {
                  type: "text",
                  text: ["これはテキストの内容です。"],
                },
                {
                  type: "markdown",
                  markdown: ["これはmdの内容です。"],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export async function mapContentDataAsyncChain(node: MulmoData, handlers: ((data: ContentData, path: string[]) => Promise<ContentData>)[]): Promise<MulmoData> {
  const applyHandlers = (data: ContentData, path: string[]): Promise<ContentData> => {
    return handlers.reduce((prevPromise, handler) => prevPromise.then((result) => handler(result, path)), Promise.resolve(data));
  };

  const mapNode = async (node: ContentNode, path: string[]): Promise<ContentNode> => {
    if (node.type === "group") {
      const children = await Promise.all(
        node.children.map((child, index) => {
          return mapNode(child, [...path, node.title ?? `group_${index}`]);
        }),
      );
      return {
        ...node,
        children,
      };
    }
    return applyHandlers(node, path);
  };

  const children = await Promise.all(
    node.children.map((child, index) => {
      return mapNode(child, [`root_${index}`]);
    }),
  );
  return {
    type: "mulmo",
    children,
  };
}

test("test splitIntoSentences", async () => {
  const handlers = [
    async (data: ContentData, _path: string[]) => {
      if (data.type === "text" || data.type === "chat") {
        return { ...data, text: data.text.map((t) => t.split("").reverse().join("")) };
      }
      return data;
    },
    async (data: ContentData, path: string[]) => (data.type === "text" ? { ...data, text: data.text.map((t) => `[${path.join(" > ")}] ${t}`) } : data),
  ];

  const result = await mapContentDataAsyncChain(sampleDoc, handlers);

  console.log(JSON.stringify(result, null, 2));
});
