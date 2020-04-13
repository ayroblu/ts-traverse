import { AstInfo } from "../types";
import { writeFileSync } from "fs";
import { getShortPath } from "../ast_info";

export function writeJson({ resolvedFileNames, connectedFileNames }: AstInfo) {
  const result = {
    nodes: Array.from(resolvedFileNames)
      .map(getShortPath)
      .map((id) => ({ id, group: 1 }))
      .sort(),
    links: Array.from(connectedFileNames).map(({ from, to }) => ({
      source: from,
      target: to,
      value: 1,
    })),
  };
  writeFileSync("./result.json", JSON.stringify(result, null, 2));
}
