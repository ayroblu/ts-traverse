import _ from "lodash";

import { getAstInfo } from "./ast_info";
import { printDot } from "./output";

if (!process.argv[2]) throw new Error("expecting root argument");
const astInfo = getAstInfo(process.argv[2]);

// writeJson();
printDot(astInfo, true);
