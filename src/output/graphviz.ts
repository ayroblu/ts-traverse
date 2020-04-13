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
  connectedFileNames = mangleCollapseConnections(connectedFileNames);
  resultLines.push(
    _.uniq(
      Array.from(connectedFileNames).map(
        ({ from, to }) => `"${from}" -> "${to}"`
      )
    )
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
    fullName: ".",
    childNodes: [],
    childNodeGroups: [],
  };
  nodes
    .filter(({ name }) => isIncludedPath(name))
    .forEach((node) => {
      const parts = node.name.split(path.sep);
      // remove ./ and create.ts (parent and leaf nodes, leaving middle nodes)
      const middleParts = parts.slice(0, -1);
      const finalNodeGroup = createMidNodeGroups(middleParts, 1, nodeGroup);
      // Add current node as leaf
      finalNodeGroup.childNodes.push(node);
    });
  return nodeGroup;
}
function createMidNodeGroups(
  middleParts: string[],
  middlePartsIdx: number,
  nodeGroup: BlockNodeGroup
): BlockNodeGroup {
  if (middleParts.length <= middlePartsIdx) return nodeGroup;

  const midPart = middleParts[middlePartsIdx];
  let childNodeGroup:
    | undefined
    | BlockNodeGroup = nodeGroup.childNodeGroups.find(
    (ng) => ng.name === midPart
  );
  if (!childNodeGroup) {
    childNodeGroup = {
      name: midPart,
      fullName: "./" + path.join(...middleParts.slice(0, middlePartsIdx + 1)),
      childNodes: [],
      childNodeGroups: [],
    };
    nodeGroup.childNodeGroups.push(childNodeGroup);
  }

  return createMidNodeGroups(middleParts, middlePartsIdx + 1, childNodeGroup);
}

const includedCollapsePathRe: string[] = [
  // aiden
  //"^(\\./micro_services)/",
  //"^\\./micro_services_clients",
  //"^\\./vendor/[a-z0-9_-]+",
  //"^\\./app/[a-z0-9_-]+",
  //"^\\./app/apis",
  //"^\\./app/models",
  //"^\\./app/config",
  //"^\\./lib/[a-z0-9_-]+",
  // aiden web
  //"^(\\./micro_services)/",
  //"^\\./micro_services_clients",
  //"^\\./vendor/[a-z0-9_-]+",
  //"^\\./app",
  //"^\\./lib",
];
const excludedCollapsePathRe: string[] = [
  //"^\\./app/ui_web/components/[a-z0-9_-]+"
];
const includePaths: string[] = ["components"];
const excludePaths: string[] = [
  // "components"
];
const includeMethods = false;

function getRecursePrint() {
  let num = 0;
  function recursePrint(nodeGroup: BlockNodeGroup): string {
    return ([] as string[])
      .concat(
        nodeGroup.childNodes.map((childNode) => {
          return getFormattedNode(childNode);
        }),
        nodeGroup.childNodeGroups.map((childNodeGroup) => {
          if (
            includedCollapsePathRe.some((r) =>
              new RegExp(r, "gi").test(childNodeGroup.fullName)
            ) &&
            !excludedCollapsePathRe.some((r) =>
              new RegExp(r, "gi").test(childNodeGroup.fullName)
            )
          ) {
            return getCollapsedPrint(childNodeGroup);
          }
          // While loop because empty with one (java style) is pointless to render
          while (
            childNodeGroup.childNodes.length === 0 &&
            childNodeGroup.childNodeGroups.length === 1
          ) {
            childNodeGroup = childNodeGroup.childNodeGroups[0];
          }
          return `subgraph cluster_${num++} {
    label="${childNodeGroup.fullName}"
  ${recursePrint(childNodeGroup).split("\n").join("\n  ")}
  }`;
        })
      )
      .map((path) => `  ${path}`)
      .join("\n");
  }
  return recursePrint;
}
function getFormattedNode({ name, variables, methods }: BlockNode) {
  let subpart = "";
  if (includeMethods && (variables.length || methods.length)) {
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

function getCollapsedPrint(nodeGroup: BlockNodeGroup): string {
  if (!includeMethods) {
    return `"${nodeGroup.fullName}" [label="{${nodeGroup.fullName}}"]`;
  }
  const label = getCollapsedLabel(nodeGroup);
  return `"${nodeGroup.fullName}" [label="{${nodeGroup.fullName}\\l|${label}\\l}"]`;
}
function getCollapsedLabel(nodeGroup: BlockNodeGroup): string {
  let childNodePrint = nodeGroup.childNodes.map(getFormattedLabel).join("\\l");
  let children = nodeGroup.childNodeGroups.map(getCollapsedLabel).join("\\l");
  const childParts =
    childNodePrint || children ? `${childNodePrint}${children}` : "";
  return `${childParts}`;
}
function getFormattedLabel({ name, variables, methods }: BlockNode) {
  let subpart = "";
  if (includeMethods && (variables.length || methods.length)) {
    subpart =
      "\\l" +
      [...variables, ...methods.map(({ name }) => name)]
        .map((s) => `+ ${s}`)
        .join("\\l");
  }
  return `${name}${subpart}`;
}
function mangleCollapseConnections(
  connectedFileNames: Set<{ from: string; to: string }>
): Set<{ from: string; to: string }> {
  const arr = Array.from(connectedFileNames)
    // Copy
    .map(({ from, to }) => ({ from, to }))
    .map(({ from, to }) => {
      from = rewritePath(from);
      to = rewritePath(to);
      return { from, to };
    })
    .filter(({ from, to }) => from !== to)
    .filter(({ from, to }) => isIncludedPath(from) && isIncludedPath(to));
  return new Set(arr);
}
function rewritePath(fullName: string) {
  const dirname = path.dirname(fullName);
  for (const c of includedCollapsePathRe) {
    const match = new RegExp(c, "gi").exec(dirname);
    if (
      match &&
      !excludedCollapsePathRe.some((r) => new RegExp(r, "gi").test(dirname))
    ) {
      return match[1] || match[0];
    }
  }
  return fullName;
}
function isIncludedPath(name: string) {
  if (!includePaths.length) return true;
  return (
    includePaths.some((p) => new RegExp(p, "gi").test(name)) &&
    !excludePaths.some((p) => new RegExp(p, "gi").test(name))
  );
}
