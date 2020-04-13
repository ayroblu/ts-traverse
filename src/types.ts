export type AstInfo = {
  connectedFileNames: Set<{ from: string; to: string }>;
  resolvedFileNames: Set<string>;
  resolvedNodes: BlockNode[];
};
export type BlockNodeGroup = {
  // e.g. modules, modules/output
  name: string;
  // Basically files and directories
  childNodes: BlockNode[];
  childNodeGroups: BlockNodeGroup[];
};
export type BlockNode = {
  name: string;
  methods: Method[];
};
export type Method = {
  symbolPrint: string;
  documentation?: string;
};
