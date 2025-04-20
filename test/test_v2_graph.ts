import { GraphAI } from "graphai";
import type { AgentFunction } from "graphai";
import {
  ContentData,
  ContentGroup,
  ContentNode,
  MulmoData
} from "../src/typeV2";

import {
  sampleDoc
} from "./test_v2";

const flattenMulmoAgent = async (context: {  mulmo: MulmoData }) => {
  // const {namedInputs } = context;
  console.log(context);
  const result: { content: ContentData; path: string[] }[] = [];
  
  const traverse = (node: ContentNode, path: string[]) => {
    if (node.type === "group") {
      node.children.forEach((child, i) =>
        traverse(child, [...path, node.title ?? `group_${i}`])
      );
    } else {
      result.push({ content: node, path });
    }
  };

  context.mulmo.children.forEach((child, i) =>
    traverse(child, [`root_${i}`])
  );

  return result;
};


type Flattened = { content: ContentData; path: string[] };


type PathTree = {
  [title: string]: PathTree | ContentData[];
};

const insertToTree = (
  tree: PathTree,
  path: string[],
  content: ContentData
): PathTree => {
  if (path.length === 0) {
    return tree; // safety
  }

  const [head, ...rest] = path;

  return {
    ...tree,
    [head]: rest.length === 0
      ? [...(((tree[head] as ContentData[]) ?? [])), content]
      : insertToTree(
          (tree[head] as PathTree) ?? {},
          rest,
          content
        )
  };
};

const buildContentNode = (tree: PathTree): ContentNode[] =>
  Object.entries(tree).map(([title, value]) => {
    if (Array.isArray(value)) {
      return {
        type: "group",
        title,
        children: value
      };
    } else {
      return {
        type: "group",
        title,
        children: buildContentNode(value)
      };
    }
  });

export const rebuildMulmoAgent = async (namedInputs: { flattened: any[]}) => {
  const pathTree = namedInputs.flattened.reduce<PathTree>(
    (tree, { content, path }) => insertToTree(tree, path.slice(1), content),
    {}
  );

  return {
    type: "mulmo",
    children: buildContentNode(pathTree)
  };
};


const graph = {
  version: 0.5,
  nodes: {
    sample: {
      value: sampleDoc
    },
    original: {
      agent: flattenMulmoAgent,
      inputs: {
        mulmo: ":sample",
      },
      console: { after: true, before: true},
    },
    restore: {
      agent: rebuildMulmoAgent,
      inputs: {
        flattened: ":original",
      },
      console: { after: true, before: true},
      isResult: true,
    },
  }
};


import test from "node:test";
import assert from "node:assert";
test("test graph", async () => {
  const graphai = new GraphAI(graph, {});
  const ret = await graphai.run<MulmoData>();
  console.log(ret.restore);
  assert.deepStrictEqual(ret.restore, sampleDoc);

});
