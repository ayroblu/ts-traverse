import path from "path";
import _ from "lodash";
import { AstInfo, BlockNodeGroup, BlockNode } from "../types";
import { getShortPath } from "../ast_info";

// resolvedFileNames = nodes;
// connectedFileNames = arcs;
export function printDot(
  { resolvedFileNames, connectedFileNames }: AstInfo,
  isShowGroups: boolean
) {
  const resultLines = [];
  resultLines.push(`digraph g {
  graph[splines=polyline];
  node[shape=record];
  edge[color="#00000033"];
  `);
  if (!isShowGroups) {
    resultLines.push(
      Array.from(resolvedFileNames)
        .map(getShortPath)
        .sort()
        .map((path) => `"${path}" [label="${path}"]`)
        .map((path) => `  ${path}`)
        .join("\n")
    );
  } else {
    const recursePrint = getRecursePrint();
    const nodeGroup = createNodesAndGroups(
      Array.from(resolvedFileNames)
        .map((fileName) => getShortPath(fileName))
        .sort()
    );
    resultLines.push(recursePrint(nodeGroup));
  }
  resultLines.push("");
  resultLines.push(
    Array.from(connectedFileNames)
      .map(({ from, to }) => `"${from}" -> "${to}"`)
      .sort()
      .map((path) => `  ${path}`)
      .join("\n")
  );
  resultLines.push("}");
  console.log(resultLines.join("\n"));
}

function createNodesAndGroups(paths: string[]): BlockNodeGroup {
  const nodeGroup: BlockNodeGroup = {
    name: ".",
    childNodes: [],
    childNodeGroups: [],
  };
  paths.forEach((p) => {
    const parts = p.split(path.sep);
    const node: BlockNode = {
      name: p,
    };
    // remove ./ and create.ts (parent and leaf nodes, leaving middle nodes)
    const middleParts = parts.slice(1, -1);
    const finalNodeGroup = createMidNodeGroups(middleParts, nodeGroup);
    // Add current node as leaf
    finalNodeGroup.childNodes.push(node);
  });
  return nodeGroup;
}
function createMidNodeGroups(
  middleParts: string[],
  nodeGroup: BlockNodeGroup
): BlockNodeGroup {
  if (!middleParts.length) return nodeGroup;

  const midPart = middleParts[0];
  let childNodeGroup:
    | undefined
    | BlockNodeGroup = nodeGroup.childNodeGroups.find(
    (ng) => ng.name === midPart
  );
  if (!childNodeGroup) {
    childNodeGroup = {
      name: midPart,
      childNodes: [],
      childNodeGroups: [],
    };
    nodeGroup.childNodeGroups.push(childNodeGroup);
  }

  return createMidNodeGroups(middleParts.slice(1), childNodeGroup);
}

// function clusterFolders(paths: string[]) {
//   const splitPaths = paths.map((p) => ({
//     original: p,
//     split: p.split(path.sep).slice(1),
//   }));
//   return groupFolders([], splitPaths, 1);
// }
// function groupFolders(
//   list: (string | (string | string[])[])[],
//   paths: { original: string; split: string[] }[],
//   depth: number
// ) {
//   const sameFolder = paths.filter((p) => p.split.length === depth);
//   list = list.concat(sameFolder.map(({ original }) => original));
//   const grouped = _(paths.filter((p) => p.split.length > depth))
//     .groupBy(({ split }) => split[depth - 1])
//     .toPairs()
//     .value();
//   for (const [_key, values] of grouped) {
//     list = list.concat([groupFolders([], values, depth + 1)] as any[]);
//   }
//   return list;
// }

// function getRecursePrint() {
//   let num = 0;
//   function recursePrint(list: (string | (string | string[])[])[]): string {
//     return list
//       .map((l) => {
//         if (Array.isArray(l)) {
//           return `subgraph cluster_${num++} {
//   ${recursePrint(l).split("\n").join("\n  ")}
//   }`;
//         } else {
//           return `"${l}" [label="${l}"]`;
//         }
//       })
//       .map((path) => `  ${path}`)
//       .join("\n");
//   }
//   return recursePrint;
// }
function getRecursePrint() {
  let num = 0;
  function recursePrint(nodeGroup: BlockNodeGroup): string {
    return ([] as string[])
      .concat(
        nodeGroup.childNodes.map((childNode) => {
          const { name } = childNode;
          return `"${name}" [label="${name}"]`;
        }),
        nodeGroup.childNodeGroups.map((childNodeGroup) => {
          return `subgraph cluster_${num++} {
  ${recursePrint(childNodeGroup).split("\n").join("\n  ")}
  }`;
        })
      )
      .map((path) => `  ${path}`)
      .join("\n");
  }
  return recursePrint;
}
