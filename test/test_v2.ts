import { MulmoData, ContentData, ContentNode } from "../src/typeV2";

import test from "node:test";
import assert from "node:assert";

const sampleDoc: MulmoData = {
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

export function traverseContentData(node: MulmoData, onData: (data: ContentData, path: string[]) => void) {
  const walk = (node: ContentNode, path: string[]) => {
    if (node.type === "group") {
      node.children.forEach((child, index) => {
        walk(child, [...path, node.title ?? `group_${index}`]);
      });
    } else {
      onData(node, path);
    }
  };

  node.children.forEach((child, index) => {
    walk(child, [`root_${index}`]);
  });
}

test("test splitIntoSentences", async () => {
  traverseContentData(sampleDoc, (data: ContentData, path: string[]) => {
    console.log("見つかったデータ:", data);
    console.log("位置:", path.join(" > "));
  });
});
