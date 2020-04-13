export type AstInfo = {
  connectedFileNames: Set<{ from: string; to: string }>;
  resolvedFileNames: Set<string>;
  resolvedNodes: BlockNode[];
};
export type BlockNodeGroup = {
  // e.g. modules, output
  name: string;
  // e.g. modules, modules/output
  fullName: string;
  // Basically files and directories
  childNodes: BlockNode[];
  childNodeGroups: BlockNodeGroup[];
};
export type BlockNode = {
  name: string;
  methods: Method[];
  variables: string[];
};
export type Method = {
  name: string;
  symbolPrint: string;
  documentation?: string;
};
