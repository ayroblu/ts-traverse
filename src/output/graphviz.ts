import path from "path";
import _ from "lodash";
import { AstInfo, BlockNodeGroup, BlockNode } from "../types";
import { getShortPath } from "../ast_info";

// resolvedFileNames = nodes;
// connectedFileNames = arcs;
export function printDot(
  { connectedFileNames, resolvedNodes }: AstInfo,
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
      _.orderBy(
        resolvedNodes.map(({ name, ...rest }) => ({
          ...rest,
          name: getShortPath(name),
        })),
        ({ name }) => name
      )
        .map(
          ({ name, variables, methods }) =>
            `"${name}" [label="(${name}|${variables.join("\\l")}|${methods
              .map(({ name }) => name)
              .join("\\l")})"]`
        )
        .map((out) => `  ${out}`)
        .join("\n")
    );
  } else {
    const recursePrint = getRecursePrint();
    const nodeGroup = createNodesAndGroups(
      _.orderBy(
        resolvedNodes.map(({ name, ...rest }) => ({
          ...rest,
          name: getShortPath(name),
        })),
        ({ name }) => name
      )
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

function createNodesAndGroups(nodes: BlockNode[]): BlockNodeGroup {
  const nodeGroup: BlockNodeGroup = {
    name: ".",
    childNodes: [],
    childNodeGroups: [],
  };
  nodes.forEach((node) => {
    const parts = node.name.split(path.sep);
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

function getRecursePrint() {
  let num = 0;
  function recursePrint(nodeGroup: BlockNodeGroup): string {
    return ([] as string[])
      .concat(
        nodeGroup.childNodes.map((childNode) => {
          return getFormattedLabel(childNode);
        }),
        nodeGroup.childNodeGroups.map((childNodeGroup) => {
          return `subgraph cluster_${num++} {
    label="${childNodeGroup.name}"
  ${recursePrint(childNodeGroup).split("\n").join("\n  ")}
  }`;
        })
      )
      .map((path) => `  ${path}`)
      .join("\n");
  }
  return recursePrint;
}
function getFormattedLabel({ name, variables, methods }: BlockNode) {
  let subpart = "";
  if (variables.length || methods.length) {
    const variablePart = `${variables.join("\\l")}${
      variables.length ? "\\l" : ""
    }`;
    const methodsPart = `${methods
      // .map(({ symbolPrint }) => symbolPrint.replace(/([{}])/g, "\\$1"))
      .map(({ name }) => name.replace(/([{}])/g, "\\$1"))
      .join("\\l")}${methods.length ? "\\l" : ""}`;
    subpart = `|${variablePart}${methodsPart}`;
  }
  return `"${name}" [label="{${name}${subpart}}"]`;
}
